import type { Request, Response } from "express";
import { PrismaClient } from "@prisma/client";
import { StatusCodes } from "http-status-codes";

import { NetworkInterface } from "../models/NetworkInterface.js";

import { AppError, asyncHandler } from "../middleware/errorHandler.js";

const prisma = new PrismaClient();

/**
 * GET /api/nodes/:nodeId/interfaces
 * Get all interfaces for a node
 */
export const getAllInterfaces = asyncHandler(async (req: Request, res: Response): Promise<void> => {
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
});

/**
 * GET /api/nodes/:nodeId/interfaces/:interfaceId
 * Get a single interface by ID
 */
export const getInterfaceById = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { nodeId, interfaceId } = req.params;

    if (!nodeId || !interfaceId) 
        throw new AppError(StatusCodes.BAD_REQUEST, "Node ID and Interface ID are required");

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

    if (!iface)
        throw new AppError(StatusCodes.NOT_FOUND, "Interface not found");
    if (iface.nodeId !== nodeId)
        throw new AppError(StatusCodes.BAD_REQUEST, "Interface does not belong to this node");

    res.json({
        success: true,
        interface: iface
    });
});

/**
 * POST /api/nodes/:nodeId/interfaces
 * Create a new interface for a node
 * Body: { ip: string, mask: string, mac?: string } OR { cidr: string, mac?: string }
 */
export const createInterface = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { nodeId } = req.params;
    const { ip, mask, cidr, mac } = req.body;

    if (!nodeId)
        throw new AppError(StatusCodes.BAD_REQUEST, "Node ID is required");

    // Verify node exists
    const node = await prisma.node.findUnique({
        where: { id: nodeId }
    });

    if (!node)
        throw new AppError(StatusCodes.NOT_FOUND, "Node not found");

    let finalIp: string;
    let finalMask: string;
    let finalCidr: number;
    let finalMac: string;

    // Parse input - either ip+mask or CIDR notation
    if (cidr) {
        // cidr notation = "192.168.1.10/24"
        const [ipPart, prefix] = cidr.split("/");
        if (!ipPart || !prefix)
            throw new AppError(StatusCodes.BAD_REQUEST, "Invalid CIDR notation");

        finalIp = ipPart;
        const prefixNum = parseInt(prefix, 10);
        
        if (!NetworkInterface.isValidIP(finalIp))
            throw new AppError(StatusCodes.BAD_REQUEST, `Invalid IP address: ${finalIp}`);

        if (isNaN(prefixNum) || prefixNum < 0 || prefixNum > 32)
            throw new AppError(StatusCodes.BAD_REQUEST, `Invalid CIDR prefix: ${prefix}. Must be between 0 and 32`);

        finalMask = NetworkInterface.cidrToMask(prefixNum);
        finalCidr = prefixNum;
    } else if(ip && mask) {
        // ip and mask
        if (!NetworkInterface.isValidIP(ip))
            throw new AppError(StatusCodes.BAD_REQUEST, `Invalid IP address: ${ip}`);
        if (!NetworkInterface.isValidSubnetMask(mask))
            throw new AppError(StatusCodes.BAD_REQUEST, `Invalid subnet mask: ${mask}`);

        finalIp = ip;
        finalMask = mask;
        finalCidr = NetworkInterface.maskToCidr(mask);
    } 
    else 
        throw new AppError(StatusCodes.BAD_REQUEST, "Either 'cidr' or both 'ip' and 'mask' are required");

    // Validate or generate MAC
    if (mac) {
        if (!NetworkInterface.isValidMAC(mac)) 
            throw new AppError(StatusCodes.BAD_REQUEST, `Invalid MAC address: ${mac}`);    
        finalMac = mac.toUpperCase();
    } 
    else 
        finalMac = NetworkInterface.generateMAC();
    

    // Check for duplicate IP in the same topology
    const existingIP = await prisma.networkInterface.findFirst({
        where: {
            node: {
                topologyId: node.topologyId
            },
            ip: finalIp
        },
        include: {
            node: {
                select: { name: true }
            }
        }
    });

    if (existingIP)
        throw new AppError(StatusCodes.CONFLICT, `IP address ${finalIp} is already in use by ${existingIP.node.name}`);
    
    // Create NetworkInterface to calculate network address
    const niModel = new NetworkInterface(finalIp, finalMask, finalMac);
    const networkAddress = niModel.getNetworkAddress();
    const broadcastAddress = niModel.getBroadcastAddress();

    const iface = await prisma.networkInterface.create({
        data: {
            ip: finalIp,
            mask: finalMask,
            cidr: finalCidr,
            mac: finalMac,
            networkAddress,
            broadcastAddress,
            nodeId
        },
        include: {
            node: {
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
        message: "Interface created successfully",
        interface: iface
    });
});

