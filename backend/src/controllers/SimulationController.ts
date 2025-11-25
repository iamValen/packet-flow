import type { Request, Response } from "express";
import { PrismaClient } from "@prisma/client";
import { StatusCodes } from "http-status-codes";
import { SimulationBuilder } from "./SimulationBuilder.js";
import { Protocol } from "../models/Packet.js";
import { Host } from "../models/Host.js";
import type { Topology } from "../models/Topology.js";
import type { Node } from "../models/Node.js";
import type { NetworkInterface } from "../models/NetworkInterface.js";

const prisma = new PrismaClient();

/**
 * Active simulations are stored in memory.
 */
const activeSimulations = new Map<string, {
    topology: Topology;
    nodeMap: Map<string, Node>;
    interfaceMap: Map<string, NetworkInterface>;
    isRunning: boolean;
}>();

/**
 * GET /api/topologies/:topologyId/simulations
 */
export const getAllSimulations = async (req: Request, res: Response): Promise<void> => {
    try {
        const { topologyId } = req.params;
        if (!topologyId) {
            res.status(StatusCodes.BAD_REQUEST).json({ success: false, error: "Topology ID is required" });
            return;
        }
        const topology = await prisma.topology.findUnique({ where: { id: topologyId } });
        if (!topology) {
            res.status(StatusCodes.NOT_FOUND).json({ success: false, error: "Topology not found" });
            return;
        }
        const simulations = await prisma.simulationSession.findMany({
            where: { topologyId },
            orderBy: { createdAt: 'desc' }
        });

        res.json({
            success: true,
            topologyId,
            topologyName: topology.name,
            count: simulations.length,
            simulations: simulations.map(sim => ({
                ...sim,
                isActive: activeSimulations.has(sim.id),
                runtimeStatus: activeSimulations.get(sim.id)?.isRunning ? 'RUNNING' : 'IDLE'
            }))
        });
    } catch (error: unknown) {
        console.error("Error:", error);
        res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ success: false, error: "Failed to fetch simulations" });
    }
};

/**
 * POST /api/topologies/:topologyId/simulations
 */
export const createSimulation = async (req: Request, res: Response): Promise<void> => {
    try {
        const { topologyId } = req.params;
        const { name, autoPopulateARP = false, stepDelay = 1000 } = req.body;
        if (!topologyId) {
            res.status(StatusCodes.BAD_REQUEST).json({ success: false, error: "Topology ID is required" });
            return;
        }
        const topology = await prisma.topology.findUnique({ where: { id: topologyId } });
        if (!topology) {
            res.status(StatusCodes.NOT_FOUND).json({ success: false, error: "Topology not found" });
            return;
        }

        const simulation = await prisma.simulationSession.create({
            data: {
                name: name || `Simulation ${new Date().toISOString()}`,
                autoPopulateARP,
                stepDelay: Number(stepDelay),
                status: "IDLE",
                topologyId
            }
        });

        const { topology: runtimeTopology, nodeMap, interfaceMap } = 
            await SimulationBuilder.buildFromDatabase(topologyId, autoPopulateARP);

        activeSimulations.set(simulation.id, {
            topology: runtimeTopology,
            nodeMap,
            interfaceMap,
            isRunning: false
        });

        res.status(StatusCodes.CREATED).json({
            success: true,
            message: "Simulation created",
            simulation: {
                ...simulation,
                isActive: true,
                runtimeInfo: {
                    nodesCount: runtimeTopology.nodes.length,
                    linksCount: runtimeTopology.links.length
                }
            }
        });
    } catch (error: unknown) {
        console.error("Error:", error);
        res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ success: false, error: "Failed to create simulation" });
    }
};

/**
 * GET /api/topologies/:topologyId/simulations/:simulationId
 */
export const getSimulationById = async (req: Request, res: Response): Promise<void> => {
    try {
        const { topologyId, simulationId } = req.params;
        if (!topologyId || !simulationId) {
            res.status(StatusCodes.BAD_REQUEST).json({ success: false, error: "Topology ID and simulation ID are required" });
            return;
        }
        const simulation = await prisma.simulationSession.findUnique({
            where: { id: simulationId },
            include: { topology: { select: { id: true, name: true } } }
        });

        if (!simulation || simulation.topologyId !== topologyId) {
            res.status(StatusCodes.NOT_FOUND).json({ success: false, error: "Simulation not found" });
            return;
        }

        const runtime = activeSimulations.get(simulationId);
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

        res.json({
            success: true,
            simulation: { ...simulation, runtime: runtimeStatus }
        });
    } catch (error: unknown) {
        console.error("Error:", error);
        res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ success: false, error: "Failed to fetch simulation" });
    }
};

