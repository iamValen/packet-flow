import type { Request, Response } from "express";
import { StatusCodes } from "http-status-codes";
import { asyncHandler, AppError } from "../middleware/errorHandler.js";
import RoutingService from "../services/RoutingService.js";

class RoutingController {
    /**
     * GET /api/nodes/:nodeId/routes
     * Get all routing entries for a router
     */
    getAllRoutes = asyncHandler(async (req: Request, res: Response): Promise<void> => {
        const { nodeId } = req.params;

        if (!nodeId) {
            throw new AppError(StatusCodes.BAD_REQUEST, "Node ID is required");
        }

        const { node, routes } = await RoutingService.getAllRoutes(nodeId);

        res.json({
            success: true,
            nodeId,
            nodeName: node.name,
            count: routes.length,
            routes
        });
    });

    /**
     * POST /api/nodes/:nodeId/routes
     * Add a routing entry to a router
     * Body: { destination: string, mask: string, nextHopInterfaceId: string }
     */
    createRoute = asyncHandler(async (req: Request, res: Response): Promise<void> => {
        const { nodeId } = req.params;

        if (!nodeId) {
            throw new AppError(StatusCodes.BAD_REQUEST, "Node ID is required");
        }

        const { destination, mask, nextHopInterfaceId } = req.body;

        const route = await RoutingService.createRoute(nodeId, destination, mask, nextHopInterfaceId);

        res.status(StatusCodes.CREATED).json({
            success: true,
            message: "Route created successfully",
            route
        });
    });

    /**
     * DELETE /api/nodes/:nodeId/routes/:routeId
     * Delete a routing entry
     */
    deleteRoute = asyncHandler(async (req: Request, res: Response): Promise<void> => {
        const { nodeId, routeId } = req.params;

        if (!nodeId || !routeId) {
            throw new AppError(StatusCodes.BAD_REQUEST, "Node ID and Route ID are required");
        }

        const deleted = await RoutingService.deleteRoute(nodeId, routeId);

        res.json({
            success: true,
            message: "Route deleted successfully",
            deleted
        });
    });
}

export default new RoutingController();