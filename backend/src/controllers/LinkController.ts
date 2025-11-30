import type { Request, Response } from "express";
import { StatusCodes } from "http-status-codes";
import { asyncHandler, AppError } from "../middleware/errorHandler.js";
import LinkService from "../services/LinkService.js";

class LinkController {
    /**
     * GET /api/topologies/:topologyId/links
     */
    getAllLinks = asyncHandler(async (req: Request, res: Response): Promise<void> => {
        const { topologyId } = req.params;

        if (!topologyId)
            throw new AppError(StatusCodes.BAD_REQUEST, "Topology ID is required");

        const { topology, links } = await LinkService.getAllLinks(topologyId);

        res.json({
            success: true,
            topologyId,
            topologyName: topology.name,
            count: links.length,
            links
        });
    });

    /**
     * GET /api/topologies/:topologyId/links/:linkId
     */
    getLinkById = asyncHandler(async (req: Request, res: Response): Promise<void> => {
        const { topologyId, linkId } = req.params;

        if (!topologyId || !linkId)
            throw new AppError(StatusCodes.BAD_REQUEST, "Topology ID and Link ID are required");

        const link = await LinkService.getLinkById(topologyId, linkId);

        res.json({
            success: true,
            link
        });
    });

    /**
     * POST /api/topologies/:topologyId/links
     * Create a new link between two interfaces
     * Body: { interfaceAId: string, interfaceBId: string }
     */
    createLink = asyncHandler(async (req: Request, res: Response): Promise<void> => {
        const { topologyId } = req.params;

        if (!topologyId)
            throw new AppError(StatusCodes.BAD_REQUEST, "Topology ID is required");

        const { interfaceAId, interfaceBId } = req.body;

        const link = await LinkService.createLink(topologyId, interfaceAId, interfaceBId);

        res.status(StatusCodes.CREATED).json({
            success: true,
            message: "Link created successfully",
            link
        });
    });

    /**
     * DELETE /api/topologies/:topologyId/links/:linkId
     * Delete a link
     */
    deleteLink = asyncHandler(async (req: Request, res: Response): Promise<void> => {
        const { topologyId, linkId } = req.params;

        if (!topologyId || !linkId)
            throw new AppError(StatusCodes.BAD_REQUEST, "Topology ID and Link ID are required");

        const deleted = await LinkService.deleteLink(topologyId, linkId);

        res.json({
            success: true,
            message: "Link deleted successfully",
            deleted
        });
    });

    /**
     * GET /api/nodes/:nodeId/links
     * Get all links connected to a specific node
     */
    getLinksForNode = asyncHandler(async (req: Request, res: Response): Promise<void> => {
        const { nodeId } = req.params;

        if (!nodeId)
            throw new AppError(StatusCodes.BAD_REQUEST, "Node ID is required");

        const { node, links } = await LinkService.getLinksForNode(nodeId);

        res.json({
            success: true,
            nodeId,
            nodeName: node.name,
            topologyId: node.topology.id,
            topologyName: node.topology.name,
            count: links.length,
            links
        });
    });
}

export default new LinkController();