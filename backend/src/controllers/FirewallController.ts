import type { Request, Response } from "express";
import { StatusCodes } from "http-status-codes";
import { asyncHandler, AppError } from "../middleware/errorHandler.js";
import FirewallService from "../services/FirewallService.js";

class FirewallController {
    /**
     * GET /api/nodes/:nodeId/firewall/rules
     * Get all firewall rules for a router
     */
    getAllFirewallRules = asyncHandler(async (req: Request, res: Response): Promise<void> => {
        const { nodeId } = req.params;

        if (!nodeId)
            throw new AppError(StatusCodes.BAD_REQUEST, "Node ID is required");

        const { node, rules } = await FirewallService.getAllFirewallRules(nodeId);

        res.json({
            success: true,
            nodeId,
            nodeName: node.name,
            count: rules.length,
            rules
        });
    });

    /**
     * POST /api/nodes/:nodeId/firewall/rules
     * Add a firewall rule to a router
     * Body: { srcIp: string, dstIp: string, protocol?: string, action: string, priority?: number }
     */
    createFirewallRule = asyncHandler(async (req: Request, res: Response): Promise<void> => {
        const { nodeId } = req.params;

        if (!nodeId)
            throw new AppError(StatusCodes.BAD_REQUEST, "Node ID is required");

        const { srcIp, dstIp, protocol, action, priority = 100 } = req.body;

        const rule = await FirewallService.createFirewallRule(nodeId, srcIp, dstIp, protocol, action, priority);

        res.status(StatusCodes.CREATED).json({
            success: true,
            message: "Firewall rule created successfully",
            rule
        });
    });

    /**
     * PUT /api/nodes/:nodeId/firewall/rules/:ruleId
     * Update a firewall rule
     */
    updateFirewallRule = asyncHandler(async (req: Request, res: Response): Promise<void> => {
        const { nodeId, ruleId } = req.params;

        if (!nodeId || !ruleId)
            throw new AppError(StatusCodes.BAD_REQUEST, "Node ID and Rule ID are required");

        const { srcIp, dstIp, protocol, action, priority } = req.body;

        const rule = await FirewallService.updateFirewallRule(nodeId, ruleId, srcIp, dstIp, protocol, action, priority);

        res.json({
            success: true,
            message: "Firewall rule updated successfully",
            rule
        });
    });

    /**
     * DELETE /api/nodes/:nodeId/firewall/rules/:ruleId
     * Delete a firewall rule
     */
    deleteFirewallRule = asyncHandler(async (req: Request, res: Response): Promise<void> => {
        const { nodeId, ruleId } = req.params;

        if (!nodeId || !ruleId)
            throw new AppError(StatusCodes.BAD_REQUEST, "Node ID and Rule ID are required");

        const deleted = await FirewallService.deleteFirewallRule(nodeId, ruleId);

        res.json({
            success: true,
            message: "Firewall rule deleted successfully",
            deleted
        });
    });
}

export default new FirewallController();