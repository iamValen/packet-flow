import type { Request, Response } from "express";
import { AppError, asyncHandler } from "../middleware/errorHandler.js";
import LinkService from "../services/LinkService.js";
import { StatusCodes } from "http-status-codes";

class LinkController {
    // GET /topologies/:topologyId/links
    getAll = asyncHandler(async (req: Request, res: Response) => {
        if(!req.params.topologyId)
            throw new AppError(StatusCodes.BAD_REQUEST, "Topology id is required");

        const { topology, links } = await LinkService.getAll(req.params.topologyId);
        res.json({ success: true, topology, links });
    });

    // GET /topologies/:topologyId/links/:linkId
    getById = asyncHandler(async (req: Request, res: Response) => {
        if(!req.params.topologyId || !req.params.linkId)
            throw new AppError(StatusCodes.BAD_REQUEST, "Topology and link ids is required");

        const link = await LinkService.getById(req.params.topologyId, req.params.linkId);
        res.json({ success: true, link });
    });

    // POST /topologies/:topologyId/links
    // body: { interfaceAId: number, interfaceBId: number }
    create = asyncHandler(async (req: Request, res: Response) => {
        if(!req.params.topologyId)
            throw new AppError(StatusCodes.BAD_REQUEST, "Topology id is required");

        const { interfaceAId, interfaceBId } = req.body;
        const link = await LinkService.create(req.params.topologyId, interfaceAId, interfaceBId);
        res.status(201).json({ success: true, link });
    });

    // DELETE /topologies/:topologyId/links/:linkId
    delete = asyncHandler(async (req: Request, res: Response) => {
        if(!req.params.topologyId || !req.params.linkId)
            throw new AppError(StatusCodes.BAD_REQUEST, "Topology and link ids is required");

        const deleted = await LinkService.delete(req.params.topologyId, req.params.linkId);
        res.json({ success: true, deleted });
    });

    // GET /topologies/:topologyId/nodes/:nodeId/links
    getForNode = asyncHandler(async (req: Request, res: Response) => {
        if(!req.params.topologyId || !req.params.nodeId)
            throw new AppError(StatusCodes.BAD_REQUEST, "Topology and node id is required");

        const { node, links } = await LinkService.getForNode(req.params.nodeId);
        res.json({ success: true, node, links });
    });
}

export default new LinkController();