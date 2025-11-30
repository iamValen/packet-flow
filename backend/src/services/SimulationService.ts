import { StatusCodes } from "http-status-codes";

import { prisma } from "../prisma.js";
import { AppError } from "../middleware/errorHandler.js";
import { SimulationBuilder } from "../controllers/SimulationBuilder.js";

import { Packet, Protocol } from "../models/Packet.js";
import { Host } from "../models/Host.js";
import type { Topology } from "../models/Topology.js";
import type { Node } from "../models/Node.js";
import type { NetworkInterface } from "../models/NetworkInterface.js";

type SimulationRuntime = {
    topology: Topology;
    nodeMap: Map<string, Node>;
    interfaceMap: Map<string, NetworkInterface>;
    isRunning: boolean;
    lastActivity: number;
};

class SimulationService {
    private activeSimulations = new Map<string, SimulationRuntime>();
    private readonly SIMULATION_TIMEOUT = 30 * 60 * 1000; // 30 minutes
    private readonly CLEANUP_INTERVAL = 5 * 60 * 1000;    // 5 minutes

    constructor() {
        // Start cleanup interval
        setInterval(() => this.cleanupInactiveSimulations(), this.CLEANUP_INTERVAL);
    }

    /**
     * Cleanup inactive simulations
     */
    private cleanupInactiveSimulations(): void {
        const now = Date.now();
        for (const [id, sim] of this.activeSimulations.entries()) {
            if (!sim.isRunning && (now - sim.lastActivity) > this.SIMULATION_TIMEOUT) {
                this.activeSimulations.delete(id);
                console.log(`Cleaned up inactive simulation: ${id}`);
            }
        }
    }

    /**
     * Update last activity timestamp
     */
    private updateTimestamp(simulationId: string): void {
        const runtime = this.activeSimulations.get(simulationId);
        if (runtime) runtime.lastActivity = Date.now();
    }

    /**
     * Get all simulations for a topology
     */
    async getAllSimulations(topologyId: string) {
        const topology = await prisma.topology.findUnique({ where: { id: topologyId } });
        if (!topology) {
            throw new AppError(StatusCodes.BAD_REQUEST, "Topology NOT FOUND");
        }

        const simulations = await prisma.simulationSession.findMany({
            where: { topologyId },
            orderBy: { createdAt: 'desc' }
        });

        simulations.forEach(sim => {
            if (this.activeSimulations.has(sim.id)) this.updateTimestamp(sim.id);
        });

        return simulations.map(sim => ({
            ...sim,
            isActive: this.activeSimulations.has(sim.id),
            runtimeStatus: this.activeSimulations.get(sim.id)?.isRunning ? 'RUNNING' : 'IDLE'
        }));
    }

    /**
     * Create a new simulation
     */
    async createSimulation(topologyId: string, name?: string, autoPopulateARP?: boolean, stepDelay?: number) {
        const topology = await prisma.topology.findUnique({ where: { id: topologyId } });
        if (!topology) {
            throw new AppError(StatusCodes.NOT_FOUND, "Topology not found");
        }

        const simulation = await prisma.simulationSession.create({
            data: {
                name: name || `Simulation ${new Date().toISOString()}`,
                autoPopulateARP: autoPopulateARP ?? false,
                stepDelay: Number(stepDelay ?? 1000),
                status: "IDLE",
                topologyId
            }
        });

        const { topology: runtimeTopology, nodeMap, interfaceMap } = 
            await SimulationBuilder.buildFromDatabase(topologyId, autoPopulateARP ?? false);

        this.activeSimulations.set(simulation.id, {
            topology: runtimeTopology,
            nodeMap,
            interfaceMap,
            isRunning: false,
            lastActivity: Date.now()
        });

        return {
            simulation,
            runtimeInfo: {
                nodesCount: runtimeTopology.nodes.length,
                linksCount: runtimeTopology.links.length
            }
        };
    }

    /**
     * Get a simulation by ID
     */
    async getSimulationById(topologyId: string, simulationId: string) {
        const simulation = await prisma.simulationSession.findUnique({
            where: { id: simulationId },
            include: { topology: { select: { id: true, name: true } } }
        });

        if (!simulation || simulation.topologyId !== topologyId) {
            throw new AppError(StatusCodes.NOT_FOUND, "Simulation not found");
        }

        this.updateTimestamp(simulationId);

        const runtime = this.activeSimulations.get(simulationId);
        const runtimeStatus = runtime ? {
            isActive: true,
            isRunning: runtime.isRunning,
            packetsInFlight: runtime.topology.getPacketsInFlight().length,
            currentPackets: runtime.topology.getPacketsInFlight().map((pif: any) => ({
                id: pif.packet.id,
                currentNode: pif.currentNode.name,
                srcIp: pif.packet.srcIp,
                dstIp: pif.packet.dstIp,
                protocol: pif.packet.protocol,
                ttl: pif.packet.ttl
            }))
        } : { isActive: false };

        return { ...simulation, runtime: runtimeStatus };
    }

