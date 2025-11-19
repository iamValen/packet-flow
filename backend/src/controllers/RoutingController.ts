import type { Request, Response } from "express";
import { PrismaClient } from "@prisma/client";
import { StatusCodes } from "http-status-codes";
import { NetworkInterface } from "../models/NetworkInterface.js";

const prisma = new PrismaClient();

/**
 * GET /api/nodes/:nodeId/routes
 * Get all routing entries for a router
 */
export const getAllRoutes = async (req: Request, res: Response) => {
    try {
        const { nodeId } = req.params;

        if (!nodeId) {
            return res.status(StatusCodes.BAD_REQUEST).json({
                success: false,
                error: "Node ID is required"
            });
        }

        const node = await prisma.node.findUnique({
            where: { id: nodeId },
            include: { topology: { select: { id: true, name: true } } }
        });

        if (!node) {
            return res.status(StatusCodes.NOT_FOUND).json({
                success: false,
                error: "Node not found"
            });
        }

        if (node.type !== "ROUTER") {
            return res.status(StatusCodes.BAD_REQUEST).json({
                success: false,
                error: "Only routers can have routing entries"
            });
        }

        const routes = await prisma.routingEntry.findMany({
            where: { nodeId },
            include: {
                nextHopInterface: {
                    select: {
                        id: true,
                        ip: true,
                        mac: true
                    }
                }
            },
            orderBy: [
                { isDefault: 'desc' },
                { cidr: 'desc' }
            ]
        });

        res.json({
            success: true,
            nodeId,
            nodeName: node.name,
            count: routes.length,
            routes
        });
    } catch (error: any) {
        console.error("Error fetching routes:", error);
        res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
            success: false,
            error: "Failed to fetch routes",
            message: error.message
        });
    }
};

/**
 * POST /api/nodes/:nodeId/routes
 * Add a routing entry to a router
 * Body: { destination: string, mask: string, nextHopInterfaceId: string }
 */
export const createRoute = async (req: Request, res: Response) => {
    try {
        const { nodeId } = req.params;
        const { destination, mask, nextHopInterfaceId } = req.body;

        if (!nodeId) {
            return res.status(StatusCodes.BAD_REQUEST).json({
                success: false,
                error: "Node ID is required"
            });
        }

        if (!destination || !mask || !nextHopInterfaceId) {
            return res.status(StatusCodes.BAD_REQUEST).json({
                success: false,
                error: "Destination, mask, and nextHopInterfaceId are required"
            });
        }

        // Validate IP and mask
        if (!NetworkInterface.isValidIP(destination)) {
            return res.status(StatusCodes.BAD_REQUEST).json({
                success: false,
                error: `Invalid destination IP: ${destination}`
            });
        }

        if (!NetworkInterface.isValidSubnetMask(mask)) {
            return res.status(StatusCodes.BAD_REQUEST).json({
                success: false,
                error: `Invalid subnet mask: ${mask}`
            });
        }

        const node = await prisma.node.findUnique({
            where: { id: nodeId },
            include: { interfaces: true }
        });

        if (!node) {
            return res.status(StatusCodes.NOT_FOUND).json({
                success: false,
                error: "Node not found"
            });
        }

        if (node.type !== "ROUTER") {
            return res.status(StatusCodes.BAD_REQUEST).json({
                success: false,
                error: "Only routers can have routing entries"
            });
        }

        //verify interface belongs to this router
        const iface = await prisma.networkInterface.findUnique({
            where: { id: nextHopInterfaceId }
        });

        if (!iface || iface.nodeId !== nodeId) {
            return res.status(StatusCodes.BAD_REQUEST).json({
                success: false,
                error: "Next hop interface must belong to this router"
            });
        }

        // check if route exists
        const existing = await prisma.routingEntry.findFirst({
            where: {
                nodeId,
                destination,
                mask
            }
        });

        if (existing) {
            return res.status(StatusCodes.CONFLICT).json({
                success: false,
                error: `Route ${destination}/${mask} already exists`
            });
        }

        const cidr = NetworkInterface.maskToCidr(mask);
        const isDefault = destination === "0.0.0.0" && mask === "0.0.0.0";

        const route = await prisma.routingEntry.create({
            data: {
                destination,
                mask,
                cidr,
                isDefault,
                nodeId,
                nextHopInterfaceId
            },
            include: {
                nextHopInterface: {
                    select: {
                        id: true,
                        ip: true,
                        mac: true
                    }
                }
            }
        });

        res.status(StatusCodes.CREATED).json({
            success: true,
            message: "Route created successfully",
            route
        });
    } catch (error: any) {
        console.error("Error creating route:", error);
        res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
            success: false,
            error: "Failed to create route",
            message: error.message
        });
    }
};

/**
 * DELETE /api/nodes/:nodeId/routes/:routeId
 * Delete a routing entry
 */
export const deleteRoute = async (req: Request, res: Response) => {
    try {
        const { nodeId, routeId } = req.params;

        if (!nodeId || !routeId) {
            return res.status(StatusCodes.BAD_REQUEST).json({
                success: false,
                error: "Node ID and Route ID are required"
            });
        }

        const route = await prisma.routingEntry.findUnique({
            where: { id: routeId },
            include: {
                nextHopInterface: {
                    select: { ip: true }
                }
            }
        });

        if (!route) {
            return res.status(StatusCodes.NOT_FOUND).json({
                success: false,
                error: "Route not found"
            });
        }

        if (route.nodeId !== nodeId) {
            return res.status(StatusCodes.BAD_REQUEST).json({
                success: false,
                error: "Route does not belong to this node"
            });
        }

        await prisma.routingEntry.delete({
            where: { id: routeId }
        });

        res.json({
            success: true,
            message: "Route deleted successfully",
            deleted: {
                id: route.id,
                destination: route.destination,
                mask: route.mask,
                nextHopInterface: route.nextHopInterface.ip
            }
        });
    } catch (error: any) {
        console.error("Error deleting route:", error);
        res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
            success: false,
            error: "Failed to delete route",
            message: error.message
        });
    }
};