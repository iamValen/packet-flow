import type { Request, Response } from "express";
import { PrismaClient } from "@prisma/client";
import { StatusCodes } from "http-status-codes";

const prisma = new PrismaClient();

/**
 * GET /api/topologies/:topologyId/links
 * Get all links in a topology
 */
export const getAllLinks = async (req: Request, res: Response) => {
    try {
        const { topologyId } = req.params;

        if (!topologyId) {
            return res.status(StatusCodes.BAD_REQUEST).json({
                success: false,
                error: "Topology ID is required"
            });
        }

        const topology = await prisma.topology.findUnique({
            where: { id: topologyId }
        });

        if (!topology) {
            return res.status(StatusCodes.NOT_FOUND).json({
                success: false,
                error: "Topology not found"
            });
        }

        const links = await prisma.link.findMany({
            where: { topologyId },
            include: {
                interfaceA: {
                    select: {
                        id: true,
                        ip: true,
                        mac: true,
                        nodeId: true
                    }
                },
                interfaceB: {
                    select: {
                        id: true,
                        ip: true,
                        mac: true,
                        nodeId: true
                    }
                },
                nodeA: {
                    select: {
                        id: true,
                        name: true,
                        type: true
                    }
                },
                nodeB: {
                    select: {
                        id: true,
                        name: true,
                        type: true
                    }
                }
            },
            orderBy: {
                createdAt: 'asc'
            }
        });

        res.json({
            success: true,
            topologyId,
            topologyName: topology.name,
            count: links.length,
            links
        });
    } catch (error: any) {
        console.error("Error fetching links:", error);
        res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
            success: false,
            error: "Failed to fetch links",
            message: error.message
        });
    }
};

/**
 * GET /api/topologies/:topologyId/links/:linkId
 * Get a single link by ID
 */
export const getLinkById = async (req: Request, res: Response) => {
    try {
        const { topologyId, linkId } = req.params;

        if (!topologyId || !linkId) {
            return res.status(StatusCodes.BAD_REQUEST).json({
                success: false,
                error: "Topology ID and Link ID are required"
            });
        }

        const link = await prisma.link.findUnique({
            where: { id: linkId },
            include: {
                interfaceA: true,
                interfaceB: true,
                nodeA: true,
                nodeB: true
            }
        });

        if (!link) {
            return res.status(StatusCodes.NOT_FOUND).json({
                success: false,
                error: "Link not found"
            });
        }

        if (link.topologyId !== topologyId) {
            return res.status(StatusCodes.BAD_REQUEST).json({
                success: false,
                error: "Link does not belong to this topology"
            });
        }

        res.json({
            success: true,
            link
        });
    } catch (error: any) {
        console.error("Error fetching link:", error);
        res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
            success: false,
            error: "Failed to fetch link",
            message: error.message
        });
    }
};

/**
 * POST /api/topologies/:topologyId/links
 * Create a new link between two interfaces
 * Body: { interfaceAId: string, interfaceBId: string }
 */
export const createLink = async (req: Request, res: Response) => {
    try {
        const { topologyId } = req.params;
        const { interfaceAId, interfaceBId } = req.body;

        if (!topologyId) {
            return res.status(StatusCodes.BAD_REQUEST).json({
                success: false,
                error: "Topology ID is required"
            });
        }

        if (!interfaceAId || !interfaceBId || interfaceAId === interfaceBId) {
            return res.status(StatusCodes.BAD_REQUEST).json({
                success: false,
                error: "Both interfaceAId and interfaceBId are required, and cannot be the same"
            });
        }

        const topology = await prisma.topology.findUnique({
            where: { id: topologyId }
        });

        if (!topology) {
            return res.status(StatusCodes.NOT_FOUND).json({
                success: false,
                error: "Topology not found"
            });
        }

        // get both interfaces
        const [interfaceA, interfaceB] = await Promise.all([
            prisma.networkInterface.findUnique({
                where: { id: interfaceAId },
                include: {
                    node: {
                        select: {
                            id: true,
                            name: true,
                            type: true,
                            topologyId: true
                        }
                    }
                }
            }),
            prisma.networkInterface.findUnique({
                where: { id: interfaceBId },
                include: {
                    node: {
                        select: {
                            id: true,
                            name: true,
                            type: true,
                            topologyId: true
                        }
                    }
                }
            })
        ]);

        if (!interfaceA || !interfaceB || interfaceA.node.topologyId !== topologyId || interfaceB.node.topologyId !== topologyId || interfaceA.node.id === interfaceB.node.id) {
            return res.status(StatusCodes.NOT_FOUND).json({
                success: false,
                error: `Interface A and B need to exist in the same topology and different nodes (IDs: ${interfaceAId}, ${interfaceBId})`
            });
        }

        // Check if either interface is already linked
        const existingLinks = await prisma.link.findMany({
            where: {
                OR: [
                    { interfaceAId },
                    { interfaceBId },
                    { interfaceAId: interfaceBId },
                    { interfaceBId: interfaceAId }
                ]
            },
            include: {
                nodeA: { select: { name: true } },
                nodeB: { select: { name: true } }
            }
        });

        if (existingLinks.length > 0) {
            const existingLink = existingLinks[0]!;
            return res.status(StatusCodes.CONFLICT).json({
                success: false,
                error: "One or both interfaces are already linked",
                existingLink: {
                    id: existingLink.id,
                    nodeA: existingLink.nodeA.name,
                    nodeB: existingLink.nodeB.name
                }
            });
        }

        // Create the link
        const link = await prisma.link.create({
            data: {
                interfaceAId,
                interfaceBId,
                nodeAId: interfaceA.node.id,
                nodeBId: interfaceB.node.id,
                topologyId
            },
            include: {
                interfaceA: {
                    select: {
                        id: true,
                        ip: true,
                        mac: true,
                        nodeId: true
                    }
                },
                interfaceB: {
                    select: {
                        id: true,
                        ip: true,
                        mac: true,
                        nodeId: true
                    }
                },
                nodeA: {
                    select: {
                        id: true,
                        name: true,
                        type: true
                    }
                },
                nodeB: {
                    select: {
                        id: true,
                        name: true,
                        type: true
                    }
                }
            }
        });

        res.status(StatusCodes.CREATED).json({
            success: true,
            message: "Link created successfully",
            link,
        });
    } catch (error: any) {
        console.error("Error creating link:", error);
        res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
            success: false,
            error: "Failed to create link",
            message: error.message
        });
    }
};

