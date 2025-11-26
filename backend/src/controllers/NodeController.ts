import type { Request, Response } from "express";
import { PrismaClient } from "@prisma/client";
import { StatusCodes } from "http-status-codes";

import { NodeType } from "../models/Node.js";

import { AppError, asyncHandler } from "../middleware/errorHandler.js";

const prisma = new PrismaClient();

/**
 * GET /api/topologies/:topologyId/nodes
 * Get all nodes in a topology
 */
export const getAllNodes = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { topologyId } = req.params;

    if (!topologyId) 
        throw new AppError(StatusCodes.BAD_REQUEST, "Topology ID is required");

    const topology = await prisma.topology.findUnique({
        where: { id: topologyId }
    });

    if (!topology)
        throw new AppError(StatusCodes.NOT_FOUND, "Topology not found");

    const nodes = await prisma.node.findMany({
        where: { topologyId },
        include: {
            interfaces: true,
            firewallRules: {
                orderBy: { priority: 'asc' }
            },
            routingEntries: {
                include: {
                    nextHopInterface: true
                }
            },
            _count: {
                select: {
                    interfaces: true,
                    linksAsA: true,
                    linksAsB: true,
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
        topologyId,
        topologyName: topology.name,
        count: nodes.length,
        nodes
    });
});

/**
 * GET /api/topologies/:topologyId/nodes/:nodeId
 * Get a single node by ID
 */
export const getNodeById = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { topologyId, nodeId } = req.params;

    if (!topologyId || !nodeId) 
        throw new AppError(StatusCodes.BAD_REQUEST, "Topology ID and Node ID are required");

    const node = await prisma.node.findUnique({
        where: { id: nodeId },
        include: {
            interfaces: true,
            firewallRules: {
                orderBy: { priority: 'asc' }
            },
            routingEntries: {
                include: {
                    nextHopInterface: true
                }
            },
            linksAsA: {
                include: {
                    interfaceA: true,
                    interfaceB: true,
                    nodeB: true
                }
            },
            linksAsB: {
                include: {
                    interfaceA: true,
                    interfaceB: true,
                    nodeA: true
                }
            }
        }
    });

    if (!node)
        throw new AppError(StatusCodes.NOT_FOUND, "Node not found");
    if (node.topologyId !== topologyId)
        throw new AppError(StatusCodes.BAD_REQUEST, "Node does not belong to this topology");

    res.json({
        success: true,
        node
    });
});

/**
 * POST /api/topologies/:topologyId/nodes
 * Create a new node in a topology
 * Body: { name: string, type: NodeType, positionX: number, positionY: number, defaultGateway?: string }
 */
export const createNode = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { topologyId } = req.params;
    const { name, type, positionX, positionY, defaultGateway } = req.body;

    if (!topologyId) 
        throw new AppError(StatusCodes.BAD_REQUEST, "Topology ID is required");
    if (!name || !type || positionX === undefined || positionY === undefined)
        throw new AppError(StatusCodes.BAD_REQUEST, "Name, type, positionX, and positionY are required");

    const validTypes = Object.values(NodeType);
    if (!validTypes.includes(type))
        throw new AppError(StatusCodes.BAD_REQUEST, `Invalid node type. Must be one of: ${validTypes.join(', ')}`);

    const topology = await prisma.topology.findUnique({
        where: { id: topologyId }
    });

    if (!topology)
        throw new AppError(StatusCodes.NOT_FOUND, "Topology not found");

    // Check for duplicate node name in topology
    const existingNode = await prisma.node.findFirst({
        where: {
            topologyId,
            name
        }
    });

    if (existingNode) 
        throw new AppError(StatusCodes.CONFLICT, `Node with name '${name}' already exists in this topology`);

    const node = await prisma.node.create({
        data: {
            name: name.trim(),
            type,
            positionX: Number(positionX),
            positionY: Number(positionY),
            defaultGateway: defaultGateway?.trim() || null,
            topologyId
        },
        include: {
            interfaces: true
        }
    });

    res.status(StatusCodes.CREATED).json({
        success: true,
        message: "Node created successfully",
        node
    });
});

