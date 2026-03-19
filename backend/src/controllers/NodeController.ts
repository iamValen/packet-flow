import type { Request, Response } from "express";
import { AppError, asyncHandler } from "../middleware/errorHandler.js";
import NodeService from "../services/NodeService.js";
import { StatusCodes } from "http-status-codes";

class NodeController {
    /**
     * GET /topologies/:topologyId/nodes
     * Returns all nodes in a topology.
     */
    getAll = asyncHandler(async (req: Request, res: Response) => {
        if (!req.params.topologyId)
            throw new AppError(StatusCodes.BAD_REQUEST, "Topology id is required");
        const { topology, nodes } = await NodeService.getAll(req.params.topologyId);
        res.json({ success: true, topology, nodes });
    });

    /**
     * GET /topologies/:topologyId/nodes/:nodeId
     * Returns a specific node by id.
     */
    getById = asyncHandler(async (req: Request, res: Response) => {
        if (!req.params.topologyId || !req.params.nodeId)
            throw new AppError(StatusCodes.BAD_REQUEST, "Topology and node ids are required");
        const node = await NodeService.getById(req.params.topologyId, req.params.nodeId);
        res.json({ success: true, node });
    });

    /**
     * POST /topologies/:topologyId/nodes
     * Creates a new node in a topology.
     * @body name - node display name
     * @body type - "HOST" | "ROUTER" | "SWITCH"
     * @body positionX - X position on canvas
     * @body positionY - Y position on canvas
     * @body defaultGateway - (HOST only) IP address of the gateway router
     */
    create = asyncHandler(async (req: Request, res: Response) => {
        if (!req.params.topologyId)
            throw new AppError(StatusCodes.BAD_REQUEST, "Topology id is required");
        const { name, type, positionX, positionY, defaultGateway } = req.body;
        const node = await NodeService.create(
            req.params.topologyId, name, type, positionX, positionY, defaultGateway
        );
        res.status(201).json({ success: true, node });
    });

    /**
     * PUT /topologies/:topologyId/nodes/:nodeId
     * Updates a node's name or default gateway
     * @body name - optional new name
     * @body defaultGateway - optional new gateway IP
     */
    update = asyncHandler(async (req: Request, res: Response) => {
        if (!req.params.topologyId || !req.params.nodeId)
            throw new AppError(StatusCodes.BAD_REQUEST, "Topology and node ids are required");
        const { name, defaultGateway } = req.body;
        const node = await NodeService.update(
            req.params.topologyId, req.params.nodeId, name, defaultGateway
        );
        res.json({ success: true, node });
    });

    /**
     * PUT /topologies/:topologyId/nodes/:nodeId/position
     * Updates a node's canvas position. Called when the user drags a node
     * @body positionX - new X coordinate
     * @body positionY - new Y coordinate
     */
    updatePosition = asyncHandler(async (req: Request, res: Response) => {
        if (!req.params.topologyId || !req.params.nodeId)
            throw new AppError(StatusCodes.BAD_REQUEST, "Topology and node ids are required");
        const { positionX, positionY } = req.body;
        const node = await NodeService.updatePosition(
            req.params.topologyId, req.params.nodeId, positionX, positionY
        );
        res.json({ success: true, node });
    });

    /**
     * DELETE /topologies/:topologyId/nodes/:nodeId
     * Deletes a node and cascades to its interfaces and links.
     */
    delete = asyncHandler(async (req: Request, res: Response) => {
        if (!req.params.topologyId || !req.params.nodeId)
            throw new AppError(StatusCodes.BAD_REQUEST, "Topology and node ids are required");
        const deleted = await NodeService.delete(req.params.topologyId, req.params.nodeId);
        res.json({ success: true, deleted });
    });
}

export default new NodeController();