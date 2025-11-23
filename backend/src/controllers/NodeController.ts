import type { Request, Response } from "express";
import { PrismaClient } from "@prisma/client";
import { StatusCodes } from "http-status-codes";
import { NodeType } from "../models/Node.js";

const prisma = new PrismaClient();

/**
 * GET /api/topologies/:topologyId/nodes
 * Get all nodes in a topology
 */
export const getAllNodes = async (req: Request, res: Response) => {
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
    } catch (error: any) {
        console.error("Error fetching nodes:", error);
        res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
            success: false,
            error: "Failed to fetch nodes",
            message: error.message
        });
    }
};

/**
 * GET /api/topologies/:topologyId/nodes/:nodeId
 * Get a single node by ID
 */
export const getNodeById = async (req: Request, res: Response) => {
    try {
        const { topologyId, nodeId } = req.params;

        if (!topologyId || !nodeId) {
            return res.status(StatusCodes.BAD_REQUEST).json({
                success: false,
                error: "Topology ID and Node ID are required"
            });
        }

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

        if (!node) {
            return res.status(StatusCodes.NOT_FOUND).json({
                success: false,
                error: "Node not found"
            });
        }

        if (node.topologyId !== topologyId) {
            return res.status(StatusCodes.BAD_REQUEST).json({
                success: false,
                error: "Node does not belong to this topology"
            });
        }

        res.json({
            success: true,
            node
        });
    } catch (error: any) {
        console.error("Error fetching node:", error);
        res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
            success: false,
            error: "Failed to fetch node",
            message: error.message
        });
    }
};

/**
 * POST /api/topologies/:topologyId/nodes
 * Create a new node in a topology
 * Body: { name: string, type: NodeType, positionX: number, positionY: number, defaultGateway?: string }
 */
export const createNode = async (req: Request, res: Response) => {
    try {
        const { topologyId } = req.params;
        const { name, type, positionX, positionY, defaultGateway } = req.body;

        if (!topologyId) {
            return res.status(StatusCodes.BAD_REQUEST).json({
                success: false,
                error: "Topology ID is required"
            });
        }

        if (!name || !type || positionX === undefined || positionY === undefined) {
            return res.status(StatusCodes.BAD_REQUEST).json({
                success: false,
                error: "Name, type, positionX, and positionY are required"
            });
        }

        const validTypes = Object.values(NodeType);
        if (!validTypes.includes(type)) {
            return res.status(StatusCodes.BAD_REQUEST).json({
                success: false,
                error: `Invalid node type. Must be one of: ${validTypes.join(', ')}`
            });
        }

        // Verify topology exists
        const topology = await prisma.topology.findUnique({
            where: { id: topologyId }
        });

        if (!topology) {
            return res.status(StatusCodes.NOT_FOUND).json({
                success: false,
                error: "Topology not found"
            });
        }

        // Check for duplicate node name in topology
        const existingNode = await prisma.node.findFirst({
            where: {
                topologyId,
                name
            }
        });

        if (existingNode) {
            return res.status(StatusCodes.CONFLICT).json({
                success: false,
                error: `Node with name '${name}' already exists in this topology`
            });
        }

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
    } catch (error: any) {
        console.error("Error creating node:", error);
        res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
            success: false,
            error: "Failed to create node",
            message: error.message
        });
    }
};

/**
 * PUT /api/topologies/:topologyId/nodes/:nodeId
 * Update a node
 * Body: { name?: string, positionX?: number, positionY?: number, defaultGateway?: string }
 */
export const updateNode = async (req: Request, res: Response) => {
    try {
        const { topologyId, nodeId } = req.params;
        const { name, positionX, positionY, defaultGateway } = req.body;

        if (!topologyId || !nodeId) {
            return res.status(StatusCodes.BAD_REQUEST).json({
                success: false,
                error: "Topology ID and Node ID are required"
            });
        }

        // Check if node exists
        const existingNode = await prisma.node.findUnique({
            where: { id: nodeId }
        });

        if (!existingNode) {
            return res.status(StatusCodes.NOT_FOUND).json({
                success: false,
                error: "Node not found"
            });
        }

        if (existingNode.topologyId !== topologyId) {
            return res.status(StatusCodes.BAD_REQUEST).json({
                success: false,
                error: "Node does not belong to this topology"
            });
        }

        // Check for duplicate name if name is being changed
        if (name && name !== existingNode.name) {
            const duplicateName = await prisma.node.findFirst({
                where: {
                    topologyId,
                    name: name.trim(),
                    id: { not: nodeId }
                }
            });

            if (duplicateName) {
                return res.status(StatusCodes.CONFLICT).json({
                    success: false,
                    error: `Node with name '${name}' already exists in this topology`
                });
            }
        }

        // Build update data
        const updateData: any = {};
        if (name !== undefined) updateData.name = name.trim();
        if (positionX !== undefined) updateData.positionX = Number(positionX);
        if (positionY !== undefined) updateData.positionY = Number(positionY);
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
    } catch (error: any) {
        console.error("Error updating node:", error);
        res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
            success: false,
            error: "Failed to update node",
            message: error.message
        });
    }
};

/**
 * PUT /api/topologies/:topologyId/nodes/:nodeId/position
 * Update only the node's position (for drag-and-drop in UI)
 * Body: { positionX: number, positionY: number }
 */
export const updateNodePosition = async (req: Request, res: Response) => {
    try {
        const { topologyId, nodeId } = req.params;
        const { positionX, positionY } = req.body;

        if (!topologyId || !nodeId) {
            return res.status(StatusCodes.BAD_REQUEST).json({
                success: false,
                error: "Topology ID and Node ID are required"
            });
        }

        if (positionX === undefined || positionY === undefined) {
            return res.status(StatusCodes.BAD_REQUEST).json({
                success: false,
                error: "Both positionX and positionY are required"
            });
        }

        const existingNode = await prisma.node.findUnique({
            where: { id: nodeId }
        });

        if (!existingNode) {
            return res.status(StatusCodes.NOT_FOUND).json({
                success: false,
                error: "Node not found"
            });
        }

        if (existingNode.topologyId !== topologyId) {
            return res.status(StatusCodes.BAD_REQUEST).json({
                success: false,
                error: "Node does not belong to this topology"
            });
        }

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
    } catch (error: any) {
        console.error("Error updating node position:", error);
        res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
            success: false,
            error: "Failed to update node position",
            message: error.message
        });
    }
};

/**
 * DELETE /api/topologies/:topologyId/nodes/:nodeId
 * Delete a node from the topology
 */
export const deleteNode = async (req: Request, res: Response) => {
    try {
        const { topologyId, nodeId } = req.params;

        if (!topologyId || !nodeId) {
            return res.status(StatusCodes.BAD_REQUEST).json({
                success: false,
                error: "Topology ID and Node ID are required"
            });
        }

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

        if (!node) {
            return res.status(StatusCodes.NOT_FOUND).json({
                success: false,
                error: "Node not found"
            });
        }

        if (node.topologyId !== topologyId) {
            return res.status(StatusCodes.BAD_REQUEST).json({
                success: false,
                error: "Node does not belong to this topology"
            });
        }

        // Delete node (cascades to interfaces, links, firewall rules, routing entries via Prisma schema)
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
    } catch (error: any) {
        console.error("Error deleting node:", error);
        res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
            success: false,
            error: "Failed to delete node",
            message: error.message
        });
    }
};