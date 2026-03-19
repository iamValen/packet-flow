import { StatusCodes } from "http-status-codes";
import { prisma } from "../prisma.js";
import { AppError } from "../middleware/errorHandler.js";
import { NetworkInterface } from "../models/NetworkInterface.js";
import { NodeType } from "../models/Node.js";

class NodeService {
    /**
     * Returns all nodes in a topology with their interfaces, ordered by creation date.
     * @throws if the topology is not found
     */
    async getAll(topologyId: string) {
        const topo = await prisma.topology.findUnique({ where: { id: topologyId } });
        if (!topo) throw new AppError(StatusCodes.NOT_FOUND, "topology not found");

        const nodes = await prisma.node.findMany({
            where: { topologyId },
            include: { interfaces: true },
            orderBy: { createdAt: "asc" }
        });
        return { topology: topo, nodes };
    }

    /**
     * Returns a single node with its interfaces.
     * @throws if the node is not found or does not belong to the given topology
     */
    async getById(topologyId: string, nodeId: string) {
        const node = await prisma.node.findUnique({
            where: { id: nodeId },
            include: { interfaces: true }
        });
        if (!node) throw new AppError(StatusCodes.NOT_FOUND, "node not found");
        if (node.topologyId !== topologyId) throw new AppError(StatusCodes.BAD_REQUEST, "wrong topology");
        return node;
    }

    /**
     * Creates a new node in a topology.
     * @param topologyId - ID of the topology to add the node to
     * @param name - display name
     * @param type - HOST, ROUTER, or SWITCH
     * @param x - canvas X position
     * @param y - canvas Y position
     * @param gateway - optional default gateway IP (HOST only)
     * @throws if the topology is not found, the type is invalid, or the gateway IP is malformed
     */
    async create(topologyId: string, name: string, type: NodeType, x: number, y: number, gateway?: string) {
        if (!name || !type) throw new AppError(StatusCodes.BAD_REQUEST, "name and type required");
        if (!Object.values(NodeType).includes(type)) throw new AppError(StatusCodes.BAD_REQUEST, "invalid type");

        const topo = await prisma.topology.findUnique({ where: { id: topologyId } });
        if (!topo) throw new AppError(StatusCodes.NOT_FOUND, "topology not found");

        if (gateway && !NetworkInterface.isValidIP(gateway))
            throw new AppError(StatusCodes.BAD_REQUEST, `bad gateway: ${gateway}`);

        return await prisma.node.create({
            data: {
                name,
                type: type as NodeType,
                positionX: Number(x),
                positionY: Number(y),
                defaultGateway: gateway || null,
                topologyId
            },
            include: { interfaces: true }
        });
    }

    /**
     * Updates a node's name and/or default gateway.
     * @throws if the node is not found or does not belong to the given topology
     */
    async update(topologyId: string, nodeId: string, name?: string, gateway?: string) {
        const node = await prisma.node.findUnique({ where: { id: nodeId } });
        if (!node) throw new AppError(StatusCodes.NOT_FOUND, "node not found");
        if (node.topologyId !== topologyId) throw new AppError(StatusCodes.BAD_REQUEST, "wrong topology");

        const data: any = {};
        if (name !== undefined) data.name = name;
        if (gateway !== undefined) {
            if (gateway && !NetworkInterface.isValidIP(gateway))
                throw new AppError(StatusCodes.BAD_REQUEST, `bad gateway: ${gateway}`);
            data.defaultGateway = gateway || null;
        }

        return await prisma.node.update({
            where: { id: nodeId },
            data,
            include: { interfaces: true }
        });
    }

    /**
     * Updates a node's canvas position.
     * @throws if the node is not found or does not belong to the given topology
     */
    async updatePosition(topologyId: string, nodeId: string, x: number, y: number) {
        const node = await prisma.node.findUnique({ where: { id: nodeId } });
        if (!node) throw new AppError(StatusCodes.NOT_FOUND, "node not found");
        if (node.topologyId !== topologyId) throw new AppError(StatusCodes.BAD_REQUEST, "wrong topology");

        return await prisma.node.update({
            where: { id: nodeId },
            data: { positionX: Number(x), positionY: Number(y) },
            include: { interfaces: true }
        });
    }

    /**
     * Deletes a node. Cascades to its interfaces and any connected links.
     * @throws if the node is not found or does not belong to the given topology
     */
    async delete(topologyId: string, nodeId: string) {
        const node = await prisma.node.findUnique({ where: { id: nodeId } });
        if (!node) throw new AppError(StatusCodes.NOT_FOUND, "node not found");
        if (node.topologyId !== topologyId) throw new AppError(StatusCodes.BAD_REQUEST, "wrong topology");

        await prisma.node.delete({ where: { id: nodeId } });
        return { id: node.id, name: node.name };
    }
}

export default new NodeService();