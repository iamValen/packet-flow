import type { Request, Response } from "express";
import { AppError, asyncHandler } from "../middleware/errorHandler.js";
import NodeService from "../services/NodeService.js";
import { StatusCodes } from "http-status-codes";

class NodeController {
    // GET /topologies/:topologyId/nodes
    getAll = asyncHandler(async (req: Request, res: Response) => {
        if(!req.params.topologyId)
            throw new AppError(StatusCodes.BAD_REQUEST, "Topology id is required");
        
        const { topology, nodes } = await NodeService.getAll(req.params.topologyId);
        res.json({ success: true, topology, nodes });
    });

    // GET /topologies/:topologyId/nodes/:nodeId
    getById = asyncHandler(async (req: Request, res: Response) => {
        if(!req.params.topologyId || !req.params.nodeId)
            throw new AppError(StatusCodes.BAD_REQUEST, "Topology and node ids is required");
        const node = await NodeService.getById(req.params.topologyId, req.params.nodeId);
        res.json({ success: true, node });
    });

    // POST /topologies/:topologyId/nodes
    // body { name, type, positionX, positionY, defaultGateway }
    // type: "HOST" | "ROUTER" | "SWITCH"
    // defaultGateway: only for HOST - IP address of the router to use
    create = asyncHandler(async (req: Request, res: Response) => {
        if(!req.params.topologyId)
            throw new AppError(StatusCodes.BAD_REQUEST, "Topology id is required");

        const { name, type, positionX, positionY, defaultGateway } = req.body;
        const node = await NodeService.create(
            req.params.topologyId, name, type, positionX, positionY, defaultGateway
        );
        res.status(201).json({ success: true, node });
    });

    // PUT /topologies/:topologyId/nodes/:nodeId
    // body { name, defaultGateway }
    update = asyncHandler(async (req: Request, res: Response) => {
        if(!req.params.topologyId || !req.params.nodeId)
            throw new AppError(StatusCodes.BAD_REQUEST, "Topology and node ids is required");

        const { name, defaultGateway } = req.body;
        const node = await NodeService.update(
            req.params.topologyId, req.params.nodeId, name, defaultGateway
        );
        res.json({ success: true, node });
    });

    // PUT /topologies/:topologyId/nodes/:nodeId/position
    // body { positionX, positionY }
    // called when user drags node on canvas
    updatePosition = asyncHandler(async (req: Request, res: Response) => {
        if(!req.params.topologyId || !req.params.nodeId)
            throw new AppError(StatusCodes.BAD_REQUEST, "Topology and node ids is required");

        const { positionX, positionY } = req.body;
        const node = await NodeService.updatePosition(
            req.params.topologyId, req.params.nodeId, positionX, positionY
        );
        res.json({ success: true, node });
    });

    // DELETE /topologies/:topologyId/nodes/:nodeId
    // also deletes associated interfaces and links
    delete = asyncHandler(async (req: Request, res: Response) => {
        if(!req.params.topologyId || !req.params.nodeId)
            throw new AppError(StatusCodes.BAD_REQUEST, "Topology and node ids is required");

        const deleted = await NodeService.delete(req.params.topologyId, req.params.nodeId);
        res.json({ success: true, deleted });
    });
}

export default new NodeController();