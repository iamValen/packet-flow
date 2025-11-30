import { StatusCodes } from "http-status-codes";
import { prisma } from "../prisma.js";
import { AppError } from "../middleware/errorHandler.js";
import { NetworkInterface } from "../models/NetworkInterface.js";

class RoutingService {
    async getAllRoutes(nodeId: string) {
        if (!nodeId) {
            throw new AppError(StatusCodes.BAD_REQUEST, "Node ID is required");
        }

        const node = await prisma.node.findUnique({
            where: { id: nodeId },
            include: { topology: { select: { id: true, name: true } } }
        });

        if (!node) {
            throw new AppError(StatusCodes.NOT_FOUND, "Node not found");
        }

        if (node.type !== "ROUTER") {
            throw new AppError(StatusCodes.BAD_REQUEST, "Only routers can have routing entries");
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

        return { node, routes };
    }

    async createRoute(nodeId: string, destination: string, mask: string, nextHopInterfaceId: string) {
        if (!nodeId) {
            throw new AppError(StatusCodes.BAD_REQUEST, "Node ID is required");
        }

        if (!destination || !mask || !nextHopInterfaceId) {
            throw new AppError(StatusCodes.BAD_REQUEST, "Destination, mask, and nextHopInterfaceId are required");
        }

        if (!NetworkInterface.isValidIP(destination)) {
            throw new AppError(StatusCodes.BAD_REQUEST, `Invalid destination IP: ${destination}`);
        }

        if (!NetworkInterface.isValidSubnetMask(mask)) {
            throw new AppError(StatusCodes.BAD_REQUEST, `Invalid subnet mask: ${mask}`);
        }

        const node = await prisma.node.findUnique({
            where: { id: nodeId },
            include: { interfaces: true }
        });

        if (!node) {
            throw new AppError(StatusCodes.NOT_FOUND, "Node not found");
        }

        if (node.type !== "ROUTER") {
            throw new AppError(StatusCodes.BAD_REQUEST, "Only routers can have routing entries");
        }

        const iface = await prisma.networkInterface.findUnique({
            where: { id: nextHopInterfaceId }
        });

        if (!iface || iface.nodeId !== nodeId) {
            throw new AppError(StatusCodes.BAD_REQUEST, "Next hop interface must belong to this router");
        }

        const exists = await prisma.routingEntry.findFirst({
            where: {
                nodeId,
                destination,
                mask
            }
        });

        if (exists) {
            throw new AppError(StatusCodes.CONFLICT, "Route already exists");
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

        return route;
    }

    async deleteRoute(nodeId: string, routeId: string) {
        if (!nodeId || !routeId) {
            throw new AppError(StatusCodes.BAD_REQUEST, "Node ID and Route ID are required");
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
            throw new AppError(StatusCodes.NOT_FOUND, "Route not found");
        }

        if (route.nodeId !== nodeId) {
            throw new AppError(StatusCodes.BAD_REQUEST, "Route does not belong to this node");
        }

        await prisma.routingEntry.delete({
            where: { id: routeId }
        });

        return {
            id: route.id,
            destination: route.destination,
            mask: route.mask,
            nextHopInterface: route.nextHopInterface.ip
        };
    }
}

export default new RoutingService();