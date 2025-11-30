import type { Request, Response } from "express";
import { StatusCodes } from "http-status-codes";

import { AppError, asyncHandler } from "../middleware/errorHandler.js";
import TopologyService from "../services/TopologyService.js";

class TopologyController {
    /**
     * GET /api/topologies
     */
    getAllTopologies = asyncHandler(async (req: Request, res: Response): Promise<void> => {
        const topologies = await TopologyService.getAllTopologies();

        res.json({
            success: true,
            count: topologies.length,
            topologies
        });
    });

    /**
     * GET /api/topologies/:id
     */
    getTopologyById = asyncHandler(async (req: Request, res: Response): Promise<void> => {
        const { id } = req.params;

        if (!id) {
            throw new AppError(StatusCodes.BAD_REQUEST, "Topology ID is required");
        }

        const topology = await TopologyService.getTopologyById(id);

        res.json({
            success: true,
            topology
        });
    });

    /**
     * POST /api/topologies
     * Body: { name: string, description?: string }
     */
    createTopology = asyncHandler(async (req: Request, res: Response): Promise<void> => {
        const { name, description } = req.body;
        const topology = await TopologyService.createTopology(name, description);

        res.status(StatusCodes.CREATED).json({
            success: true,
            message: "Topology created successfully",
            topology
        });
    });

    /**
     * PUT /api/topologies/:id
     * Body: { name?: string, description?: string }
     */
    updateTopology = asyncHandler(async (req: Request, res: Response): Promise<void> => {
        const { id } = req.params;

        if (!id) {
            throw new AppError(StatusCodes.BAD_REQUEST, "Topology ID is required");
        }

        const { name, description } = req.body;
        const topology = await TopologyService.updateTopology(id, name, description);

        res.json({
            success: true,
            message: "Topology updated successfully",
            topology
        });
    });

    /**
     * DELETE /api/topologies/:id
     * Delete topology (cascades to nodes, links, etc.)
     */
    deleteTopology = asyncHandler(async (req: Request, res: Response): Promise<void> => {
        const { id } = req.params;

        if (!id) {
            throw new AppError(StatusCodes.BAD_REQUEST, "Topology ID is required");
        }

        const deleted = await TopologyService.deleteTopology(id);

        res.json({
            success: true,
            message: "Topology deleted successfully",
            deleted
        });
    });

    /**
     * GET /api/topologies/:id/nodes
     * Get all nodes in a topology
     */
    getTopologyNodes = asyncHandler(async (req: Request, res: Response): Promise<void> => {
        const { id } = req.params;

        if (!id) {
            throw new AppError(StatusCodes.BAD_REQUEST, "Topology ID is required");
        }

        const { topology, nodes } = await TopologyService.getTopologyNodes(id);

        res.json({
            success: true,
            topologyId: id,
            topologyName: topology.name,
            count: nodes.length,
            nodes
        });
    });
}

export default new TopologyController();