import type { Request, Response } from "express";
import { PrismaClient } from "@prisma/client";
import { StatusCodes } from "http-status-codes";

import { AppError, asyncHandler } from "../middleware/errorHandler.js";
import { SimulationBuilder } from "./SimulationBuilder.js";
import { Packet, Protocol } from "../models/Packet.js";
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
    lastActivity: number;
}>();

// automatic cleanup of inactive simulations
const SIMULATION_TIMEOUT = 30 * 60 * 1000; // 30 minutes of inactivity
const CLEANUP_INTERVAL = 5 * 60 * 1000;    // Check every 5 minutes

/**
 * Runs in the background and removes simulations that haven't been used recently
 */
setInterval(() => {
    const now : number = Date.now();
    for (const [id, sim] of activeSimulations.entries()) {
        // cleanup simulations that are idle and havent been used 
        if (!sim.isRunning && (now - sim.lastActivity) > SIMULATION_TIMEOUT) {
            activeSimulations.delete(id);
            console.log(`Cleaned up inactive simulation: ${id}`);
        }
    }
}, CLEANUP_INTERVAL);

/**
 * Updates the last activity timestamp for a simulation
 */
function updateTimestamp(simulationId: string) {
    const runtime = activeSimulations.get(simulationId);
    if (runtime) runtime.lastActivity = Date.now();
}

/**
 * GET /api/topologies/:topologyId/simulations
 */
export const getAllSimulations = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { topologyId } = req.params;
    if (!topologyId)
        throw new AppError(StatusCodes.BAD_REQUEST, "Topology ID is required");
    
    const topology = await prisma.topology.findUnique({ where: { id: topologyId } });
    if (!topology)
        throw new AppError(StatusCodes.BAD_REQUEST, "Topology NOT FOUND");

    const simulations = await prisma.simulationSession.findMany({
        where: { topologyId },
        orderBy: { createdAt: 'desc' }
    });

    // Touch any runtime entries that are looked up
    simulations.forEach(sim => {
        if (activeSimulations.has(sim.id)) updateTimestamp(sim.id);
    });

    res.json({
        simulations: simulations.map(sim => ({
            ...sim,
            isActive: activeSimulations.has(sim.id),
            runtimeStatus: activeSimulations.get(sim.id)?.isRunning ? 'RUNNING' : 'IDLE'
        }))
    });
});

/**
 * POST /api/topologies/:topologyId/simulations
 * Body: { name?: string, autoPopulateARP?: boolean, stepDelay?: number }
 */
export const createSimulation = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { topologyId } = req.params;
    const { name, autoPopulateARP = false, stepDelay = 1000 } = req.body;

    if (!topologyId) {
        throw new AppError(StatusCodes.BAD_REQUEST, "Topology ID is required");
    }

    const topology = await prisma.topology.findUnique({ where: { id: topologyId } });
    if (!topology) {
        throw new AppError(StatusCodes.NOT_FOUND, "Topology not found");
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

    const { topology: runtimeTopology, nodeMap: nodeMap, interfaceMap: interfaceMap } = 
        await SimulationBuilder.buildFromDatabase(topologyId, autoPopulateARP);

    activeSimulations.set(simulation.id, {
        topology: runtimeTopology,
        nodeMap,
        interfaceMap,
        isRunning: false,
        lastActivity: Date.now()
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
});

/**
 * GET /api/topologies/:topologyId/simulations/:simulationId
 */
export const getSimulationById = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { topologyId, simulationId } = req.params;
    if (!topologyId || !simulationId) {
        throw new AppError(StatusCodes.BAD_REQUEST, "Topology ID and simulation ID are required");
    }

    const simulation = await prisma.simulationSession.findUnique({
        where: { id: simulationId },
        include: { topology: { select: { id: true, name: true } } }
    });

    if (!simulation || simulation.topologyId !== topologyId) {
        throw new AppError(StatusCodes.NOT_FOUND, "Simulation not found");
    }

    updateTimestamp(simulationId);

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
});

/**
 * POST /api/topologies/:topologyId/simulations/:simulationId/load
 * Loads a simulation into memory
 * Body: { autoPopulateARP?: boolean }
 */
export const loadSimulation = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { topologyId, simulationId } = req.params;
    const { autoPopulateARP = false } = req.body;

    if (!topologyId || !simulationId) {
        throw new AppError(StatusCodes.BAD_REQUEST, "Topology ID and simulation ID are required");
    }

    const simulation = await prisma.simulationSession.findUnique({ where: { id: simulationId } });
    if (!simulation || simulation.topologyId !== topologyId) {
        throw new AppError(StatusCodes.NOT_FOUND, "Simulation not found");
    }

    if (activeSimulations.has(simulationId)) {
        throw new AppError(StatusCodes.CONFLICT, "Already loaded");
    }

    const { topology: runtimeTopology, nodeMap, interfaceMap } = 
        await SimulationBuilder.buildFromDatabase(topologyId, autoPopulateARP);

    activeSimulations.set(simulationId, {
        topology: runtimeTopology,
        nodeMap,
        interfaceMap,
        isRunning: false,
        lastActivity: Date.now()
    });

    res.json({
        success: true,
        message: "Simulation loaded",
        runtime: {
            nodesCount: runtimeTopology.nodes.length,
            linksCount: runtimeTopology.links.length
        }
    });
});

