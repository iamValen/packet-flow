import type { Request, Response } from "express";
import { AppError, asyncHandler } from "../middleware/errorHandler.js";
import SimulationService from "../services/SimulationService.js";
import { StatusCodes } from "http-status-codes";

class SimulationController {
    /**
     * GET /topologies/:topologyId/simulations
     * Returns all simulation sessions for a topology.
     */
    getAllSimulations = asyncHandler(async (req: Request, res: Response) => {
        if (!req.params.topologyId)
            throw new AppError(StatusCodes.BAD_REQUEST, "Topology id is required");
        const sims = await SimulationService.getAll(req.params.topologyId);
        res.json({ success: true, simulations: sims });
    });

    /**
     * POST /topologies/:topologyId/simulations
     * Creates a new simulation and builds the topology in memory for packet processing.
     * @body name - optional simulation name
     * @body autoPopulateARP - if true, pre-fills ARP caches so packets skip ARP resolution
     */
    createSimulation = asyncHandler(async (req: Request, res: Response) => {
        if (!req.params.topologyId)
            throw new AppError(StatusCodes.BAD_REQUEST, "Topology id is required");
        const { name, autoPopulateARP } = req.body;
        const result = await SimulationService.create(req.params.topologyId, name, autoPopulateARP);
        res.status(201).json({ success: true, ...result });
    });

    /**
     * GET /topologies/:topologyId/simulations/:simulationId
     * Returns a simulation session by id.
     */
    getSimulationById = asyncHandler(async (req: Request, res: Response) => {
        if (!req.params.topologyId || !req.params.simulationId)
            throw new AppError(StatusCodes.BAD_REQUEST, "Topology and simulation IDs are required");
        const sim = await SimulationService.getById(req.params.topologyId, req.params.simulationId);
        res.json({ success: true, simulation: sim });
    });

    /**
     * POST /topologies/:topologyId/simulations/:simulationId/load
     * Loads an existing simulation session into memory for packet processing.
     * @body autoPopulateARP - if true, pre-fills ARP caches
     */
    loadSimulation = asyncHandler(async (req: Request, res: Response) => {
        if (!req.params.topologyId || !req.params.simulationId)
            throw new AppError(StatusCodes.BAD_REQUEST, "Topology and simulation IDs are required");
        const { autoPopulateARP } = req.body;
        const result = await SimulationService.load(
            req.params.topologyId, req.params.simulationId, autoPopulateARP
        );
        res.json({ success: true, ...result });
    });

    /**
     * POST /topologies/:topologyId/simulations/:simulationId/send-packet
     * Injects a new packet into the simulation from a HOST node.
     * @body sourceNodeId - ID of the source HOST node
     * @body destinationIp - target IP address
     * @body protocol - "ICMP" or "UDP"
     * @body payload - optional packet payload
     */
    sendPacket = asyncHandler(async (req: Request, res: Response) => {
        if (!req.params.simulationId)
            throw new AppError(StatusCodes.BAD_REQUEST, "Simulation id is required");
        const { sourceNodeId, destinationIp, protocol, payload } = req.body;
        const result = await SimulationService.sendPacket(
            req.params.simulationId, sourceNodeId, destinationIp, protocol, payload
        );
        res.json({ success: true, ...result });
    });

    /**
     * POST /topologies/:topologyId/simulations/:simulationId/step
     * Advances the simulation by one tick. Packets move to their next hop.
     * Returns current packet positions for animation.
     */
    simulationStep = asyncHandler(async (req: Request, res: Response) => {
        if (!req.params.simulationId)
            throw new AppError(StatusCodes.BAD_REQUEST, "Simulation id is required");
        const result = await SimulationService.step(req.params.simulationId);
        res.json({ success: true, ...result });
    });

    /**
     * POST /topologies/:topologyId/simulations/:simulationId/run
     * Runs the simulation continuously until all packets are delivered or maxSteps is reached.
     * @body stepDelay - delay in ms between steps
     * @body maxSteps - maximum number of steps before stopping
     */
    runSimulation = asyncHandler(async (req: Request, res: Response) => {
        if (!req.params.simulationId)
            throw new AppError(StatusCodes.BAD_REQUEST, "Simulation id is required");
        const { stepDelay, maxSteps } = req.body;
        const result = await SimulationService.run(req.params.simulationId, stepDelay, maxSteps);
        res.json({ success: true, ...result });
    });

    /**
     * POST /topologies/:topologyId/simulations/:simulationId/stop
     * Stops a running simulation.
     */
    stopSimulation = asyncHandler(async (req: Request, res: Response) => {
        if (!req.params.simulationId)
            throw new AppError(StatusCodes.BAD_REQUEST, "Simulation id is required");
        await SimulationService.stop(req.params.simulationId);
        res.json({ success: true, message: "stopped" });
    });

    /**
     * POST /topologies/:topologyId/simulations/:simulationId/unload
     * Removes the simulation from memory while keeping the database record.
     */
    unloadSimulation = asyncHandler(async (req: Request, res: Response) => {
        if (!req.params.simulationId)
            throw new AppError(StatusCodes.BAD_REQUEST, "Simulation id is required");
        await SimulationService.unload(req.params.simulationId);
        res.json({ success: true, message: "unloaded" });
    });

    /**
     * DELETE /topologies/:topologyId/simulations/:simulationId
     * Removes the simulation from memory and deletes the database record.
     */
    deleteSimulation = asyncHandler(async (req: Request, res: Response) => {
        if (!req.params.topologyId || !req.params.simulationId)
            throw new AppError(StatusCodes.BAD_REQUEST, "Topology and simulation IDs are required");
        const deleted = await SimulationService.delete(
            req.params.topologyId, req.params.simulationId
        );
        res.json({ success: true, deleted });
    });
}

export default new SimulationController();