/**
 * POST /api/topologies/:topologyId/simulations/:simulationId/load
 */
export const loadSimulation = async (req: Request, res: Response): Promise<void> => {
    try {
        const { topologyId, simulationId } = req.params;
        const { autoPopulateARP = false } = req.body;

        if (!topologyId || !simulationId) {
            res.status(StatusCodes.BAD_REQUEST).json({ success: false, error: "Topology ID and simulation ID are required" });
            return;
        }
        const simulation = await prisma.simulationSession.findUnique({ where: { id: simulationId } });
        if (!simulation || simulation.topologyId !== topologyId) {
            res.status(StatusCodes.NOT_FOUND).json({ success: false, error: "Simulation not found" });
            return;
        }

        if (activeSimulations.has(simulationId)) {
            res.status(StatusCodes.CONFLICT).json({ success: false, error: "Already loaded" });
            return;
        }

        const { topology: runtimeTopology, nodeMap, interfaceMap } = 
            await SimulationBuilder.buildFromDatabase(topologyId, autoPopulateARP);

        activeSimulations.set(simulationId, {
            topology: runtimeTopology,
            nodeMap,
            interfaceMap,
            isRunning: false
        });

        res.json({
            success: true,
            message: "Simulation loaded",
            runtime: {
                nodesCount: runtimeTopology.nodes.length,
                linksCount: runtimeTopology.links.length
            }
        });
    } catch (error: unknown) {
        console.error("Error:", error);
        res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ success: false, error: "Failed to load simulation" });
    }
};

/**
 * POST /api/topologies/:topologyId/simulations/:simulationId/send-packet
 */
export const sendPacket = async (req: Request, res: Response): Promise<void> => {
    try {
        const { simulationId } = req.params;
        const { sourceNodeId, destinationIp, protocol, payload } = req.body;

        if (!simulationId) {
            res.status(StatusCodes.BAD_REQUEST).json({ success: false, error: "Topology ID and simulation ID are required" });
            return;
        }
        const runtime = activeSimulations.get(simulationId);
        if (!runtime) {
            res.status(StatusCodes.NOT_FOUND).json({ success: false, error: "Simulation not loaded" });
            return;
        }

        const sourceNode = runtime.nodeMap.get(sourceNodeId);
        if (!sourceNode || !(sourceNode instanceof Host)) {
            res.status(StatusCodes.BAD_REQUEST).json({ success: false, error: "Source must be a Host" });
            return;
        }

        const packet = runtime.topology.sendPacket(sourceNode, destinationIp, protocol as Protocol, payload);

        res.json({
            success: true,
            packet: {
                id: packet.id,
                srcIp: packet.srcIp,
                dstIp: packet.dstIp,
                protocol: packet.protocol,
                ttl: packet.ttl
            },
            packetsInFlight: runtime.topology.getPacketsInFlight().length
        });
    } catch (error: unknown) {
        console.error("Error:", error);
        res.status(StatusCodes.BAD_REQUEST).json({ 
            success: false, 
            error: error instanceof Error ? error.message : "Failed to send packet" 
        });
    }
};

/**
 * POST /api/topologies/:topologyId/simulations/:simulationId/step
 */
export const simulationStep = async (req: Request, res: Response): Promise<void> => {
    try {
        const { simulationId } = req.params;
        if (!simulationId) {
            res.status(StatusCodes.BAD_REQUEST).json({ success: false, error: "Topology ID and simulation ID are required" });
            return;
        }
        const runtime = activeSimulations.get(simulationId);
        
        if (!runtime) {
            res.status(StatusCodes.NOT_FOUND).json({ success: false, error: "Simulation not loaded" });
            return;
        }

        runtime.topology.step();
        const packetsInFlight = runtime.topology.getPacketsInFlight();

        res.json({
            success: true,
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
        });
    } catch (error: unknown) {
        console.error("Error:", error);
        res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ success: false, error: "Failed to execute step" });
    }
};

/**
 * POST /api/topologies/:topologyId/simulations/:simulationId/run
 */
