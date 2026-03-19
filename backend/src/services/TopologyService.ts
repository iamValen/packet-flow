import { StatusCodes } from "http-status-codes";
import { prisma } from "../prisma.js";
import { AppError } from "../middleware/errorHandler.js";

/** Handles topology CRUD operations. */
class TopologyService {
    /**
     * Returns all topologies with their nodes, interfaces, links, and counts,
     * ordered by most recently updated.
     */
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

    /**
     * Returns a topology by id, including all nodes, links, and the 5 most recent simulations.
     * @throws if the topology is not found
     */
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

    /**
     * Creates a new topology.
     * @throws if the name is empty
     */
    async create(name: string, description?: string) {
        if (!name?.trim()) throw new AppError(StatusCodes.BAD_REQUEST, "name required");
        return await prisma.topology.create({
            data: { name: name.trim(), description: description?.trim() || null }
        });
    }

    /**
     * Updates a topology's name and/or description.
     * @throws if the topology is not found
     */
    async update(id: string, name?: string, description?: string) {
        const topo = await prisma.topology.findUnique({ where: { id } });
        if (!topo) throw new AppError(StatusCodes.NOT_FOUND, "topology not found");

        const data: any = {};
        if (name !== undefined) data.name = name.trim();
        if (description !== undefined) data.description = description?.trim() || null;

        return await prisma.topology.update({ where: { id }, data });
    }

    /**
     * Deletes a topology. Cascades to all nodes, interfaces, links, and simulations.
     * @throws if the topology is not found
     */
    async delete(id: string) {
        const topo = await prisma.topology.findUnique({
            where: { id },
            include: { _count: { select: { nodes: true, links: true } } }
        });
        if (!topo) throw new AppError(StatusCodes.NOT_FOUND, "topology not found");

        await prisma.topology.delete({ where: { id } });
        return { id: topo.id, name: topo.name };
    }

    /**
     * Returns a topology and all its nodes with their interfaces.
     * @throws if the topology is not found
     */
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