/**
 * PUT /api/topologies/:topologyId/nodes/:nodeId
 * Update a node data
 * Body: { name?: string, defaultGateway?: string }
 */
export const updateNode = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { topologyId, nodeId } = req.params;
    const { name, defaultGateway } = req.body;

    if (!topologyId || !nodeId) 
        throw new AppError(StatusCodes.BAD_REQUEST, "Topology ID and Node ID are required");

    const existingNode = await prisma.node.findUnique({
        where: { id: nodeId }
    });
    if (!existingNode)
        throw new AppError(StatusCodes.NOT_FOUND, "Node not found");
    if (existingNode.topologyId !== topologyId) 
        throw new AppError(StatusCodes.BAD_REQUEST, "Node does not belong to this topology");

    // Check for duplicate name if name is being changed
    if (name && name !== existingNode.name) {
        const duplicateName = await prisma.node.findFirst({
            where: {
                topologyId,
                name: name.trim(),
                id: { not: nodeId }
            }
        });

        if(duplicateName)
            throw new AppError(StatusCodes.CONFLICT, `Node with name '${name}' already exists in this topology`);
    }

    // Build update data
    const updateData: { name?: string; defaultGateway?: string } = {};
    if (name !== undefined) updateData.name = name.trim();
    if (defaultGateway !== undefined) updateData.defaultGateway = defaultGateway?.trim() || null;

    const node = await prisma.node.update({
        where: { id: nodeId },
        data: updateData,
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

    res.json({
        success: true,
        message: "Node updated successfully",
        node
    });
});

/**
 * PUT /api/topologies/:topologyId/nodes/:nodeId/position
 * Update only the nodes position (for drag-and-drop in UI)
 * Body: { positionX: number, positionY: number }
 */
export const updateNodePosition = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { topologyId, nodeId } = req.params;
    const { positionX, positionY } = req.body;

    if (!topologyId || !nodeId)
        throw new AppError(StatusCodes.BAD_REQUEST, "Topology ID and Node ID are required");
    if (positionX === undefined || positionY === undefined)
        throw new AppError(StatusCodes.BAD_REQUEST, "Both positionX and positionY are required");

    const existingNode = await prisma.node.findUnique({
        where: { id: nodeId }
    });

    if (!existingNode)
        throw new AppError(StatusCodes.NOT_FOUND, "Node not found");
    if (existingNode.topologyId !== topologyId)
        throw new AppError(StatusCodes.BAD_REQUEST, "Node does not belong to this topology");

    const node = await prisma.node.update({
        where: { id: nodeId },
        data: {
            positionX: Number(positionX),
            positionY: Number(positionY)
        }
    });

    res.json({
        success: true,
        message: "Node position updated successfully",
        node: {
            id: node.id,
            name: node.name,
            positionX: node.positionX,
            positionY: node.positionY
        }
    });
});

/**
 * DELETE /api/topologies/:topologyId/nodes/:nodeId
 * Delete a node from the topology
 */
export const deleteNode = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { topologyId, nodeId } = req.params;

    if (!topologyId || !nodeId)
        throw new AppError(StatusCodes.BAD_REQUEST, "Topology ID and Node ID are required");

    const node = await prisma.node.findUnique({
        where: { id: nodeId },
        include: {
            interfaces: true,
            _count: {
                select: {
                    interfaces: true,
                    linksAsA: true,
                    linksAsB: true,
                    firewallRules: true,
                    routingEntries: true
                }
            }
        }
    });

    if (!node)
        throw new AppError(StatusCodes.NOT_FOUND, "Node not found");
    if (node.topologyId !== topologyId)
        throw new AppError(StatusCodes.BAD_REQUEST, "Node does not belong to this topology");

    // Delete node (cascades entries via Prisma schema)
    await prisma.node.delete({
        where: { id: nodeId }
    });

    res.json({
        success: true,
        message: "Node deleted successfully",
        deleted: {
            id: node.id,
            name: node.name,
            type: node.type,
            interfacesCount: node._count.interfaces,
            linksCount: node._count.linksAsA + node._count.linksAsB,
            firewallRulesCount: node._count.firewallRules,
            routingEntriesCount: node._count.routingEntries
        }
    });
});