export const runSimulation = async (req: Request, res: Response): Promise<void> => {
    try {
        const { simulationId } = req.params;
        const { stepDelay = 100, maxSteps = 100 } = req.body;

        if (!simulationId) {
            res.status(StatusCodes.BAD_REQUEST).json({ success: false, error: "Topology ID and simulation ID are required" });
            return;
        }
        const runtime = activeSimulations.get(simulationId);
        if (!runtime) {
            res.status(StatusCodes.NOT_FOUND).json({ success: false, error: "Simulation not loaded" });
            return;
        }

        if (runtime.isRunning) {
            res.status(StatusCodes.CONFLICT).json({ success: false, error: "Already running" });
            return;
        }

        runtime.isRunning = true;
        await prisma.simulationSession.update({ where: { id: simulationId }, data: { status: "RUNNING" } });

        let steps = 0;
        const startTime = Date.now();

        try {
            while (runtime.topology.getPacketsInFlight().length > 0 && steps < maxSteps && runtime.isRunning) {
                runtime.topology.step();
                steps++;
                await new Promise(resolve => setTimeout(resolve, stepDelay));
            }

            await prisma.simulationSession.update({ where: { id: simulationId }, data: { status: "COMPLETED" } });

            res.json({
                success: true,
                steps,
                duration: Date.now() - startTime,
                packetsRemaining: runtime.topology.getPacketsInFlight().length
            });
        } finally {
            runtime.isRunning = false;
        }
    } catch (error: unknown) {
        console.error("Error:", error);
        res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ success: false, error: "Failed to run simulation" });
    }
};

/**
 * POST /api/topologies/:topologyId/simulations/:simulationId/stop
 */
export const stopSimulation = async (req: Request, res: Response): Promise<void> => {
    try {
        const { simulationId } = req.params;
        if(!simulationId) {
            res.status(StatusCodes.BAD_REQUEST).json({ success: false, error: "Topology ID and simulation ID are required" });
            return;
        }
        const runtime = activeSimulations.get(simulationId);
        
        if (!runtime) {
            res.status(StatusCodes.NOT_FOUND).json({ success: false, error: "Simulation not loaded" });
            return;
        }

        runtime.isRunning = false;
        await prisma.simulationSession.update({ where: { id: simulationId }, data: { status: "IDLE" } });

        res.json({ success: true, message: "Simulation stopped" });
    } catch (error: unknown) {
        console.error("Error:", error);
        res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ success: false, error: "Failed to stop simulation" });
    }
};

/**
 * POST /api/topologies/:topologyId/simulations/:simulationId/unload
 */
export const unloadSimulation = async (req: Request, res: Response): Promise<void> => {
    try {
        const { simulationId } = req.params;
        if(!simulationId) {
            res.status(StatusCodes.BAD_REQUEST).json({ success: false, error: "Topology ID and simulation ID are required" });
            return;
        }
        const runtime = activeSimulations.get(simulationId);
        
        if (!runtime) {
            res.status(StatusCodes.NOT_FOUND).json({ success: false, error: "Simulation not loaded" });
            return;
        }

        runtime.isRunning = false;
        activeSimulations.delete(simulationId);

        res.json({ success: true, message: "Simulation unloaded" });
    } catch (error: unknown) {
        console.error("Error:", error);
        res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ success: false, error: "Failed to unload simulation" });
    }
};

/**
 * DELETE /api/topologies/:topologyId/simulations/:simulationId
 */
export const deleteSimulation = async (req: Request, res: Response): Promise<void> => {
    try {
        const { topologyId, simulationId } = req.params;

        if (!topologyId || !simulationId) {
            res.status(StatusCodes.BAD_REQUEST).json({ success: false, error: "Topology ID and simulation ID are required" });
            return;
        }
        const simulation = await prisma.simulationSession.findUnique({ where: { id: simulationId } });
        if (!simulation || simulation.topologyId !== topologyId) {
            res.status(StatusCodes.NOT_FOUND).json({ success: false, error: "Simulation not found" });
            return;
        }

        const runtime = activeSimulations.get(simulationId);
        if (runtime) {
            runtime.isRunning = false;
            activeSimulations.delete(simulationId);
        }

        await prisma.simulationSession.delete({ where: { id: simulationId } });

        res.json({
            success: true,
            message: "Simulation deleted",
            deleted: { id: simulation.id, name: simulation.name }
        });
    } catch (error: unknown) {
        console.error("Error:", error);
        res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ success: false, error: "Failed to delete simulation" });
    }
};