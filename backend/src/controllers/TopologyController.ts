import type { Request, Response } from "express";
import { AppError, asyncHandler } from "../middleware/errorHandler.js";
import TopologyService from "../services/TopologyService.js";
import { StatusCodes } from "http-status-codes";

class TopologyController {
    /**
     * GET /topologies
     * Returns all topologies.
     */
    getAll = asyncHandler(async (req: Request, res: Response) => {
        const topologies = await TopologyService.getAll();
        res.json({ success: true, topologies });
    });

    /**
     * GET /topologies/:id
     * Returns a topology by id, including nodes, links, and recent simulations.
     */
    getById = asyncHandler(async (req: Request, res: Response) => {
        if (!req.params.id)
            throw new AppError(StatusCodes.BAD_REQUEST, "Topology id is required");
        const topology = await TopologyService.getById(req.params.id);
        res.json({ success: true, topology });
    });

    /**
     * POST /topologies
     * Creates a new topology.
     * @body name - topology name
     * @body description - optional description
     */
    create = asyncHandler(async (req: Request, res: Response) => {
        const { name, description } = req.body;
        const topology = await TopologyService.create(name, description);
        res.status(201).json({ success: true, topology });
    });

    /**
     * PUT /topologies/:id
     * Updates a topology's name or description.
     * @body name - optional new name
     * @body description - optional new description
     */
    update = asyncHandler(async (req: Request, res: Response) => {
        if (!req.params.id)
            throw new AppError(StatusCodes.BAD_REQUEST, "Topology id is required");
        const { name, description } = req.body;
        const topology = await TopologyService.update(req.params.id, name, description);
        res.json({ success: true, topology });
    });

    /**
     * DELETE /topologies/:id
     * Deletes a topology and cascade-deletes all nodes, interfaces, links, and simulations.
     */
    delete = asyncHandler(async (req: Request, res: Response) => {
        if (!req.params.id)
            throw new AppError(StatusCodes.BAD_REQUEST, "Topology id is required");
        const deleted = await TopologyService.delete(req.params.id);
        res.json({ success: true, deleted });
    });

    /**
     * GET /topologies/:id/nodes
     * Returns a topology with all its nodes.
     */
    getNodes = asyncHandler(async (req: Request, res: Response) => {
        if (!req.params.id)
            throw new AppError(StatusCodes.BAD_REQUEST, "Topology id is required");
        const { topology, nodes } = await TopologyService.getNodes(req.params.id);
        res.json({ success: true, topology, nodes });
    });
}

export default new TopologyController();