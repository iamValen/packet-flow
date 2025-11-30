import type { Request, Response } from "express";
import { StatusCodes } from "http-status-codes";
import { asyncHandler, AppError } from "../middleware/errorHandler.js";
import NodeService from "../services/NodeService.js";

class NodeController {
    /**
     * GET /api/topologies/:topologyId/nodes
     * Get all nodes in a topology
     */
    getAllNodes = asyncHandler(async (req: Request, res: Response): Promise<void> => {
        const { topologyId } = req.params;

        if (!topologyId)
            throw new AppError(StatusCodes.BAD_REQUEST, "Topology ID is required");

        const { topology, nodes } = await NodeService.getAllNodes(topologyId);

        res.json({
            success: true,
            topologyId,
            topologyName: topology.name,
            count: nodes.length,
            nodes
        });
    });

    /**
     * GET /api/topologies/:topologyId/nodes/:nodeId
     * Get a single node by ID
     */
    getNodeById = asyncHandler(async (req: Request, res: Response): Promise<void> => {
        const { topologyId, nodeId } = req.params;

        if (!topologyId || !nodeId) {
            throw new AppError(StatusCodes.BAD_REQUEST, "Topology ID and Node ID are required");
        }

        const node = await NodeService.getNodeById(topologyId, nodeId);

        res.json({
            success: true,
            node
        });
    });

    /**
     * POST /api/topologies/:topologyId/nodes
     * Create a new node in a topology
     * Body: { name: string, type: NodeType, positionX: number, positionY: number, defaultGateway?: string }
     */
    createNode = asyncHandler(async (req: Request, res: Response): Promise<void> => {
        const { topologyId } = req.params;

        if (!topologyId) {
            throw new AppError(StatusCodes.BAD_REQUEST, "Topology ID is required");
        }

        const { name, type, positionX, positionY, defaultGateway } = req.body;
        
        const node = await NodeService.createNode(topologyId, name, type, positionX, positionY, defaultGateway);

        res.status(StatusCodes.CREATED).json({
            success: true,
            message: "Node created successfully",
            node
        });
    });

    /**
     * PUT /api/topologies/:topologyId/nodes/:nodeId
     * Update a node data
     * Body: { name?: string, defaultGateway?: string }
     */
    updateNode = asyncHandler(async (req: Request, res: Response): Promise<void> => {
        const { topologyId, nodeId } = req.params;

        if (!topologyId || !nodeId) {
            throw new AppError(StatusCodes.BAD_REQUEST, "Topology ID and Node ID are required");
        }

        const { name, defaultGateway } = req.body;
        
        const node = await NodeService.updateNode(topologyId, nodeId, name, defaultGateway);

        res.json({
            success: true,
            message: "Node updated successfully",
            node
        });
    });

    /**
     * PUT /api/topologies/:topologyId/nodes/:nodeId/position
     * Update only the nodes position (for drag-and-drop in UI)
     * Body: { positionX: number, positionY: number }
     */
    updateNodePosition = asyncHandler(async (req: Request, res: Response): Promise<void> => {
        const { topologyId, nodeId } = req.params;

        if (!topologyId || !nodeId) {
            throw new AppError(StatusCodes.BAD_REQUEST, "Topology ID and Node ID are required");
        }

        const { positionX, positionY } = req.body;
        
        const node = await NodeService.updateNodePosition(topologyId, nodeId, positionX, positionY);

        res.json({
            success: true,
            message: "Node position updated successfully",
            node
        });
    });

    /**
     * DELETE /api/topologies/:topologyId/nodes/:nodeId
     * Delete a node from the topology
     */
    deleteNode = asyncHandler(async (req: Request, res: Response): Promise<void> => {
        const { topologyId, nodeId } = req.params;

        if (!topologyId || !nodeId) {
            throw new AppError(StatusCodes.BAD_REQUEST, "Topology ID and Node ID are required");
        }

        const deleted = await NodeService.deleteNode(topologyId, nodeId);

        res.json({
            success: true,
            message: "Node deleted successfully",
            deleted
        });
    });
}

export default new NodeController();