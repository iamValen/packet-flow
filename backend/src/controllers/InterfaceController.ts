import type { Request, Response } from "express";
import { AppError, asyncHandler } from "../middleware/errorHandler.js";
import InterfaceService from "../services/InterfaceService.js";
import { StatusCodes } from "http-status-codes";

class InterfaceController {
    // GET /nodes/:nodeId/interfaces
    getAll = asyncHandler(async (req: Request, res: Response) => {
        if(!req.params.nodeId)
            throw new AppError(StatusCodes.BAD_REQUEST, "Node id is required");

        const { node, interfaces } = await InterfaceService.getAll(req.params.nodeId);
        res.json({ success: true, node, interfaces });
    });

    // GET /nodes/:nodeId/interfaces/:interfaceId
    getById = asyncHandler(async (req: Request, res: Response) => {
        if(!req.params.nodeId || !req.params.interfaceId)
            throw new AppError(StatusCodes.BAD_REQUEST, "Node id is required");

        const iface = await InterfaceService.getById(req.params.nodeId, req.params.interfaceId);
        res.json({ success: true, interface: iface });
    });

    // POST /nodes/:nodeId/interfaces
    // body { ip, mask, cidr, mac } OR { cidr: "192.168.1.10/24" }
    // cidr notation is the recommended way - auto-calculates mask
    // mac is optional (its autgenerated if not provided)
    create = asyncHandler(async (req: Request, res: Response) => {
        if(!req.params.nodeId)
            throw new AppError(StatusCodes.BAD_REQUEST, "Node id is required");

        const { ip, mask, cidr, mac } = req.body;
        const iface = await InterfaceService.create(req.params.nodeId, ip, mask, cidr, mac);
        res.status(201).json({ success: true, interface: iface });
    });

    // PUT /nodes/:nodeId/interfaces/:interfaceId
    // body { ip, mask, cidr }
    update = asyncHandler(async (req: Request, res: Response) => {
    if(!req.params.nodeId || !req.params.interfaceId)
            throw new AppError(StatusCodes.BAD_REQUEST, "Node id is required");

        const { ip, mask, cidr } = req.body;
        const iface = await InterfaceService.update(
            req.params.nodeId, req.params.interfaceId, ip, mask, cidr
        );
        res.json({ success: true, interface: iface });
    });

    // DELETE /nodes/:nodeId/interfaces/:interfaceId
    delete = asyncHandler(async (req: Request, res: Response) => {
        if(!req.params.nodeId || !req.params.interfaceId)
            throw new AppError(StatusCodes.BAD_REQUEST, "Node id is required");

        const deleted = await InterfaceService.delete(req.params.nodeId, req.params.interfaceId);
        res.json({ success: true, deleted });
    });
}

export default new InterfaceController();