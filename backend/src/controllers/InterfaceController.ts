import type { Request, Response } from "express";
import { AppError, asyncHandler } from "../middleware/errorHandler.js";
import InterfaceService from "../services/InterfaceService.js";
import { StatusCodes } from "http-status-codes";

class InterfaceController {
    /**
     * GET /nodes/:nodeId/interfaces
     * Returns all interfaces for a node.
     */
    getAll = asyncHandler(async (req: Request, res: Response) => {
        if (!req.params.nodeId)
            throw new AppError(StatusCodes.BAD_REQUEST, "nodeId is required");
        const { node, interfaces } = await InterfaceService.getAll(req.params.nodeId);
        res.json({ success: true, node, interfaces });
    });

    /**
     * GET /nodes/:nodeId/interfaces/:interfaceId
     * Returns a specific interface by id.
     */
    getById = asyncHandler(async (req: Request, res: Response) => {
        if (!req.params.nodeId || !req.params.interfaceId)
            throw new AppError(StatusCodes.BAD_REQUEST, "nodeId and interfaceId are required");
        const iface = await InterfaceService.getById(req.params.nodeId, req.params.interfaceId);
        res.json({ success: true, interface: iface });
    });

    /**
     * POST /nodes/:nodeId/interfaces
     * Creates a new network interface on a node.
     * @body ip - IP address
     * @body mask - subnet mask
     * @body cidr - CIDR notation alternative, e.g. "192.168.1.10/24"
     * @body mac - optional MAC address (auto-generated if not provided)
     */
    create = asyncHandler(async (req: Request, res: Response) => {
        if (!req.params.nodeId)
            throw new AppError(StatusCodes.BAD_REQUEST, "nodeId is required");
        const { ip, mask, cidr, mac } = req.body;
        const iface = await InterfaceService.create(req.params.nodeId, ip, mask, cidr, mac);
        res.status(201).json({ success: true, interface: iface });
    });

    /**
     * PUT /nodes/:nodeId/interfaces/:interfaceId
     * Updates a network interface's addressing.
     * @body ip - optional new IP address
     * @body mask - optional new subnet mask
     * @body cidr - optional CIDR notation
     */
    update = asyncHandler(async (req: Request, res: Response) => {
        if (!req.params.nodeId || !req.params.interfaceId)
            throw new AppError(StatusCodes.BAD_REQUEST, "nodeId and interfaceId are required");
        const { ip, mask, cidr } = req.body;
        const iface = await InterfaceService.update(
            req.params.nodeId, req.params.interfaceId, ip, mask, cidr
        );
        res.json({ success: true, interface: iface });
    });

    /**
     * DELETE /nodes/:nodeId/interfaces/:interfaceId
     * Deletes a network interface.
     */
    delete = asyncHandler(async (req: Request, res: Response) => {
        if (!req.params.nodeId || !req.params.interfaceId)
            throw new AppError(StatusCodes.BAD_REQUEST, "nodeId and interfaceId are required");
        const deleted = await InterfaceService.delete(req.params.nodeId, req.params.interfaceId);
        res.json({ success: true, deleted });
    });
}

export default new InterfaceController();