/**
 * POST /api/topologies/:topologyId/simulations/:simulationId/send-packet
 * Simulate packet sending from a host 
 * (it will not be sent immediately, needs step or run to complete sending)
 * Body: { sourceNodeId: string, destinationIp: string, protocol: string, payload: string }
 */
export const sendPacket = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { simulationId } = req.params;
    const { sourceNodeId, destinationIp, protocol, payload } = req.body;

    if (!simulationId)
        throw new AppError(StatusCodes.BAD_REQUEST, "Topology ID and simulation ID are required");

    const runtime = activeSimulations.get(simulationId);
    if (!runtime) 
        throw new AppError(StatusCodes.NOT_FOUND, "Simulation not loaded");


    // update timestamp after 
    updateTimestamp(simulationId);

    const sourceNode: Node | undefined = runtime.nodeMap.get(sourceNodeId);
    if (!sourceNode || !(sourceNode instanceof Host))
        throw new AppError(StatusCodes.BAD_REQUEST, "Source node must be a Host");

    const packet: Packet | undefined = runtime.topology.sendPacket(sourceNode, destinationIp, protocol as Protocol, payload);

    // update timestamp again after sending
    updateTimestamp(simulationId);

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
});

/**
 * POST /api/topologies/:topologyId/simulations/:simulationId/step
 * Runs a single simulation step
 */
export const simulationStep = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { simulationId } = req.params;
    if (!simulationId) {
        throw new AppError(StatusCodes.BAD_REQUEST, "Topology ID and simulation ID are required");
    }

    const runtime = activeSimulations.get(simulationId);
    if (!runtime) {
        throw new AppError(StatusCodes.NOT_FOUND, "Simulation not loaded");
    }

    // update runtime on user action
    updateTimestamp(simulationId);

    runtime.topology.step();
    const packetsInFlight = runtime.topology.getPacketsInFlight();

    // Touch runtime after step too
    updateTimestamp(simulationId);

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
});

/**
 * POST /api/topologies/:topologyId/simulations/:simulationId/run
 * Runs the simulation
 * Body: { stepDelay: number, maxSteps: number }
 */
export const runSimulation = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { simulationId } = req.params;
    const { stepDelay = 100, maxSteps = 100 } = req.body;

    if (!simulationId) {
        throw new AppError(StatusCodes.BAD_REQUEST, "Topology ID and simulation ID are required");
    }

    const runtime = activeSimulations.get(simulationId);
    if (!runtime) {
        throw new AppError(StatusCodes.NOT_FOUND, "Simulation not loaded");
    }

    if (runtime.isRunning) {
        throw new AppError(StatusCodes.CONFLICT, "Already running");
    }

    runtime.isRunning = true;
    updateTimestamp(simulationId);
    await prisma.simulationSession.update({ where: { id: simulationId }, data: { status: "RUNNING" } });

    let steps = 0;
    const startTime = Date.now();

    try {
        while (runtime.topology.getPacketsInFlight().length > 0 && steps < maxSteps && runtime.isRunning) {
            runtime.topology.step();
            steps++;
            updateTimestamp(simulationId); // activity during run
            // allow other operations to run
            await new Promise(resolve => setTimeout(resolve, stepDelay));
        }

        await prisma.simulationSession.update({ where: { id: simulationId }, data: { status: "COMPLETED" } });

        // final touch
        updateTimestamp(simulationId);

        res.json({
            success: true,
            steps,
            duration: Date.now() - startTime,
            packetsRemaining: runtime.topology.getPacketsInFlight().length
        });
    } finally {
        runtime.isRunning = false;
        updateTimestamp(simulationId);
    }
});

/**
 * POST /api/topologies/:topologyId/simulations/:simulationId/stop
 * Stop the simulation
 */
export const stopSimulation = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { simulationId } = req.params;
    if(!simulationId) {
        throw new AppError(StatusCodes.BAD_REQUEST, "Topology ID and simulation ID are required");
    }

    const runtime = activeSimulations.get(simulationId);
    if (!runtime) {
        throw new AppError(StatusCodes.NOT_FOUND, "Simulation not loaded");
    }

    runtime.isRunning = false;
    updateTimestamp(simulationId);
    await prisma.simulationSession.update({ where: { id: simulationId }, data: { status: "IDLE" } });

    res.json({ success: true, message: "Simulation stopped" });
});

/**
 * POST /api/topologies/:topologyId/simulations/:simulationId/unload
 * Unloads the simulation from memory
 */
export const unloadSimulation = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { simulationId } = req.params;
    if(!simulationId) {
        throw new AppError(StatusCodes.BAD_REQUEST, "Topology ID and simulation ID are required");
    }

    const runtime = activeSimulations.get(simulationId);
    if (!runtime) {
        throw new AppError(StatusCodes.NOT_FOUND, "Simulation not loaded");
    }

    runtime.isRunning = false;
    activeSimulations.delete(simulationId);

    res.json({ success: true, message: "Simulation unloaded" });
});

/**
 * DELETE /api/topologies/:topologyId/simulations/:simulationId
 */
export const deleteSimulation = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { topologyId, simulationId } = req.params;

    if (!topologyId || !simulationId) {
        throw new AppError(StatusCodes.BAD_REQUEST, "Topology ID and simulation ID are required");
    }

    const simulation = await prisma.simulationSession.findUnique({ where: { id: simulationId } });
    if (!simulation || simulation.topologyId !== topologyId) {
        throw new AppError(StatusCodes.NOT_FOUND, "Simulation not found");
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
});
