import type { Request, Response } from "express";
import { PrismaClient } from "@prisma/client";
import { StatusCodes } from "http-status-codes";

import { NetworkInterface } from "../models/NetworkInterface.js";

import { AppError, asyncHandler } from "../middleware/errorHandler.js";

const prisma = new PrismaClient();

/**
 * GET /api/nodes/:nodeId/firewall/rules
 * Get all firewall rules for a router
 */
export const getAllFirewallRules = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { nodeId } = req.params;

    if(!nodeId)
        throw new AppError(StatusCodes.BAD_REQUEST, "Node ID is required");

    const node = await prisma.node.findUnique({
        where: { id: nodeId },
        include: { topology: { select: { id: true, name: true } } }
    });
    if(!node)
        throw new AppError(StatusCodes.NOT_FOUND, "Node not found");
    if(node.type !== "ROUTER")
        throw new AppError(StatusCodes.BAD_REQUEST, "Only routers can have firewall rules");

    const rules = await prisma.firewallRule.findMany({
        where: { nodeId },
        orderBy: { priority: 'asc' }
    });

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
export const createFirewallRule = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { nodeId } = req.params;
    const { srcIp, dstIp, protocol, action, priority = 100 } = req.body;

    if(!nodeId) 
        throw new AppError(StatusCodes.BAD_REQUEST, "Node ID is required");
    if(!srcIp || !dstIp || !action)
        throw new AppError(StatusCodes.BAD_REQUEST, "srcIp, dstIp, and action are required");

    // Validate IPs
    if(srcIp !== "any" && !NetworkInterface.isValidIP(srcIp))
        throw new AppError(StatusCodes.BAD_REQUEST, `Invalid source IP: ${srcIp}`);
    if(dstIp !== "any" && !NetworkInterface.isValidIP(dstIp))
        throw new AppError(StatusCodes.BAD_REQUEST, `Invalid destination IP: ${dstIp}`);

    // Validate action
    if(!["ALLOW", "DROP"].includes(action))
        throw new AppError(StatusCodes.BAD_REQUEST, "Action must be \"ALLOW\" or \"DROP\"");

    // Validate protocol if provided
    if(protocol && !["TCP", "UDP", "ICMP", "ARP"].includes(protocol))
        throw new AppError(StatusCodes.BAD_REQUEST, "Protocol must be \"TCP\", \"UDP\", \"ICMP\", or \"ARP\"");

    // Verify node exists and is a router
    const node = await prisma.node.findUnique({
        where: { id: nodeId }
    });
    if(!node)
        throw new AppError(StatusCodes.NOT_FOUND, "Node not found");
    if(node.type !== "ROUTER") 
        throw new AppError(StatusCodes.BAD_REQUEST, "Only routers can have firewall rules");

    const rule = await prisma.firewallRule.create({
        data: {
            srcIp,
            dstIp,
            protocol: protocol || null,
            action,
            priority: Number(priority),
            nodeId
        }
    });

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
export const updateFirewallRule = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { nodeId, ruleId } = req.params;
    const { srcIp, dstIp, protocol, action, priority } = req.body;

    if(!nodeId || !ruleId)
        throw new AppError(StatusCodes.BAD_REQUEST, "Node ID and Rule ID are required");

    const existing = await prisma.firewallRule.findUnique({
        where: { id: ruleId }
    });

    if(!existing)
        throw new AppError(StatusCodes.NOT_FOUND, "Firewall rule not found");
    if(existing.nodeId !== nodeId)
        throw new AppError(StatusCodes.BAD_REQUEST, "Rule does not belong to this node");

    // Build update data
    const updateData: any = {};
    if(srcIp !== undefined) {
        if(srcIp !== "any" && !NetworkInterface.isValidIP(srcIp)) 
            throw new AppError(StatusCodes.BAD_REQUEST, `Invalid source IP: ${srcIp}`);    
        updateData.srcIp = srcIp;
    }
    if(dstIp !== undefined) {
        if(dstIp !== "any" && !NetworkInterface.isValidIP(dstIp))
            throw new AppError(StatusCodes.BAD_REQUEST, `Invalid destination IP: ${dstIp}`);    
        updateData.dstIp = dstIp;
    }
    if(protocol !== undefined) updateData.protocol = protocol || null;
    if(action !== undefined) {
        if(!["ALLOW", "DROP"].includes(action))
            throw new AppError(StatusCodes.BAD_REQUEST, "Action must be \"ALLOW\" or \"DROP\"");
        updateData.action = action;
    }
    if(priority !== undefined) updateData.priority = Number(priority);

    const rule = await prisma.firewallRule.update({
        where: { id: ruleId },
        data: updateData
    });

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
export const deleteFirewallRule = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { nodeId, ruleId } = req.params;

    if(!nodeId || !ruleId) 
        throw new AppError(StatusCodes.BAD_REQUEST, "Node ID and Rule ID are required");

    const rule = await prisma.firewallRule.findUnique({
        where: { id: ruleId }
    });

    if(!rule)
        throw new AppError(StatusCodes.NOT_FOUND, "Firewall rule not found");
    if(rule.nodeId !== nodeId)
        throw new AppError(StatusCodes.BAD_REQUEST, "Rule does not belong to this node");
    
    await prisma.firewallRule.delete({
        where: { id: ruleId }
    });

    res.json({
        success: true,
        message: "Firewall rule deleted successfully",
        deleted: {
            id: rule.id,
            srcIp: rule.srcIp,
            dstIp: rule.dstIp,
            action: rule.action
        }
    });
});