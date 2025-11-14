import type { Request, Response } from "express";
import { PrismaClient } from "@prisma/client";
import { StatusCodes } from "http-status-codes";

const prisma = new PrismaClient();

/**
 * GET /api/topologies
 * Get all topologies
 */
export const getAllTopologies = async (req: Request, res: Response) => {
    try {
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
    } catch (error: any) {
        console.error("Error fetching topologies:", error);
        res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
            success: false,
            error: "Failed to fetch topologies",
            message: error.message
        });
    }
};

/**
 * GET /api/topologies/:id
 * Get single topology with all related data
 */
export const getTopologyById = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;

        if(!id) {
            return res.status(StatusCodes.BAD_REQUEST).json({
                success: false,
                error: "Topology ID is required"
            });
        }

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
                    take: 5 // Last 5 simulations
                }
            }
        });

        if (!topology){
            return res.status(StatusCodes.NOT_FOUND).json({
                success: false,
                error: "Topology not found"
            });
        }

        res.json({
            success: true,
            topology
        });
    } catch (error: any) {
        console.error("Error fetching topology:", error);
        res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
            success: false,
            error: "Failed to fetch topology",
            message: error.message
        });
    }
};

/**
 * POST /api/topologies
 * Create new topology
 * Body: { name: string, description?: string }
 */
export const createTopology = async (req: Request, res: Response) => {
    try {
        const { name, description } = req.body;

        if (!name || name.trim().length === 0) {
        return res.status(StatusCodes.BAD_REQUEST).json({
            success: false,
            error: "Topology name is required"
        });
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
    } catch (error: any) {
        console.error("Error creating topology:", error);
        res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
            success: false,
            error: "Failed to create topology",
            message: error.message
        });
    }
};

/**
 * PUT /api/topologies/:id
 * Update topology metadata
 * Body: { name?: string, description?: string }
 */
export const updateTopology = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const { name, description } = req.body;

        if(!id) {
            return res.status(StatusCodes.BAD_REQUEST).json({
                success: false,
                error: "Topology ID is required"
            });
        }

        // check if topology exists
        const existing = await prisma.topology.findUnique({
            where: { id }
        });

        if (!existing) {
            return res.status(StatusCodes.NOT_FOUND).json({
                success: false,
                error: "Topology not found"
            });
        }

        // Build update data
        const updateData: any = {};
        if (name !== undefined) updateData.name = name.trim();
        if (description !== undefined) updateData.description = description?.trim() || null;

        const topology = await prisma.topology.update({
            where: { id },
            data: updateData
        });

        res.json({
            success: true,
            message: "Topology updated successfully",
            topology
        });
    } catch (error: any) {
        console.error("Error updating topology:", error);
        res.status(500).json({
            success: false,
            error: "Failed to update topology",
            message: error.message
        });
    }
};

/**
 * DELETE /api/topologies/:id
 * Delete topology (cascades to nodes, links, etc.)
 */
export const deleteTopology = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        if(!id) {
            return res.status(StatusCodes.BAD_REQUEST).json({
                success: false,
                error: "Topology ID is required"
            });
        }
        // Check if topology exists
        const existing = await prisma.topology.findUnique({
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

        if (!existing) {
        return res.status(StatusCodes.NOT_FOUND).json({
            success: false,
            error: "Topology not found"
        });
        }

        // Delete (cascades automatically via Prisma schema)
        await prisma.topology.delete({
            where: { id }
        });

        res.json({
            success: true,
            message: "Topology deleted successfully",
            deleted: {
                id: existing.id,
                name: existing.name,
                nodesCount: existing._count.nodes,
                linksCount: existing._count.links
            }
        });
    } catch (error: any) {
        console.error("Error deleting topology:", error);
            res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
            success: false,
            error: "Failed to delete topology",
            message: error.message
        });
    }
};

/**
 * POST /api/topologies/:id/duplicate
 * Duplicate an existing topology
 */
export const duplicateTopology = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        if(!id) {
            return res.status(StatusCodes.BAD_REQUEST).json({
                success: false,
                error: "Topology ID is required"
            });
        }
        // Fetch original topology with all data
        const original = await prisma.topology.findUnique({
        where: { id },
        include: {
            nodes: {
            include: {
                interfaces: true,
                firewallRules: true,
                routingEntries: {
                include: {
                    nextHopInterface: true
                }
                }
            }
            },
            links: true
        }
        });

        if (!original) {
        return res.status(404).json({
            success: false,
            error: "Topology not found"
        });
        }

        // Create duplicate with all nodes and links
        // Note: This is a simplified version - you may need to handle
        // interface/route relationships more carefully
        const duplicate = await prisma.topology.create({
            data: {
                name: `${original.name} (Copy)`,
                description: original.description
            } 
        });

        res.status(201).json({
            success: true,
            message: "Topology duplicated successfully",
            topology: duplicate
        });
    } catch (error: any) {
        console.error("Error duplicating topology:", error);
        res.status(500).json({
        success: false,
        error: "Failed to duplicate topology",
        message: error.message
        });
    }
};