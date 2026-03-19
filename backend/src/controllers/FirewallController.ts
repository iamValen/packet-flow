import { StatusCodes } from "http-status-codes";
import type { Request, Response } from "express";
import { AppError, asyncHandler } from "../middleware/errorHandler.js";
import FirewallService from "../services/FirewallService.js";

class FirewallController {
    /**
     * GET /nodes/:nodeId/rules
     * Returns all firewall rules for a specific node (must be ROUTER).
     */
    getAll = asyncHandler(async (req: Request, res: Response) => {
        if (!req.params.nodeId) throw new AppError(StatusCodes.BAD_REQUEST, "nodeId required");
        const { node, rules } = await FirewallService.getAll(req.params.nodeId);
        res.json({ success: true, node, rules });
    });

    /**
     * GET /nodes/:nodeId/rules/:ruleId
     * Returns a specific firewall rule by id.
     */
    getById = asyncHandler(async (req: Request, res: Response) => {
        if (!req.params.nodeId || !req.params.ruleId)
            throw new AppError(StatusCodes.BAD_REQUEST, "nodeId and ruleId required");
        const rule = await FirewallService.getById(req.params.nodeId, req.params.ruleId);
        res.json({ success: true, rule });
    });

    /**
     * POST /nodes/:nodeId/rules
     * Creates a new firewall rule on a router node.
     * @body srcIp - "any", a specific IP, or CIDR notation (e.g. "192.168.1.0/24")
     * @body dstIp - "any", a specific IP, or CIDR notation
     * @body action - "ALLOW" or "DROP"
     * @body priority - lower number = higher priority (checked first)
     * @body protocol - optional protocol filter
     */
    create = asyncHandler(async (req: Request, res: Response) => {
        if (!req.params.nodeId) throw new AppError(StatusCodes.BAD_REQUEST, "nodeId required");
        const { srcIp, dstIp, action, priority, protocol } = req.body;
        const rule = await FirewallService.create(
            req.params.nodeId, srcIp, dstIp, action, priority, protocol
        );
        res.status(201).json({ success: true, rule });
    });

    /**
     * PUT /nodes/:nodeId/rules/:ruleId
     * Updates an existing firewall rule. All fields are optional.
     * @body srcIp - optional
     * @body dstIp - optional
     * @body action - optional
     * @body priority - optional
     * @body protocol - optional
     */
    update = asyncHandler(async (req: Request, res: Response) => {
        if (!req.params.nodeId || !req.params.ruleId)
            throw new AppError(StatusCodes.BAD_REQUEST, "nodeId and ruleId required");
        const { srcIp, dstIp, action, priority, protocol } = req.body;
        const rule = await FirewallService.update(
            req.params.nodeId, req.params.ruleId,
            srcIp, dstIp, action, priority, protocol
        );
        res.json({ success: true, rule });
    });

    /**
     * DELETE /nodes/:nodeId/rules/:ruleId
     * Deletes a firewall rule.
     */
    delete = asyncHandler(async (req: Request, res: Response) => {
        if (!req.params.nodeId || !req.params.ruleId)
            throw new AppError(StatusCodes.BAD_REQUEST, "nodeId and ruleId required");
        const deleted = await FirewallService.delete(req.params.nodeId, req.params.ruleId);
        res.json({ success: true, deleted });
    });
}

export default new FirewallController();