/**
 * DELETE /api/topologies/:topologyId/links/:linkId
 * Delete a link
 */
export const deleteLink = async (req: Request, res: Response) => {
    try {
        const { topologyId, linkId } = req.params;

        if (!topologyId || !linkId) {
            return res.status(StatusCodes.BAD_REQUEST).json({
                success: false,
                error: "Topology ID and Link ID are required"
            });
        }

        const link = await prisma.link.findUnique({
            where: { id: linkId },
            include: {
                nodeA: {
                    select: { name: true }
                },
                nodeB: {
                    select: { name: true }
                },
                interfaceA: {
                    select: { ip: true }
                },
                interfaceB: {
                    select: { ip: true }
                }
            }
        });

        if (!link) {
            return res.status(StatusCodes.NOT_FOUND).json({
                success: false,
                error: "Link not found"
            });
        }

        if (link.topologyId !== topologyId) {
            return res.status(StatusCodes.BAD_REQUEST).json({
                success: false,
                error: "Link does not belong to this topology"
            });
        }

        await prisma.link.delete({
            where: { id: linkId }
        });

        res.json({
            success: true,
            message: "Link deleted successfully",
            deleted: {
                id: link.id,
                nodeA: link.nodeA.name,
                nodeB: link.nodeB.name,
                interfaceA: link.interfaceA.ip,
                interfaceB: link.interfaceB.ip
            }
        });
    } catch (error: any) {
        console.error("Error deleting link:", error);
        res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
            success: false,
            error: "Failed to delete link",
            message: error.message
        });
    }
};

/**
 * GET /api/nodes/:nodeId/links
 * Get all links connected to a specific node
 */
export const getLinksForNode = async (req: Request, res: Response) => {
    try {
        const { nodeId } = req.params;

        if (!nodeId) {
            return res.status(StatusCodes.BAD_REQUEST).json({
                success: false,
                error: "Node ID is required"
            });
        }

        // Verify node exists
        const node = await prisma.node.findUnique({
            where: { id: nodeId },
            include: {
                topology: {
                    select: { id: true, name: true }
                }
            }
        });

        if (!node) {
            return res.status(StatusCodes.NOT_FOUND).json({
                success: false,
                error: "Node not found"
            });
        }

        const links = await prisma.link.findMany({
            where: {
                OR: [
                    { nodeAId: nodeId },
                    { nodeBId: nodeId }
                ]
            },
            include: {
                interfaceA: true,
                interfaceB: true,
                nodeA: {
                    select: {
                        id: true,
                        name: true,
                        type: true
                    }
                },
                nodeB: {
                    select: {
                        id: true,
                        name: true,
                        type: true
                    }
                }
            },
            orderBy: {
                createdAt: 'asc'
            }
        });

        res.json({
            success: true,
            nodeId,
            nodeName: node.name,
            topologyId: node.topology.id,
            topologyName: node.topology.name,
            count: links.length,
            links
        });
    } catch (error: any) {
        console.error("Error fetching links for node:", error);
        res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
            success: false,
            error: "Failed to fetch links for node",
            message: error.message
        });
    }
};