import type { Request, Response } from "express";
import { StatusCodes } from "http-status-codes";

import { AppError, asyncHandler } from "../middleware/errorHandler.js";
import SimulationService from "../services/SimulationService.js";

class SimulationController {

    /**
     * GET /api/topologies/:topologyId/simulations
     */
    getAllSimulations = asyncHandler(async (req: Request, res: Response): Promise<void> => {
        const { topologyId } = req.params;

        if (!topologyId) {
            throw new AppError(StatusCodes.BAD_REQUEST, "Topology ID is required");
        }

        const simulations = await SimulationService.getAllSimulations(topologyId);

        res.json({ simulations });
    });

    /**
     * POST /api/topologies/:topologyId/simulations
     * Body: { name?: string, autoPopulateARP?: boolean, stepDelay?: number }
     */
    createSimulation = asyncHandler(async (req: Request, res: Response): Promise<void> => {
        const { topologyId } = req.params;

        if (!topologyId) {
            throw new AppError(StatusCodes.BAD_REQUEST, "Topology ID is required");
        }

        const { name, autoPopulateARP, stepDelay } = req.body;

        const { simulation, runtimeInfo } = await SimulationService.createSimulation(topologyId, name, autoPopulateARP, stepDelay);

        res.status(StatusCodes.CREATED).json({
            success: true,
            message: "Simulation created",
            simulation: {
                ...simulation,
                isActive: true,
                runtimeInfo
            }
        });
    });

    /**
     * GET /api/topologies/:topologyId/simulations/:simulationId
     */
    getSimulationById = asyncHandler(async (req: Request, res: Response): Promise<void> => {
        const { topologyId, simulationId } = req.params;

        if (!topologyId || !simulationId) {
            throw new AppError(StatusCodes.BAD_REQUEST, "Topology ID and Simulation ID are required");
        }

        const simulation = await SimulationService.getSimulationById(topologyId, simulationId);

        res.json({
            success: true,
            simulation
        });
    });

    /**
     * POST /api/topologies/:topologyId/simulations/:simulationId/load
     * Loads a simulation into memory
     * Body: { autoPopulateARP?: boolean }
     */
    loadSimulation = asyncHandler(async (req: Request, res: Response): Promise<void> => {
        const { topologyId, simulationId } = req.params;

        if (!topologyId || !simulationId) {
            throw new AppError(StatusCodes.BAD_REQUEST, "Topology ID and Simulation ID are required");
        }

        const { autoPopulateARP } = req.body;

        const runtime = await SimulationService.loadSimulation(topologyId, simulationId, autoPopulateARP ?? false);

        res.json({
            success: true,
            message: "Simulation loaded",
            runtime
        });
    });

    /**
     * POST /api/topologies/:topologyId/simulations/:simulationId/send-packet
     * Simulate packet sending from a host 
     * Body: { sourceNodeId: string, destinationIp: string, protocol: string, payload: string }
     */
    sendPacket = asyncHandler(async (req: Request, res: Response): Promise<void> => {
        const { simulationId } = req.params;

        if (!simulationId) {
            throw new AppError(StatusCodes.BAD_REQUEST, "Simulation ID is required");
        }

        const { sourceNodeId, destinationIp, protocol, payload } = req.body;

        const result = await SimulationService.sendPacket(simulationId, sourceNodeId, destinationIp, protocol, payload);

        res.json({
            success: true,
            ...result
        });
    });

    /**
     * POST /api/topologies/:topologyId/simulations/:simulationId/step
     * Runs a single simulation step
     */
    simulationStep = asyncHandler(async (req: Request, res: Response): Promise<void> => {
        const { simulationId } = req.params;

        if (!simulationId) {
            throw new AppError(StatusCodes.BAD_REQUEST, "Simulation ID is required");
        }

        const result = await SimulationService.simulationStep(simulationId);

        res.json({
            success: true,
            ...result
        });
    });

    /**
     * POST /api/topologies/:topologyId/simulations/:simulationId/run
     * Runs the simulation
     * Body: { stepDelay: number, maxSteps: number }
     */
    runSimulation = asyncHandler(async (req: Request, res: Response): Promise<void> => {
        const { simulationId } = req.params;

        if (!simulationId) {
            throw new AppError(StatusCodes.BAD_REQUEST, "Simulation ID is required");
        }

        const { stepDelay, maxSteps } = req.body;

        const result = await SimulationService.runSimulation(simulationId, stepDelay, maxSteps);

        res.json({
            success: true,
            ...result
        });
    });

    /**
     * POST /api/topologies/:topologyId/simulations/:simulationId/stop
     * Stop the simulation
     */
    stopSimulation = asyncHandler(async (req: Request, res: Response): Promise<void> => {
        const { simulationId } = req.params;

        if (!simulationId) {
            throw new AppError(StatusCodes.BAD_REQUEST, "Simulation ID is required");
        }

        await SimulationService.stopSimulation(simulationId);

        res.json({ success: true, message: "Simulation stopped" });
    });

    /**
     * POST /api/topologies/:topologyId/simulations/:simulationId/unload
     * Unloads the simulation from memory
     */
    unloadSimulation = asyncHandler(async (req: Request, res: Response): Promise<void> => {
        const { simulationId } = req.params;

        if (!simulationId) {
            throw new AppError(StatusCodes.BAD_REQUEST, "Simulation ID is required");
        }

        await SimulationService.unloadSimulation(simulationId);

        res.json({ success: true, message: "Simulation unloaded" });
    });

    /**
     * DELETE /api/topologies/:topologyId/simulations/:simulationId
     */
    deleteSimulation = asyncHandler(async (req: Request, res: Response): Promise<void> => {
        const { topologyId, simulationId } = req.params;

        if (!topologyId || !simulationId) {
            throw new AppError(StatusCodes.BAD_REQUEST, "Topology ID and Simulation ID are required");
        }

        const deleted = await SimulationService.deleteSimulation(topologyId, simulationId);

        res.json({
            success: true,
            message: "Simulation deleted",
            deleted
        });
    });
}

export default new SimulationController();