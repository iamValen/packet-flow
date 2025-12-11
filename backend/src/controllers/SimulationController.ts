import type { Request, Response } from "express";
import { AppError, asyncHandler } from "../middleware/errorHandler.js";
import SimulationService from "../services/SimulationService.js";
import { StatusCodes } from "http-status-codes";

class SimulationController {
    // GET /topologies/:topologyId/simulations
    getAllSimulations = asyncHandler(async (req: Request, res: Response) => {
        if(!req.params.topologyId)
            throw new AppError(StatusCodes.BAD_REQUEST, "Topology id is required");
        
        const sims = await SimulationService.getAll(req.params.topologyId);
        res.json({ success: true, simulations: sims });
    });

    // POST /topologies/:topologyId/simulations
    // body { name, autoPopulateARP }
    // autoPopulateARP: if true, pre-fills ARP caches so packets dont need ARP resolution
    // creates a new simulation and builds the topology in memory for packet processing
    createSimulation = asyncHandler(async (req: Request, res: Response) => {
        if(!req.params.topologyId)
            throw new AppError(StatusCodes.BAD_REQUEST, "Topology id is required");
        
        const { name, autoPopulateARP } = req.body;
        const result = await SimulationService.create(req.params.topologyId, name, autoPopulateARP);
        res.status(201).json({ success: true, ...result });
    });

    // GET /topologies/:topologyId/simulations/:simulationId
    getSimulationById = asyncHandler(async (req: Request, res: Response) => {
        if(!req.params.topologyId || !req.params.simulationId)
            throw new AppError(StatusCodes.BAD_REQUEST, "Topology and simulation IDs are required");

        const sim = await SimulationService.getById(req.params.topologyId, req.params.simulationId);
        res.json({ success: true, simulation: sim });
    });

    // POST /topologies/:topologyId/simulations/:simulationId/load
    // body { autoPopulateARP }
    // loads an existing simulation session into memory for packet processing
    loadSimulation = asyncHandler(async (req: Request, res: Response) => {
        if(!req.params.topologyId || !req.params.simulationId)
            throw new AppError(StatusCodes.BAD_REQUEST, "Topology and simulation IDs are required");

        const { autoPopulateARP } = req.body;
        const result = await SimulationService.load(
            req.params.topologyId, req.params.simulationId, autoPopulateARP
        );
        res.json({ success: true, ...result });
    });

    // POST /topologies/:topologyId/simulations/:simulationId/send-packet
    // body { sourceNodeId, destinationIp, protocol, payload }
    // protocol: "ICMP" or "UDP" (TCP removed for simplicity)
    // injects a new packet into the simulation from a HOST node
    sendPacket = asyncHandler(async (req: Request, res: Response) => {
        if(!req.params.simulationId)
            throw new AppError(StatusCodes.BAD_REQUEST, "Simulation id is required");

        const { sourceNodeId, destinationIp, protocol, payload } = req.body;
        const result = await SimulationService.sendPacket(
            req.params.simulationId, sourceNodeId, destinationIp, protocol, payload
        );
        res.json({ success: true, ...result });
    });

    // POST /topologies/:topologyId/simulations/:simulationId/step
    // advances simulation by one tick - packets move to next hop
    // returns current packet positions for animation
    simulationStep = asyncHandler(async (req: Request, res: Response) => {
        if(!req.params.simulationId)
            throw new AppError(StatusCodes.BAD_REQUEST, "Simulation id is required");

        const result = await SimulationService.step(req.params.simulationId);
        res.json({ success: true, ...result });
    });

    // POST /topologies/:topologyId/simulations/:simulationId/run
    // body { stepDelay, maxSteps }
    // runs simulation continuously until all packets delivered or maxSteps reached
    runSimulation = asyncHandler(async (req: Request, res: Response) => {
        if(!req.params.simulationId)
            throw new AppError(StatusCodes.BAD_REQUEST, "Simulation id is required");

        const { stepDelay, maxSteps } = req.body;
        const result = await SimulationService.run(req.params.simulationId, stepDelay, maxSteps);
        res.json({ success: true, ...result });
    });

    // POST /topologies/:topologyId/simulations/:simulationId/stop
    // stops a running simulation
    stopSimulation = asyncHandler(async (req: Request, res: Response) => {
        if(!req.params.simulationId)
            throw new AppError(StatusCodes.BAD_REQUEST, "Simulation id is required");

        await SimulationService.stop(req.params.simulationId);
        res.json({ success: true, message: "stopped" });
    });

    // POST /topologies/:topologyId/simulations/:simulationId/unload
    // removes simulation from memory (keeps db record)
    unloadSimulation = asyncHandler(async (req: Request, res: Response) => {
        if(!req.params.simulationId)
            throw new AppError(StatusCodes.BAD_REQUEST, "Simulation id is required");

        await SimulationService.unload(req.params.simulationId);
        res.json({ success: true, message: "unloaded" });
    });

    // DELETE /topologies/:topologyId/simulations/:simulationId
    // removes from memory and deletes db record
    deleteSimulation = asyncHandler(async (req: Request, res: Response) => {
        if(!req.params.topologyId || !req.params.simulationId)
            throw new AppError(StatusCodes.BAD_REQUEST, "Topology and simulation IDs are required");

        const deleted = await SimulationService.delete(
            req.params.topologyId, req.params.simulationId
        );
        res.json({ success: true, deleted });
    });
}

export default new SimulationController();