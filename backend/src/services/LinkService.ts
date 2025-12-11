import { StatusCodes } from "http-status-codes";

import { prisma } from "../prisma.js";
import { AppError } from "../middleware/errorHandler.js";

class LinkService {
    async getAll(topologyId: string) {
        const topo = await prisma.topology.findUnique({ where: { id: topologyId } });
        if (!topo) throw new AppError(StatusCodes.NOT_FOUND, "topology not found");

        const links = await prisma.link.findMany({
            where: { topologyId },
            include: {
                interfaceA: true,
                interfaceB: true,
                nodeA: { select: { id: true, name: true, type: true } },
                nodeB: { select: { id: true, name: true, type: true } }
            },
            orderBy: { createdAt: "asc" }
        });
        return { topology: topo, links };
    }

    async getById(topologyId: string, linkId: string) {
        const link = await prisma.link.findUnique({
            where: { id: linkId },
            include: { interfaceA: true, interfaceB: true, nodeA: true, nodeB: true }
        });
        if (!link) throw new AppError(StatusCodes.NOT_FOUND, "link not found");
        if (link.topologyId !== topologyId) throw new AppError(StatusCodes.BAD_REQUEST, "wrong topology");
        return link;
    }

    async create(topologyId: string, ifaceAId: string, ifaceBId: string) {
        if (!ifaceAId || !ifaceBId || ifaceAId === ifaceBId) {
            throw new AppError(StatusCodes.BAD_REQUEST, "need two different interfaces");
        }

        const topo = await prisma.topology.findUnique({ where: { id: topologyId } });
        if (!topo) throw new AppError(StatusCodes.NOT_FOUND, "topology not found");

        // get both interfaces
        const [ifaceA, ifaceB] = await Promise.all([
            prisma.networkInterface.findUnique({
                where: { id: ifaceAId },
                include: { node: { select: { id: true, name: true, topologyId: true } } }
            }),
            prisma.networkInterface.findUnique({
                where: { id: ifaceBId },
                include: { node: { select: { id: true, name: true, topologyId: true } } }
            })
        ]);

        if (!ifaceA || !ifaceB) throw new AppError(StatusCodes.BAD_REQUEST, "interface not found");
        if (ifaceA.node.topologyId !== topologyId || ifaceB.node.topologyId !== topologyId) {
            throw new AppError(StatusCodes.BAD_REQUEST, "interfaces must be in this topology");
        }
        if (ifaceA.node.id === ifaceB.node.id) {
            throw new AppError(StatusCodes.BAD_REQUEST, "cant link same node");
        }

        // check not already linked
        const existing = await prisma.link.findMany({
            where: {
                OR: [
                    { interfaceAId: ifaceAId },
                    { interfaceBId: ifaceAId },
                    { interfaceAId: ifaceBId },
                    { interfaceBId: ifaceBId }
                ]
            }
        });
        if (existing.length > 0) throw new AppError(409, "interface already linked");

        return await prisma.link.create({
            data: {
                interfaceAId: ifaceAId,
                interfaceBId: ifaceBId,
                nodeAId: ifaceA.node.id,
                nodeBId: ifaceB.node.id,
                topologyId
            },
            include: {
                interfaceA: true,
                interfaceB: true,
                nodeA: { select: { id: true, name: true, type: true } },
                nodeB: { select: { id: true, name: true, type: true } }
            }
        });
    }

    async delete(topologyId: string, linkId: string) {
        const link = await prisma.link.findUnique({
            where: { id: linkId },
            include: { nodeA: { select: { name: true } }, nodeB: { select: { name: true } } }
        });
        if (!link) throw new AppError(StatusCodes.NOT_FOUND, "link not found");
        if (link.topologyId !== topologyId) throw new AppError(StatusCodes.BAD_REQUEST, "wrong topology");

        await prisma.link.delete({ where: { id: linkId } });
        return { id: link.id, nodeA: link.nodeA.name, nodeB: link.nodeB.name };
    }

    async getForNode(nodeId: string) {
        const node = await prisma.node.findUnique({
            where: { id: nodeId },
            include: { topology: { select: { id: true, name: true } } }
        });
        if (!node) throw new AppError(StatusCodes.NOT_FOUND, "node not found");

        const links = await prisma.link.findMany({
            where: { OR: [{ nodeAId: nodeId }, { nodeBId: nodeId }] },
            include: { interfaceA: true, interfaceB: true, nodeA: true, nodeB: true }
        });
        return { node, links };
    }
}

export default new LinkService();