import { StatusCodes } from "http-status-codes";
import type { Topology } from "@prisma/client";

import { prisma } from "../prisma.js";
import { AppError } from "../middleware/errorHandler.js";

class TopologyService {
    /**
     * Get all topologies with their counts
     */
    async getAllTopologies() {
        const topologies = await prisma.topology.findMany({
            include: {
                nodes: {
                    include: {
                        interfaces: true
                    }
                },
                links: true,
                _count: {
                    select: {
                        nodes: true,
                        links: true,
                        simulations: true
                    }
                }
            },
            orderBy: {
                updatedAt: "desc"
            }
        });

        return topologies;
    }

    /**
     * Get a single topology by ID with full details
     */
    async getTopologyById(id: string) {
        const topology = await prisma.topology.findUnique({
            where: { id },
            include: {
                nodes: {
                    include: {
                        interfaces: true,
                        firewallRules: {
                            orderBy: { priority: "asc" }
                        },
                        routingEntries: {
                            include: {
                                nextHopInterface: true
                            }
                        }
                    }
                },
                links: {
                    include: {
                        interfaceA: true,
                        interfaceB: true,
                        nodeA: true,
                        nodeB: true
                    }
                },
                simulations: {
                    orderBy: { createdAt: "desc" },
                    take: 5
                }
            }
        });

        if (!topology) {
            throw new AppError(StatusCodes.NOT_FOUND, "Topology not found");
        }

        return topology;
    }

    /**
     * Create a new topology
     */
    async createTopology(name: string, description?: string): Promise<Topology> {
        if (!name || name.trim().length === 0) {
            throw new AppError(StatusCodes.BAD_REQUEST, "Topology name is required");
        }

        const topology = await prisma.topology.create({
            data: {
                name: name.trim(),
                description: description?.trim() || null
            }
        });

        return topology;
    }

    /**
     * Update an existing topology
     */
    async updateTopology(id: string, name?: string, description?: string): Promise<Topology> {
        const topology = await prisma.topology.findUnique({
            where: { id }
        });

        if (!topology) {
            throw new AppError(StatusCodes.NOT_FOUND, "Topology not found");
        }

        const updateData: { name?: string; description?: string | null } = {};
        if (name !== undefined) updateData.name = name.trim();
        if (description !== undefined) updateData.description = description?.trim() || null;

        const updated = await prisma.topology.update({
            where: { id },
            data: updateData
        });

        return updated;
    }

    /**
     * Delete a topology (cascades to nodes, links, etc.)
     */
    async deleteTopology(id: string) {
        const topology = await prisma.topology.findUnique({
            where: { id },
            include: {
                _count: {
                    select: {
                        nodes: true,
                        links: true,
                        simulations: true
                    }
                }
            }
        });

        if (!topology) {
            throw new AppError(StatusCodes.NOT_FOUND, "Topology not found");
        }

        await prisma.topology.delete({
            where: { id }
        });

        return {
            id: topology.id,
            name: topology.name,
            nodesCount: topology._count.nodes,
            linksCount: topology._count.links
        };
    }

    /**
     * Get all nodes in a topology
     */
    async getTopologyNodes(id: string) {
        const topology = await prisma.topology.findUnique({
            where: { id }
        });

        if (!topology) {
            throw new AppError(StatusCodes.NOT_FOUND, "Topology not found");
        }

        const nodes = await prisma.node.findMany({
            where: { topologyId: id },
            include: {
                interfaces: true,
                _count: {
                    select: {
                        interfaces: true,
                        firewallRules: true,
                        routingEntries: true
                    }
                }
            },
            orderBy: {
                createdAt: 'asc'
            }
        });

        return { topology, nodes };
    }
}

export default new TopologyService();