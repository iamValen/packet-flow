import { StatusCodes } from "http-status-codes";
import { prisma } from "../prisma.js";
import { AppError } from "../middleware/errorHandler.js";
import { NetworkInterface } from "../models/NetworkInterface.js";

class FirewallService {
    async getAllFirewallRules(nodeId: string) {
        if (!nodeId) {
            throw new AppError(StatusCodes.BAD_REQUEST, "Node ID is required");
        }

        const node = await prisma.node.findUnique({
            where: { id: nodeId },
            include: { topology: { select: { id: true, name: true } } }
        });

        if (!node) {
            throw new AppError(StatusCodes.NOT_FOUND, "Node not found");
        }

        if (node.type !== "ROUTER") {
            throw new AppError(StatusCodes.BAD_REQUEST, "Only routers can have firewall rules");
        }

        const rules = await prisma.firewallRule.findMany({
            where: { nodeId },
            orderBy: { priority: 'asc' }
        });

        return { node, rules };
    }

    async createFirewallRule(nodeId: string, srcIp: string, dstIp: string, protocol: string | null, action: string, priority: number) {
        if (!nodeId) {
            throw new AppError(StatusCodes.BAD_REQUEST, "Node ID is required");
        }

        if (!srcIp || !dstIp || !action) {
            throw new AppError(StatusCodes.BAD_REQUEST, "srcIp, dstIp, and action are required");
        }

        if (srcIp !== "any" && !NetworkInterface.isValidIP(srcIp)) {
            throw new AppError(StatusCodes.BAD_REQUEST, `Invalid source IP: ${srcIp}`);
        }

        if (dstIp !== "any" && !NetworkInterface.isValidIP(dstIp)) {
            throw new AppError(StatusCodes.BAD_REQUEST, `Invalid destination IP: ${dstIp}`);
        }

        if (!["ALLOW", "DROP"].includes(action)) {
            throw new AppError(StatusCodes.BAD_REQUEST, "Action must be \"ALLOW\" or \"DROP\"");
        }

        if (protocol && !["TCP", "UDP", "ICMP", "ARP"].includes(protocol)) {
            throw new AppError(StatusCodes.BAD_REQUEST, "Protocol must be \"TCP\", \"UDP\", \"ICMP\", or \"ARP\"");
        }

        const node = await prisma.node.findUnique({
            where: { id: nodeId }
        });

        if (!node) {
            throw new AppError(StatusCodes.NOT_FOUND, "Node not found");
        }

        if (node.type !== "ROUTER") {
            throw new AppError(StatusCodes.BAD_REQUEST, "Only routers can have firewall rules");
        }

        const rule = await prisma.firewallRule.create({
            data: {
                srcIp,
                dstIp,
                protocol: protocol as "TCP" | "UDP" | "ICMP" | "ARP" | null,
                action: action as "ALLOW" | "DROP",
                priority: Number(priority),
                nodeId
            }
        });

        return rule;
    }

    async updateFirewallRule(nodeId: string, ruleId: string, srcIp?: string, dstIp?: string, protocol?: string, action?: string, priority?: number) {
        if (!nodeId || !ruleId) {
            throw new AppError(StatusCodes.BAD_REQUEST, "Node ID and Rule ID are required");
        }

        const existing = await prisma.firewallRule.findUnique({
            where: { id: ruleId }
        });

        if (!existing) {
            throw new AppError(StatusCodes.NOT_FOUND, "Firewall rule not found");
        }

        if (existing.nodeId !== nodeId) {
            throw new AppError(StatusCodes.BAD_REQUEST, "Rule does not belong to this node");
        }

        const updateData: any = {};

        if (srcIp !== undefined) {
            if (srcIp !== "any" && !NetworkInterface.isValidIP(srcIp)) {
                throw new AppError(StatusCodes.BAD_REQUEST, `Invalid source IP: ${srcIp}`);
            }
            updateData.srcIp = srcIp;
        }

        if (dstIp !== undefined) {
            if (dstIp !== "any" && !NetworkInterface.isValidIP(dstIp)) {
                throw new AppError(StatusCodes.BAD_REQUEST, `Invalid destination IP: ${dstIp}`);
            }
            updateData.dstIp = dstIp;
        }

        if (protocol !== undefined) {
            updateData.protocol = protocol || null;
        }

        if (action !== undefined) {
            if (!["ALLOW", "DROP"].includes(action)) {
                throw new AppError(StatusCodes.BAD_REQUEST, "Action must be \"ALLOW\" or \"DROP\"");
            }
            updateData.action = action as "ALLOW" | "DROP";
        }

        if (priority !== undefined) {
            updateData.priority = Number(priority);
        }

        const rule = await prisma.firewallRule.update({
            where: { id: ruleId },
            data: updateData
        });

        return rule;
    }

    async deleteFirewallRule(nodeId: string, ruleId: string) {
        if (!nodeId || !ruleId) {
            throw new AppError(StatusCodes.BAD_REQUEST, "Node ID and Rule ID are required");
        }

        const rule = await prisma.firewallRule.findUnique({
            where: { id: ruleId }
        });

        if (!rule) {
            throw new AppError(StatusCodes.NOT_FOUND, "Firewall rule not found");
        }

        if (rule.nodeId !== nodeId) {
            throw new AppError(StatusCodes.BAD_REQUEST, "Rule does not belong to this node");
        }

        await prisma.firewallRule.delete({
            where: { id: ruleId }
        });

        return {
            id: rule.id,
            srcIp: rule.srcIp,
            dstIp: rule.dstIp,
            action: rule.action
        };
    }
}

export default new FirewallService();