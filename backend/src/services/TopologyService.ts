import { StatusCodes } from "http-status-codes";

import { prisma } from "../prisma.js";
import { AppError } from "../middleware/errorHandler.js";

// handles topology crud operations
class TopologyService {
    async getAll() {
        return await prisma.topology.findMany({
            include: {
                nodes: { include: { interfaces: true } },
                links: true,
                _count: { select: { nodes: true, links: true } }
            },
            orderBy: { updatedAt: "desc" }
        });
    }

    async getById(id: string) {
        const topo = await prisma.topology.findUnique({
            where: { id },
            include: {
                nodes: { include: { interfaces: true } },
                links: {
                    include: {
                        interfaceA: true,
                        interfaceB: true,
                        nodeA: true,
                        nodeB: true
                    }
                },
                simulations: { orderBy: { createdAt: "desc" }, take: 5 }
            }
        });
        if (!topo) throw new AppError(StatusCodes.NOT_FOUND, "topology not found");
        return topo;
    }

    async create(name: string, description?: string) {
        if (!name?.trim()) throw new AppError(StatusCodes.BAD_REQUEST, "name required");
        return await prisma.topology.create({
            data: { name: name.trim(), description: description?.trim() || null }
        });
    }

    async update(id: string, name?: string, description?: string) {
        const topo = await prisma.topology.findUnique({ where: { id } });
        if (!topo) throw new AppError(StatusCodes.NOT_FOUND, "topology not found");

        const data: any = {};
        if (name !== undefined) data.name = name.trim();
        if (description !== undefined) data.description = description?.trim() || null;

        return await prisma.topology.update({ where: { id }, data });
    }

    async delete(id: string) {
        const topo = await prisma.topology.findUnique({
            where: { id },
            include: { _count: { select: { nodes: true, links: true } } }
        });
        if (!topo) throw new AppError(StatusCodes.NOT_FOUND, "topology not found");

        await prisma.topology.delete({ where: { id } });
        return { id: topo.id, name: topo.name };
    }

    async getNodes(id: string) {
        const topo = await prisma.topology.findUnique({ where: { id } });
        if (!topo) throw new AppError(StatusCodes.NOT_FOUND, "topology not found");

        const nodes = await prisma.node.findMany({
            where: { topologyId: id },
            include: { interfaces: true },
            orderBy: { createdAt: "asc" }
        });
        return { topology: topo, nodes };
    }
}

export default new TopologyService();