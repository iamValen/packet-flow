import type { Request, Response } from "express";
import { PrismaClient } from "@prisma/client";
import { StatusCodes } from "http-status-codes";

import { AppError, asyncHandler } from "../middleware/errorHandler.js";

const prisma = new PrismaClient();

/**
 * GET /api/topologies
 */
export const getAllTopologies = asyncHandler(async (req: Request, res: Response): Promise<void> => {
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

    res.json({
        success: true,
        count: topologies.length,
        topologies
    });
});

/**
 * GET /api/topologies/:id
 */
export const getTopologyById = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;

    if(!id)
        throw new AppError(StatusCodes.BAD_REQUEST, "Topology ID is required");

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
                take: 5 // only 5 sims
            }
        }
    });

    if (!topology)
        throw new AppError(StatusCodes.NOT_FOUND, "Topology not found");

    res.json({
        success: true,
        topology
    });
});

/**
 * POST /api/topologies
 * Body: { name: string, description?: string }
 */
export const createTopology = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { name, description } = req.body;

    if (!name || name.trim().length === 0) {
        throw new AppError(StatusCodes.BAD_REQUEST, "Topology name is required");
    }

    const topology = await prisma.topology.create({
        data: {
            name: name.trim(),
            description: description?.trim() || null
        }
    });

    res.status(StatusCodes.CREATED).json({
        success: true,
        message: "Topology created successfully",
        topology
    });
});

/**
 * PUT /api/topologies/:id
 * Body: { name?: string, description?: string }
 */
export const updateTopology = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    const { name, description } = req.body;

    if(!id)
        throw new AppError(StatusCodes.BAD_REQUEST, "Topology ID is required");

    const topology = await prisma.topology.findUnique({
        where: { id }
    });
    if (!topology)
        throw new AppError(StatusCodes.NOT_FOUND, "Topology not found");

    // update data
    const updateData: { name?: string; description?: string } = {};
    if (name !== undefined) updateData.name = name.trim();
    if (description !== undefined) updateData.description = description?.trim() || null;

    const updated = await prisma.topology.update({
        where: { id },
        data: updateData
    });

    res.json({
        success: true,
        message: "Topology updated successfully",
        topology
    });
});

/**
 * DELETE /api/topologies/:id
 * Delete topology (cascades to nodes, links, etc.)
 * Body: { name?: string, description?: string }
 */
export const deleteTopology = asyncHandler(async (req: Request, res: Response): Promise<void> => {
        const { id } = req.params;
        if(!id)
            throw new AppError(StatusCodes.BAD_REQUEST, "Topology ID is required");


        // Check if topology exists
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

        if (!topology)
            throw new AppError(StatusCodes.NOT_FOUND, "Topology not found");

        // (cascades automatically via Prisma schema)
        await prisma.topology.delete({
            where: { id }
        });

        res.json({
            success: true,
            message: "Topology deleted successfully",
            deleted: {
                id: topology.id,
                name: topology.name,
                nodesCount: topology._count.nodes,
                linksCount: topology._count.links
            }
        });
});
 
/**
 * GET /api/topologies/:id/nodes
 * Get all nodes in a topology
 */
export const getTopologyNodes = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    if(!id)
        throw new AppError(StatusCodes.BAD_REQUEST, "Topology ID is required");

    const topology = await prisma.topology.findUnique({
        where: { id }
    });

    if(!topology)
        throw new AppError(StatusCodes.NOT_FOUND, "Topology not found");

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
    res.json({
        success: true,
        topologyId: id,
        topologyName: topology.name,
        count: nodes.length,
        nodes
    });
});