    /**
     * Load a simulation into memory
     */
    async loadSimulation(topologyId: string, simulationId: string, autoPopulateARP: boolean = false) {
        const simulation = await prisma.simulationSession.findUnique({ where: { id: simulationId } });
        if (!simulation || simulation.topologyId !== topologyId) {
            throw new AppError(StatusCodes.NOT_FOUND, "Simulation not found");
        }

        if (this.activeSimulations.has(simulationId)) {
            throw new AppError(StatusCodes.CONFLICT, "Already loaded");
        }

        const { topology: runtimeTopology, nodeMap, interfaceMap } = 
            await SimulationBuilder.buildFromDatabase(topologyId, autoPopulateARP);

        this.activeSimulations.set(simulationId, {
            topology: runtimeTopology,
            nodeMap,
            interfaceMap,
            isRunning: false,
            lastActivity: Date.now()
        });

        return {
            nodesCount: runtimeTopology.nodes.length,
            linksCount: runtimeTopology.links.length
        };
    }

    /**
     * Send a packet in simulation
     */
    async sendPacket(simulationId: string, sourceNodeId: string, destinationIp: string, protocol: string, payload?: string) {
        const runtime = this.activeSimulations.get(simulationId);
        if (!runtime) {
            throw new AppError(StatusCodes.NOT_FOUND, "Simulation not loaded");
        }

        this.updateTimestamp(simulationId);

        const sourceNode: Node | undefined = runtime.nodeMap.get(sourceNodeId);
        if (!sourceNode || !(sourceNode instanceof Host)) {
            throw new AppError(StatusCodes.BAD_REQUEST, "Source node must be a Host");
        }

        const packet: Packet = runtime.topology.sendPacket(
            sourceNode,
            destinationIp,
            protocol as Protocol,
            payload
        );

        this.updateTimestamp(simulationId);

        return {
            packet: {
                id: packet.id,
                srcIp: packet.srcIp,
                dstIp: packet.dstIp,
                protocol: packet.protocol,
                ttl: packet.ttl
            },
            packetsInFlight: runtime.topology.getPacketsInFlight().length
        };
    }

    /**
     * Run a single simulation step
     */
    async simulationStep(simulationId: string) {
        const runtime = this.activeSimulations.get(simulationId);
        if (!runtime) {
            throw new AppError(StatusCodes.NOT_FOUND, "Simulation not loaded");
        }

        this.updateTimestamp(simulationId);

        runtime.topology.step();
        const packetsInFlight = runtime.topology.getPacketsInFlight();

        this.updateTimestamp(simulationId);

        return {
            packetsInFlight: packetsInFlight.length,
            packets: packetsInFlight.map((pif: any) => ({
                id: pif.packet.id,
                currentNode: pif.currentNode.name,
                srcIp: pif.packet.srcIp,
                dstIp: pif.packet.dstIp,
                protocol: pif.packet.protocol,
                ttl: pif.packet.ttl,
                history: pif.packet.history.map((n: any) => n.name)
            }))
        };
    }

    /**
     * Run the simulation
     */
    async runSimulation(simulationId: string, stepDelay?: number, maxSteps?: number) {
        const runtime = this.activeSimulations.get(simulationId);
        if (!runtime) {
            throw new AppError(StatusCodes.NOT_FOUND, "Simulation not loaded");
        }

        if (runtime.isRunning) {
            throw new AppError(StatusCodes.CONFLICT, "Already running");
        }

        const finalStepDelay = stepDelay ?? 100;
        const finalMaxSteps = maxSteps ?? 100;

        runtime.isRunning = true;
        this.updateTimestamp(simulationId);
        await prisma.simulationSession.update({ where: { id: simulationId }, data: { status: "RUNNING" } });

        let steps = 0;
        const startTime = Date.now();

        try {
            while (runtime.topology.getPacketsInFlight().length > 0 && steps < finalMaxSteps && runtime.isRunning) {
                runtime.topology.step();
                steps++;
                this.updateTimestamp(simulationId);
                await new Promise(resolve => setTimeout(resolve, finalStepDelay));
            }

            await prisma.simulationSession.update({ where: { id: simulationId }, data: { status: "COMPLETED" } });
            this.updateTimestamp(simulationId);

            return {
                steps,
                duration: Date.now() - startTime,
                packetsRemaining: runtime.topology.getPacketsInFlight().length
            };
        } finally {
            runtime.isRunning = false;
            this.updateTimestamp(simulationId);
        }
    }

    /**
     * Stop a running simulation
     */
    async stopSimulation(simulationId: string) {
        const runtime = this.activeSimulations.get(simulationId);
        if (!runtime) {
            throw new AppError(StatusCodes.NOT_FOUND, "Simulation not loaded");
        }

        runtime.isRunning = false;
        this.updateTimestamp(simulationId);
        await prisma.simulationSession.update({ where: { id: simulationId }, data: { status: "IDLE" } });
    }

    /**
     * Unload simulation from memory
     */
    async unloadSimulation(simulationId: string) {
        const runtime = this.activeSimulations.get(simulationId);
        if (!runtime) {
            throw new AppError(StatusCodes.NOT_FOUND, "Simulation not loaded");
        }

        runtime.isRunning = false;
        this.activeSimulations.delete(simulationId);
    }

    /**
     * Delete a simulation
     */
    async deleteSimulation(topologyId: string, simulationId: string) {
        const simulation = await prisma.simulationSession.findUnique({ where: { id: simulationId } });
        if (!simulation || simulation.topologyId !== topologyId) {
            throw new AppError(StatusCodes.NOT_FOUND, "Simulation not found");
        }

        const runtime = this.activeSimulations.get(simulationId);
        if (runtime) {
            runtime.isRunning = false;
            this.activeSimulations.delete(simulationId);
        }

        await prisma.simulationSession.delete({ where: { id: simulationId } });

        return { id: simulation.id, name: simulation.name };
    }
}

export default new SimulationService();