import type { Request, Response } from "express";
import { PrismaClient } from "@prisma/client";
import { StatusCodes } from "http-status-codes";

import { AppError, asyncHandler } from "../middleware/errorHandler.js";

const prisma = new PrismaClient();

/**
 * GET /api/topologies/:topologyId/links
 */
export const getAllLinks = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { topologyId } = req.params;

    if (!topologyId)
        throw new AppError(StatusCodes.BAD_REQUEST, "Topology ID is required");

    const topology = await prisma.topology.findUnique({
        where: { id: topologyId }
    });
    if (!topology) 
        throw new AppError(StatusCodes.NOT_FOUND, "Topology not found");

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
});

/**
 * GET /api/topologies/:topologyId/links/:linkId
 */
export const getLinkById = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { topologyId, linkId } = req.params;

    if (!topologyId || !linkId)
        throw new AppError(StatusCodes.BAD_REQUEST, "Topology ID and Link ID are required");

    const link = await prisma.link.findUnique({
        where: { id: linkId },
        include: {
            interfaceA: true,
            interfaceB: true,
            nodeA: true,
            nodeB: true
        }
    });

    if (!link)
        throw new AppError(StatusCodes.NOT_FOUND, "Link not found");
    if (link.topologyId !== topologyId)
        throw new AppError(StatusCodes.NOT_FOUND, "Link not found");

    res.json({
        success: true,
        link
    });
});

/**
 * POST /api/topologies/:topologyId/links
 * Create a new link between two interfaces
 * Body: { interfaceAId: string, interfaceBId: string }
 */
export const createLink = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { topologyId } = req.params;
    const { interfaceAId, interfaceBId } = req.body;

    if (!topologyId)
        throw new AppError(StatusCodes.BAD_REQUEST, "Topology ID is required");
    if (!interfaceAId || !interfaceBId || interfaceAId === interfaceBId) 
        throw new AppError(StatusCodes.BAD_REQUEST, "Both interfaceAId and interfaceBId are required, and cannot be the same");

    const topology = await prisma.topology.findUnique({
        where: { id: topologyId }
    });
    if (!topology) 
        throw new AppError(StatusCodes.NOT_FOUND, "Topology not found");

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

    if (!interfaceA || !interfaceB || interfaceA.node.topologyId !== topologyId || interfaceB.node.topologyId !== topologyId || interfaceA.node.id === interfaceB.node.id)
        throw new AppError(StatusCodes.BAD_REQUEST, "Invalid interface IDs");

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

    if (existingLinks.length > 0)
        throw new AppError(StatusCodes.CONFLICT, "One or both interfaces are already linked")

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
});

/**
 * DELETE /api/topologies/:topologyId/links/:linkId
 * Delete a link
 */
export const deleteLink = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { topologyId, linkId } = req.params;

    if (!topologyId || !linkId)
        throw new AppError(StatusCodes.BAD_REQUEST, "Topology ID and Link ID are required");

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

    if (!link)
        throw new AppError(StatusCodes.NOT_FOUND, "Link not found");

    if (link.topologyId !== topologyId)
        throw new AppError(StatusCodes.NOT_FOUND, "Link is not in this topology");

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
});

/**
 * GET /api/nodes/:nodeId/links
 * Get all links connected to a specific node
 */
export const getLinksForNode = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { nodeId } = req.params;

    if (!nodeId)
        throw new AppError(StatusCodes.BAD_REQUEST, "Node ID is required");

    // Verify node exists
    const node = await prisma.node.findUnique({
        where: { id: nodeId },
        include: {
            topology: {
                select: { id: true, name: true }
            }
        }
    });

    if (!node)
        throw new AppError(StatusCodes.NOT_FOUND, "Node not found");

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
});