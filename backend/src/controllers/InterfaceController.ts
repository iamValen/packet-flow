import type { Request, Response } from "express";
import { StatusCodes } from "http-status-codes";
import { asyncHandler, AppError } from "../middleware/errorHandler.js";
import InterfaceService from "../services/InterfaceService.js";

class InterfaceController {
    /**
     * GET /api/nodes/:nodeId/interfaces
     * Get all interfaces for a node
     */
    getAllInterfaces = asyncHandler(async (req: Request, res: Response): Promise<void> => {
        const { nodeId } = req.params;

        if (!nodeId)
            throw new AppError(StatusCodes.BAD_REQUEST, "Node ID is required");

        const { node, interfaces } = await InterfaceService.getAllInterfaces(nodeId);

        res.json({
            success: true,
            nodeId,
            nodeName: node.name,
            topologyId: node.topology.id,
            topologyName: node.topology.name,
            count: interfaces.length,
            interfaces
        });
    });

    /**
     * GET /api/nodes/:nodeId/interfaces/:interfaceId
     * Get a single interface by ID
     */
    getInterfaceById = asyncHandler(async (req: Request, res: Response): Promise<void> => {
        const { nodeId, interfaceId } = req.params;

        if (!nodeId || !interfaceId)
            throw new AppError(StatusCodes.BAD_REQUEST, "Node ID and Interface ID are required");

        const iface = await InterfaceService.getInterfaceById(nodeId, interfaceId);

        res.json({
            success: true,
            interface: iface
        });
    });

    /**
     * POST /api/nodes/:nodeId/interfaces
     * Create a new interface for a node
     * Body: { ip: string, mask: string, mac?: string } OR { cidr: string, mac?: string }
     */
    createInterface = asyncHandler(async (req: Request, res: Response): Promise<void> => {
        const { nodeId } = req.params;

        if (!nodeId)
            throw new AppError(StatusCodes.BAD_REQUEST, "Node ID is required");

        const { ip, mask, cidr, mac } = req.body;

        const iface = await InterfaceService.createInterface(nodeId, ip, mask, cidr, mac);

        res.status(StatusCodes.CREATED).json({
            success: true,
            message: "Interface created successfully",
            interface: iface
        });
    });

    /**
     * PUT /api/nodes/:nodeId/interfaces/:interfaceId
     * Update an interface
     * (MAC address cannot be changed after creation)
     * Body: { ip?: string, mask?: string, cidr?: string }
     */
    updateInterface = asyncHandler(async (req: Request, res: Response): Promise<void> => {
        const { nodeId, interfaceId } = req.params;

        if (!nodeId || !interfaceId)
            throw new AppError(StatusCodes.BAD_REQUEST, "Node ID and Interface ID are required");

        const { ip, mask, cidr } = req.body;

        const iface = await InterfaceService.updateInterface(nodeId, interfaceId, ip, mask, cidr);

        res.json({
            success: true,
            message: "Interface updated successfully",
            interface: iface
        });
    });

    /**
     * DELETE /api/nodes/:nodeId/interfaces/:interfaceId
     * Delete an interface
     */
    deleteInterface = asyncHandler(async (req: Request, res: Response): Promise<void> => {
        const { nodeId, interfaceId } = req.params;

        if (!nodeId || !interfaceId)
            throw new AppError(StatusCodes.BAD_REQUEST, "Node ID and Interface ID are required");

        const deleted = await InterfaceService.deleteInterface(nodeId, interfaceId);

        res.json({
            success: true,
            message: "Interface deleted successfully",
            deleted
        });
    });
}

export default new InterfaceController();