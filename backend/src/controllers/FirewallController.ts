import type { Request, Response } from "express";
import { PrismaClient } from "@prisma/client";
import { StatusCodes } from "http-status-codes";
import { NetworkInterface } from "../models/NetworkInterface.js";

const prisma = new PrismaClient();

/**
 * GET /api/nodes/:nodeId/firewall/rules
 * Get all firewall rules for a router
 */
export const getAllFirewallRules = async (req: Request, res: Response) => {
    try {
        const { nodeId } = req.params;

        if(!nodeId) {
            return res.status(StatusCodes.BAD_REQUEST).json({
                success: false,
                error: "Node ID is required"
            });
        }

        const node = await prisma.node.findUnique({
            where: { id: nodeId },
            include: { topology: { select: { id: true, name: true } } }
        });

        if(!node) {
            return res.status(StatusCodes.NOT_FOUND).json({
                success: false,
                error: "Node not found"
            });
        }

        if(node.type !== "ROUTER") {
            return res.status(StatusCodes.BAD_REQUEST).json({
                success: false,
                error: "Only routers can have firewall rules"
            });
        }

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
    } catch (error: any) {
        console.error("Error fetching firewall rules:", error);
        res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
            success: false,
            error: "Failed to fetch firewall rules",
            message: error.message
        });
    }
};

/**
 * POST /api/nodes/:nodeId/firewall/rules
 * Add a firewall rule to a router
 * Body: { srcIp: string, dstIp: string, protocol?: string, action: string, priority?: number }
 */
export const createFirewallRule = async (req: Request, res: Response) => {
    try {
        const { nodeId } = req.params;
        const { srcIp, dstIp, protocol, action, priority = 100 } = req.body;

        if(!nodeId) {
            return res.status(StatusCodes.BAD_REQUEST).json({
                success: false,
                error: "Node ID is required"
            });
        }

        if(!srcIp || !dstIp || !action) {
            return res.status(StatusCodes.BAD_REQUEST).json({
                success: false,
                error: "srcIp, dstIp, and action are required"
            });
        }

        // Validate IPs
        if(srcIp !== "any" && !NetworkInterface.isValidIP(srcIp)) {
            return res.status(StatusCodes.BAD_REQUEST).json({
                success: false,
                error: `Invalid source IP: ${srcIp}`
            });
        }

        if(dstIp !== "any" && !NetworkInterface.isValidIP(dstIp)){
            return res.status(StatusCodes.BAD_REQUEST).json({
                success: false,
                error: `Invalid destination IP: ${dstIp}`
            });
        }

        // Validate action
        if(!["ALLOW", "DROP"].includes(action)) {
            return res.status(StatusCodes.BAD_REQUEST).json({
                success: false,
                error: "Action must be either ALLOW or DROP"
            });
        }

        // Validate protocol if provided
        if(protocol && !["TCP", "UDP", "ICMP", "ARP"].includes(protocol)) {
            return res.status(StatusCodes.BAD_REQUEST).json({
                success: false,
                error: "Protocol must be TCP, UDP, ICMP, or ARP"
            });
        }

        // Verify node exists and is a router
        const node = await prisma.node.findUnique({
            where: { id: nodeId }
        });

        if(!node) {
            return res.status(StatusCodes.NOT_FOUND).json({
                success: false,
                error: "Node not found"
            });
        }

        if(node.type !== "ROUTER") {
            return res.status(StatusCodes.BAD_REQUEST).json({
                success: false,
                error: "Only routers can have firewall rules"
            });
        }

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
    } catch (error: any) {
        console.error("Error creating firewall rule:", error);
        res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
            success: false,
            error: "Failed to create firewall rule",
            message: error.message
        });
    }
};

/**
 * PUT /api/nodes/:nodeId/firewall/rules/:ruleId
 * Update a firewall rule
 */
export const updateFirewallRule = async (req: Request, res: Response) => {
    try {
        const { nodeId, ruleId } = req.params;
        const { srcIp, dstIp, protocol, action, priority } = req.body;

        if(!nodeId || !ruleId) {
            return res.status(StatusCodes.BAD_REQUEST).json({
                success: false,
                error: "Node ID and Rule ID are required"
            });
        }

        const existing = await prisma.firewallRule.findUnique({
            where: { id: ruleId }
        });

        if(!existing) {
            return res.status(StatusCodes.NOT_FOUND).json({
                success: false,
                error: "Firewall rule not found"
            });
        }

        if(existing.nodeId !== nodeId) {
            return res.status(StatusCodes.BAD_REQUEST).json({
                success: false,
                error: "Rule does not belong to this node"
            });
        }

        // Build update data
        const updateData: any = {};
        if(srcIp !== undefined) {
            if(srcIp !== "any" && !NetworkInterface.isValidIP(srcIp)) {
                return res.status(StatusCodes.BAD_REQUEST).json({
                    success: false,
                    error: `Invalid source IP: ${srcIp}`
                });
            }
            updateData.srcIp = srcIp;
        }
        if(dstIp !== undefined) {
            if(dstIp !== "any" && !NetworkInterface.isValidIP(dstIp)) {
                return res.status(StatusCodes.BAD_REQUEST).json({
                    success: false,
                    error: `Invalid destination IP: ${dstIp}`
                });
            }
            updateData.dstIp = dstIp;
        }
        if(protocol !== undefined) updateData.protocol = protocol || null;
        if(action !== undefined) {
            if(!["ALLOW", "DROP"].includes(action)) {
                return res.status(StatusCodes.BAD_REQUEST).json({
                    success: false,
                    error: "Action must be ALLOW or DROP"
                });
            }
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
    } catch (error: any) {
        console.error("Error updating firewall rule:", error);
        res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
            success: false,
            error: "Failed to update firewall rule",
            message: error.message
        });
    }
};

/**
 * DELETE /api/nodes/:nodeId/firewall/rules/:ruleId
 * Delete a firewall rule
 */
export const deleteFirewallRule = async (req: Request, res: Response) => {
    try {
        const { nodeId, ruleId } = req.params;

        if(!nodeId || !ruleId) {
            return res.status(StatusCodes.BAD_REQUEST).json({
                success: false,
                error: "Node ID and Rule ID are required"
            });
        }

        const rule = await prisma.firewallRule.findUnique({
            where: { id: ruleId }
        });

        if(!rule) {
            return res.status(StatusCodes.NOT_FOUND).json({
                success: false,
                error: "Firewall rule not found"
            });
        }

        if(rule.nodeId !== nodeId) {
            return res.status(StatusCodes.BAD_REQUEST).json({
                success: false,
                error: "Rule does not belong to this node"
            });
        }

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
    } catch (error: any) {
        console.error("Error deleting firewall rule:", error);
        res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
            success: false,
            error: "Failed to delete firewall rule",
            message: error.message
        });
    }
};