import { StatusCodes } from "http-status-codes";
import { prisma } from "../prisma.js";
import { AppError } from "../middleware/errorHandler.js";
import { NetworkInterface } from "../models/NetworkInterface.js";
import { Protocol } from "../models/Packet.js";
import { FirewallAction } from "../models/Firewall.js";

class FirewallService {
    /**
     * Returns all firewall rules for a node, ordered by priority.
     * @throws if the node does not exist or is not a ROUTER
     */
    async getAll(nodeId: string) {
        const node = await prisma.node.findUnique({
            where: { id: nodeId },
            include: { topology: { select: { id: true, name: true } } }
        });
        if (!node) throw new AppError(StatusCodes.NOT_FOUND, "node not found");
        if (node.type !== "ROUTER") throw new AppError(StatusCodes.BAD_REQUEST, "only routers have firewalls");

        const rules = await prisma.firewallRule.findMany({
            where: { nodeId },
            orderBy: { priority: "asc" }
        });
        return { node, rules };
    }

    /**
     * Returns a single firewall rule by id.
     * @throws if the rule does not exist or does not belong to the given node
     */
    async getById(nodeId: string, ruleId: string) {
        const rule = await prisma.firewallRule.findUnique({ where: { id: ruleId } });
        if (!rule) throw new AppError(StatusCodes.NOT_FOUND, "rule not found");
        if (rule.nodeId !== nodeId) throw new AppError(StatusCodes.BAD_REQUEST, "rule not on this node");
        return rule;
    }

    /**
     * Creates a new firewall rule on a router node.
     * @param nodeId - ID of the router node
     * @param srcIp - source filter: "any", a specific IP, or CIDR notation
     * @param dstIp - destination filter: "any", a specific IP, or CIDR notation
     * @param action - ALLOW or DROP
     * @param priority - rule priority (lower = checked first)
     * @param protocol - optional protocol filter
     * @throws if the node is not found, is not a ROUTER, or any field is invalid
     */
    async create(nodeId: string, srcIp: string, dstIp: string, action: FirewallAction, priority: number, protocol?: Protocol) {
        const node = await prisma.node.findUnique({ where: { id: nodeId } });
        if (!node) throw new AppError(StatusCodes.NOT_FOUND, "node not found");
        if (node.type !== "ROUTER") throw new AppError(StatusCodes.BAD_REQUEST, "only routers can have firewalls");

        if (!srcIp || !dstIp || !action)
            throw new AppError(StatusCodes.BAD_REQUEST, "srcIp, dstIp, action required");

        if (srcIp !== "any" && !NetworkInterface.isValidIP(srcIp) && !srcIp.includes("/"))
            throw new AppError(StatusCodes.BAD_REQUEST, `bad srcIp: ${srcIp}`);

        if (dstIp !== "any" && !NetworkInterface.isValidIP(dstIp) && !dstIp.includes("/"))
            throw new AppError(StatusCodes.BAD_REQUEST, `bad dstIp: ${dstIp}`);

        if (!Object.values(FirewallAction).includes(action))
            throw new AppError(StatusCodes.BAD_REQUEST, "action must be ALLOW or DROP");

        if (protocol !== undefined && !Object.values(Protocol).includes(protocol))
            throw new AppError(StatusCodes.BAD_REQUEST, "protocol must be ICMP, UDP, or ARP");

        return await prisma.firewallRule.create({
            data: {
                srcIp,
                dstIp,
                protocol: protocol as any || null,
                action: action as FirewallAction,
                priority: Number(priority) || 100,
                nodeId
            }
        });
    }

    /**
     * Updates an existing firewall rule. All fields are optional.
     * @throws if the rule is not found or does not belong to the given node
     */
    async update(nodeId: string, ruleId: string, srcIp?: string, dstIp?: string, action?: FirewallAction, priority?: number, protocol?: Protocol) {
        const rule = await prisma.firewallRule.findUnique({ where: { id: ruleId } });
        if (!rule) throw new AppError(StatusCodes.NOT_FOUND, "rule not found");
        if (rule.nodeId !== nodeId) throw new AppError(StatusCodes.BAD_REQUEST, "rule not on this node");

        const data: any = {};

        if (srcIp !== undefined) {
            if (srcIp !== "any" && !NetworkInterface.isValidIP(srcIp) && !srcIp.includes("/"))
                throw new AppError(StatusCodes.BAD_REQUEST, `bad srcIp: ${srcIp}`);
            data.srcIp = srcIp;
        }
        if (dstIp !== undefined) {
            if (dstIp !== "any" && !NetworkInterface.isValidIP(dstIp) && !dstIp.includes("/"))
                throw new AppError(StatusCodes.BAD_REQUEST, `bad dstIp: ${dstIp}`);
            data.dstIp = dstIp;
        }
        if (action !== undefined) {
            if (!Object.values(FirewallAction).includes(action))
                throw new AppError(StatusCodes.BAD_REQUEST, "action must be ALLOW or DROP");
            data.action = action;
        }
        if (priority !== undefined)
            data.priority = Number(priority);

        if (protocol !== undefined) {
            if (!Object.values(Protocol).includes(protocol))
                throw new AppError(StatusCodes.BAD_REQUEST, "protocol must be ICMP, UDP, or ARP");
            data.protocol = protocol || null;
        }

        return await prisma.firewallRule.update({ where: { id: ruleId }, data });
    }

    /**
     * Deletes a firewall rule.
     * @throws if the rule is not found or does not belong to the given node
     */
    async delete(nodeId: string, ruleId: string) {
        const rule = await prisma.firewallRule.findUnique({ where: { id: ruleId } });
        if (!rule) throw new AppError(StatusCodes.NOT_FOUND, "rule not found");
        if (rule.nodeId !== nodeId) throw new AppError(StatusCodes.BAD_REQUEST, "rule not on this node");

        await prisma.firewallRule.delete({ where: { id: ruleId } });
        return { id: rule.id, srcIp: rule.srcIp, dstIp: rule.dstIp, action: rule.action };
    }
}

export default new FirewallService();