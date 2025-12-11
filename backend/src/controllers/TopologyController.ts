import type { Request, Response } from "express";
import { AppError, asyncHandler } from "../middleware/errorHandler.js";
import TopologyService from "../services/TopologyService.js";
import { StatusCodes } from "http-status-codes";

class TopologyController {
    // GET /topologies
    getAll = asyncHandler(async (req: Request, res: Response) => {
        const topologies = await TopologyService.getAll();
        res.json({ success: true, topologies });
    });

    // GET /topologies/:id
    getById = asyncHandler(async (req: Request, res: Response) => {
        if(!req.params.id)
            throw new AppError(StatusCodes.BAD_REQUEST, "Topology id is required");
        
        const topology = await TopologyService.getById(req.params.id);
        res.json({ success: true, topology });
    });

    // POST /topologies
    // body { name, description }
    create = asyncHandler(async (req: Request, res: Response) => {
        const { name, description } = req.body;
        const topology = await TopologyService.create(name, description);
        res.status(201).json({ success: true, topology });
    });

    // PUT /topologies/:id
    // body { name, description }
    update = asyncHandler(async (req: Request, res: Response) => {
        if(!req.params.id)
            throw new AppError(StatusCodes.BAD_REQUEST, "Topology id is required");

        const { name, description } = req.body;
        const topology = await TopologyService.update(req.params.id, name, description);
        res.json({ success: true, topology });
    });

    // DELETE /topologies/:id
    // cascade deletes all nodes, interfaces, links and simulations
    delete = asyncHandler(async (req: Request, res: Response) => {
        if(!req.params.id)
            throw new AppError(StatusCodes.BAD_REQUEST, "Topology id is required");

        const deleted = await TopologyService.delete(req.params.id);
        res.json({ success: true, deleted });
    });

    // GET /topologies/:id/nodes
    // get topology with all its nodes
    getNodes = asyncHandler(async (req: Request, res: Response) => {
        if(!req.params.id)
            throw new AppError(StatusCodes.BAD_REQUEST, "Topology id is required");
        
        const { topology, nodes } = await TopologyService.getNodes(req.params.id);
        res.json({ success: true, topology, nodes });
    });
}

export default new TopologyController();