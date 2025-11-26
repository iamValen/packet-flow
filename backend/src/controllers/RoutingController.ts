import type { Request, Response } from "express";
import { PrismaClient } from "@prisma/client";
import { StatusCodes } from "http-status-codes";

import { NetworkInterface } from "../models/NetworkInterface.js";

import { AppError, asyncHandler } from "../middleware/errorHandler.js";

const prisma = new PrismaClient();

/**
 * GET /api/nodes/:nodeId/routes
 * Get all routing entries for a router
 */
export const getAllRoutes = asyncHandler(async (req: Request, res: Response): Promise<void>  => {
    const { nodeId } = req.params;

    if (!nodeId) 
        throw new AppError(StatusCodes.BAD_REQUEST, "Node ID is required");

    const node = await prisma.node.findUnique({
        where: { id: nodeId },
        include: { topology: { select: { id: true, name: true } } }
    });

    if (!node)
        throw new AppError(StatusCodes.NOT_FOUND, "Node not found");
    if (node.type !== "ROUTER")
        throw new AppError(StatusCodes.BAD_REQUEST, "Only routers can have routing entries");

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
});

/**
 * POST /api/nodes/:nodeId/routes
 * Add a routing entry to a router
 * Body: { destination: string, mask: string, nextHopInterfaceId: string }
 */
export const createRoute = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { nodeId } = req.params;
    const { destination, mask, nextHopInterfaceId } = req.body;

    if (!nodeId) 
        throw new AppError(StatusCodes.BAD_REQUEST, "Node ID is required");
    if (!destination || !mask || !nextHopInterfaceId)
        throw new AppError(StatusCodes.BAD_REQUEST, "Destination, mask, and nextHopInterfaceId are required");

    if (!NetworkInterface.isValidIP(destination)) 
        throw new AppError(StatusCodes.BAD_REQUEST, `Invalid destination IP: ${destination}`);
    if (!NetworkInterface.isValidSubnetMask(mask)) 
        throw new AppError(StatusCodes.BAD_REQUEST, `Invalid subnet mask: ${mask}`);

    const node = await prisma.node.findUnique({
        where: { id: nodeId },
        include: { interfaces: true }
    });

    if (!node) 
        throw new AppError(StatusCodes.NOT_FOUND, "Node not found");
    if (node.type !== "ROUTER")
        throw new AppError(StatusCodes.BAD_REQUEST, "Only routers can have routing entries");

    //verify interface belongs to this router
    const iface = await prisma.networkInterface.findUnique({
        where: { id: nextHopInterfaceId }
    });
    if (!iface || iface.nodeId !== nodeId)
        throw new AppError(StatusCodes.BAD_REQUEST, "Next hop interface must belong to this router");

    // check if route exists
    const exists = await prisma.routingEntry.findFirst({
        where: {
            nodeId,
            destination,
            mask
        }
    });
    if (exists) 
        throw new AppError(StatusCodes.CONFLICT, "Route already exists");

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
        route: route
    });
});

/**
 * DELETE /api/nodes/:nodeId/routes/:routeId
 * Delete a routing entry
 */
export const deleteRoute = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { nodeId, routeId } = req.params;

    if (!nodeId || !routeId) 
        throw new AppError(StatusCodes.BAD_REQUEST, "Node ID and Route ID are required");

    const route = await prisma.routingEntry.findUnique({
        where: { id: routeId },
        include: {
            nextHopInterface: {
                select: { ip: true }
            }
        }
    });
    if (!route) 
        throw new AppError(StatusCodes.NOT_FOUND, "Route not found");
    // check if route belongs to this node
    if (route.nodeId !== nodeId)
        throw new AppError(StatusCodes.BAD_REQUEST, "Route does not belong to this node");

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
});