import type { Request, Response } from "express";
import { PrismaClient } from "@prisma/client";
import { StatusCodes } from "http-status-codes";
import { NetworkInterface } from "../models/NetworkInterface.js";

const prisma = new PrismaClient();

/**
 * GET /api/nodes/:nodeId/interfaces
 * Get all interfaces for a node
 */
export const getAllInterfaces = async (req: Request, res: Response) => {
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

        const interfaces = await prisma.networkInterface.findMany({
            where: { nodeId },
            include: {
                linksAsA: {
                    include: {
                        interfaceB: true,
                        nodeB: true
                    }
                },
                linksAsB: {
                    include: {
                        interfaceA: true,
                        nodeA: true
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
            count: interfaces.length,
            interfaces
        });
    } catch (error: any) {
        console.error("Error fetching interfaces:", error);
        res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
            success: false,
            error: "Failed to fetch interfaces",
            message: error.message
        });
    }
};

/**
 * GET /api/nodes/:nodeId/interfaces/:interfaceId
 * Get a single interface by ID
 */
export const getInterfaceById = async (req: Request, res: Response) => {
    try {
        const { nodeId, interfaceId } = req.params;

        if (!nodeId || !interfaceId) {
            return res.status(StatusCodes.BAD_REQUEST).json({
                success: false,
                error: "Node ID and Interface ID are required"
            });
        }

        const iface = await prisma.networkInterface.findUnique({
            where: { id: interfaceId },
            include: {
                node: {
                    select: {
                        id: true,
                        name: true,
                        type: true
                    }
                },
                linksAsA: {
                    include: {
                        interfaceB: true,
                        nodeB: true
                    }
                },
                linksAsB: {
                    include: {
                        interfaceA: true,
                        nodeA: true
                    }
                }
            }
        });

        if (!iface) {
            return res.status(StatusCodes.NOT_FOUND).json({
                success: false,
                error: "Interface not found"
            });
        }

        if (iface.nodeId !== nodeId) {
            return res.status(StatusCodes.BAD_REQUEST).json({
                success: false,
                error: "Interface does not belong to this node"
            });
        }

        res.json({
            success: true,
            interface: iface
        });
    } catch (error: any) {
        console.error("Error fetching interface:", error);
        res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
            success: false,
            error: "Failed to fetch interface",
            message: error.message
        });
    }
};