import { StatusCodes } from "http-status-codes";
import { prisma } from "../prisma.js";
import { AppError } from "../middleware/errorHandler.js";
import { NetworkInterface } from "../models/NetworkInterface.js";

class NodeService {
    async getAllNodes(topologyId: string) {
        if (!topologyId)
            throw new AppError(StatusCodes.BAD_REQUEST, "Topology ID is required");

        const topology = await prisma.topology.findUnique({
            where: { id: topologyId }
        });

        if (!topology){
            throw new AppError(StatusCodes.NOT_FOUND, "Topology not found");
        }
        const nodes = await prisma.node.findMany({
            where: { topologyId },
            include: {
                interfaces: true,
                _count: {
                    select: {
                        interfaces: true,
                        linksAsA: true,
                        linksAsB: true
                    }
                }
            },
            orderBy: { createdAt: 'asc' }
        });

        return { topology, nodes };
    }

    async getNodeById(topologyId: string, nodeId: string) {
        if (!topologyId || !nodeId) {
            throw new AppError(StatusCodes.BAD_REQUEST, "Topology ID and Node ID are required");
        }

        const node = await prisma.node.findUnique({
            where: { id: nodeId },
            include: {
                topology: true,
                interfaces: true,
                routingEntries: {
                    include: { nextHopInterface: true }
                },
                firewallRules: true,
                _count: {
                    select: {
                        interfaces: true,
                        linksAsA: true,
                        linksAsB: true
                    }
                }
            }
        });

        if (!node) {
            throw new AppError(StatusCodes.NOT_FOUND, "Node not found");
        }

        if (node.topologyId !== topologyId) {
            throw new AppError(StatusCodes.BAD_REQUEST, "Node does not belong to this topology");
        }

        return node;
    }

    async createNode(topologyId: string, name: string, type: string, positionX: number, positionY: number, defaultGateway?: string) {
        if (!topologyId) {
            throw new AppError(StatusCodes.BAD_REQUEST, "Topology ID is required");
        }

        if (!name || !type) {
            throw new AppError(StatusCodes.BAD_REQUEST, "Name and type are required");
        }

        if (!["HOST", "ROUTER", "SWITCH"].includes(type)) {
            throw new AppError(StatusCodes.BAD_REQUEST, "Type must be HOST, ROUTER, or SWITCH");
        }

        if (positionX === undefined || positionY === undefined) {
            throw new AppError(StatusCodes.BAD_REQUEST, "Position X and Y are required");
        }

        const topology = await prisma.topology.findUnique({
            where: { id: topologyId }
        });

        if (!topology) {
            throw new AppError(StatusCodes.NOT_FOUND, "Topology not found");
        }

        if (defaultGateway && !NetworkInterface.isValidIP(defaultGateway)) {
            throw new AppError(StatusCodes.BAD_REQUEST, `Invalid default gateway IP: ${defaultGateway}`);
        }

        const node = await prisma.node.create({
            data: {
                name,
                type: type as "HOST" | "ROUTER" | "SWITCH",
                positionX: Number(positionX),
                positionY: Number(positionY),
                defaultGateway: defaultGateway || null,
                topologyId
            },
            include: {
                topology: true,
                interfaces: true
            }
        });

        return node;
    }

    async updateNode(topologyId: string, nodeId: string, name?: string, defaultGateway?: string) {
        if (!topologyId || !nodeId) {
            throw new AppError(StatusCodes.BAD_REQUEST, "Topology ID and Node ID are required");
        }

        const existing = await prisma.node.findUnique({
            where: { id: nodeId }
        });

        if (!existing) {
            throw new AppError(StatusCodes.NOT_FOUND, "Node not found");
        }

        if (existing.topologyId !== topologyId) {
            throw new AppError(StatusCodes.BAD_REQUEST, "Node does not belong to this topology");
        }

        const updateData: any = {};

        if (name !== undefined) {
            updateData.name = name;
        }

        if (defaultGateway !== undefined) {
            if (defaultGateway && !NetworkInterface.isValidIP(defaultGateway)) {
                throw new AppError(StatusCodes.BAD_REQUEST, `Invalid default gateway IP: ${defaultGateway}`);
            }
            updateData.defaultGateway = defaultGateway || null;
        }

        const node = await prisma.node.update({
            where: { id: nodeId },
            data: updateData,
            include: {
                topology: true,
                interfaces: true
            }
        });

        return node;
    }

    async updateNodePosition(topologyId: string, nodeId: string, positionX: number, positionY: number) {
        if (!topologyId || !nodeId) {
            throw new AppError(StatusCodes.BAD_REQUEST, "Topology ID and Node ID are required");
        }

        if (positionX === undefined || positionY === undefined) {
            throw new AppError(StatusCodes.BAD_REQUEST, "Position X and Y are required");
        }

        const existing = await prisma.node.findUnique({
            where: { id: nodeId }
        });

        if (!existing) {
            throw new AppError(StatusCodes.NOT_FOUND, "Node not found");
        }

        if (existing.topologyId !== topologyId) {
            throw new AppError(StatusCodes.BAD_REQUEST, "Node does not belong to this topology");
        }

        const node = await prisma.node.update({
            where: { id: nodeId },
            data: {
                positionX: Number(positionX),
                positionY: Number(positionY)
            },
            include: {
                topology: true,
                interfaces: true
            }
        });

        return node;
    }

    async deleteNode(topologyId: string, nodeId: string) {
        if (!topologyId || !nodeId) {
            throw new AppError(StatusCodes.BAD_REQUEST, "Topology ID and Node ID are required");
        }

        const node = await prisma.node.findUnique({
            where: { id: nodeId },
            include: {
                interfaces: true,
                _count: {
                    select: {
                        interfaces: true,
                        linksAsA: true,
                        linksAsB: true
                    }
                }
            }
        });

        if (!node) {
            throw new AppError(StatusCodes.NOT_FOUND, "Node not found");
        }

        if (node.topologyId !== topologyId) {
            throw new AppError(StatusCodes.BAD_REQUEST, "Node does not belong to this topology");
        }

        await prisma.node.delete({
            where: { id: nodeId }
        });

        return {
            id: node.id,
            name: node.name,
            type: node.type,
            interfacesCount: node._count.interfaces,
            linksCount: node._count.linksAsA + node._count.linksAsB
        };
    }
}

export default new NodeService();