/**
 * PUT /api/nodes/:nodeId/interfaces/:interfaceId
 * Update an interface
 * (MAC address cannot be changed after creation)
 * Body: { ip?: string, mask?: string, cidr?: string }
 */
export const updateInterface = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { nodeId, interfaceId } = req.params;
    const { ip, mask, cidr } = req.body;

    if (!nodeId || !interfaceId)
        throw new AppError(StatusCodes.BAD_REQUEST, "Node ID and Interface ID are required");

    const existingInterface = await prisma.networkInterface.findUnique({
        where: { id: interfaceId },
        include: {
            node: true
        }
    });
    if (!existingInterface)
        throw new AppError(StatusCodes.NOT_FOUND, "Interface not found");

    if (existingInterface.nodeId !== nodeId)
        throw new AppError(StatusCodes.BAD_REQUEST, "Interface does not belong to this node");

    let finalIp: string = existingInterface.ip;
    let finalMask: string = existingInterface.mask;
    let finalCidr: number = existingInterface.cidr;

    // updates
    if (cidr) {
        const [ipPart, prefix] = cidr.split("/");
        if (!ipPart || !prefix)
            throw new AppError(StatusCodes.BAD_REQUEST, "Invalid CIDR notation");
        if (!NetworkInterface.isValidIP(ipPart))
            throw new AppError(StatusCodes.BAD_REQUEST, `Invalid IP address: ${ipPart}`);

        const prefixNum = parseInt(prefix, 10);
        if (isNaN(prefixNum) || prefixNum < 0 || prefixNum > 32)
            throw new AppError(StatusCodes.BAD_REQUEST, `Invalid CIDR prefix: ${prefix}. Must be between 0 and 32`);

        finalIp = ipPart;
        finalMask = NetworkInterface.cidrToMask(prefixNum);
        finalCidr = prefixNum;
    } 
    else {
        if (ip !== undefined) {
            if (!NetworkInterface.isValidIP(ip))
                throw new AppError(StatusCodes.BAD_REQUEST, `Invalid IP address: ${ip}`);
            finalIp = ip;
        }

        if (mask !== undefined) {
            if (!NetworkInterface.isValidSubnetMask(mask))
                throw new AppError(StatusCodes.BAD_REQUEST, `Invalid subnet mask: ${mask}`);

            finalMask = mask;
            finalCidr = NetworkInterface.maskToCidr(mask);
        }
    }

    // Check for duplicate IP if IP is being changed
    if (finalIp !== existingInterface.ip) {
        const duplicate = await prisma.networkInterface.findFirst({
            where: {
                node: {
                    topologyId: existingInterface.node.topologyId
                },
                ip: finalIp,
                id: { not: interfaceId }
            },
            include: {
                node: {
                    select: { name: true }
                }
            }
        });

        if (duplicate)
            throw new AppError(StatusCodes.CONFLICT, `IP address ${finalIp} is already in use by ${duplicate.node.name}`);
    }

    const niModel = new NetworkInterface(finalIp, finalMask, existingInterface.mac);
    const networkAddress = niModel.getNetworkAddress();
    const broadcastAddress = niModel.getBroadcastAddress();

    const iface = await prisma.networkInterface.update({
        where: { id: interfaceId },
        data: {
            ip: finalIp,
            mask: finalMask,
            cidr: finalCidr,
            networkAddress,
            broadcastAddress
        },
        include: {
            node: {
                select: {
                    id: true,
                    name: true,
                    type: true
                }
            }
        }
    });

    res.json({
        success: true,
        message: "Interface updated successfully",
        interface: iface
    });
});

/**
 * DELETE /api/nodes/:nodeId/interfaces/:interfaceId
 * Delete an interface
 */
export const deleteInterface = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { nodeId, interfaceId } = req.params;

    if (!nodeId || !interfaceId)
        throw new AppError(StatusCodes.BAD_REQUEST, "Node ID and Interface ID are required");

    const iface = await prisma.networkInterface.findUnique({
        where: { id: interfaceId },
        include: {
            node: {
                select: { name: true }
            },
            _count: {
                select: {
                    linksAsA: true,
                    linksAsB: true
                }
            }
        }
    });

    if (!iface) 
        throw new AppError(StatusCodes.NOT_FOUND, "Interface not found");

    if (iface.nodeId !== nodeId)
        throw new AppError(StatusCodes.BAD_REQUEST, "Interface does not belong to this node");

    await prisma.networkInterface.delete({
        where: { id: interfaceId }
    });

    res.json({
        success: true,
        message: "Interface deleted successfully",
        deleted: {
            id: iface.id,
            ip: iface.ip,
            mac: iface.mac,
            nodeName: iface.node.name,
            linksCount: iface._count.linksAsA + iface._count.linksAsB
        }
    });
});