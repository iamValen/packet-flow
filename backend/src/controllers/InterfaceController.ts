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

/**
 * POST /api/nodes/:nodeId/interfaces
 * Create a new interface for a node
 * Body: { ip: string, mask: string, mac?: string } OR { cidr: string, mac?: string }
 */
export const createInterface = async (req: Request, res: Response) => {
    try {
        const { nodeId } = req.params;
        const { ip, mask, cidr, mac } = req.body;

        if (!nodeId) {
            return res.status(StatusCodes.BAD_REQUEST).json({
                success: false,
                error: "Node ID is required"
            });
        }

        // Verify node exists
        const node = await prisma.node.findUnique({
            where: { id: nodeId }
        });

        if (!node) {
            return res.status(StatusCodes.NOT_FOUND).json({
                success: false,
                error: "Node not found"
            });
        }

        let finalIp: string;
        let finalMask: string;
        let finalCidr: number;
        let finalMac: string;

        // Parse input - either ip+mask or CIDR notation
        if (cidr) {
            // CIDR notation like "192.168.1.10/24"
            const [ipPart, prefix] = cidr.split("/");
            if (!ipPart || !prefix) {
                return res.status(StatusCodes.BAD_REQUEST).json({
                    success: false,
                    error: "Invalid CIDR notation. Expected format: '192.168.1.10/24'"
                });
            }

            finalIp = ipPart;
            const prefixNum = parseInt(prefix, 10);
            
            if (!NetworkInterface.isValidIP(finalIp)) {
                return res.status(StatusCodes.BAD_REQUEST).json({
                    success: false,
                    error: `Invalid IP address: ${finalIp}`
                });
            }

            if (isNaN(prefixNum) || prefixNum < 0 || prefixNum > 32) {
                return res.status(StatusCodes.BAD_REQUEST).json({
                    success: false,
                    error: `Invalid CIDR prefix: ${prefix}. Must be between 0 and 32`
                });
            }

            finalMask = NetworkInterface.cidrToMask(prefixNum);
            finalCidr = prefixNum;
        } else if (ip && mask) {
            // Separate IP and mask
            if (!NetworkInterface.isValidIP(ip)) {
                return res.status(StatusCodes.BAD_REQUEST).json({
                    success: false,
                    error: `Invalid IP address: ${ip}`
                });
            }

            if (!NetworkInterface.isValidSubnetMask(mask)) {
                return res.status(StatusCodes.BAD_REQUEST).json({
                    success: false,
                    error: `Invalid subnet mask: ${mask}`
                });
            }

            finalIp = ip;
            finalMask = mask;
            finalCidr = NetworkInterface.maskToCidr(mask);
        } else {
            return res.status(StatusCodes.BAD_REQUEST).json({
                success: false,
                error: "Either 'cidr' or both 'ip' and 'mask' are required"
            });
        }

        // Validate or generate MAC
        if (mac) {
            if (!NetworkInterface.isValidMAC(mac)) {
                return res.status(StatusCodes.BAD_REQUEST).json({
                    success: false,
                    error: `Invalid MAC address: ${mac}`
                });
            }
            finalMac = mac.toUpperCase();
        } else {
            finalMac = NetworkInterface.generateMAC();
        }

        // Check for duplicate IP in the same topology
        const existingInterface = await prisma.networkInterface.findFirst({
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

        if (existingInterface) {
            return res.status(StatusCodes.CONFLICT).json({
                success: false,
                error: `IP address ${finalIp} is already in use by ${existingInterface.node.name}`
            });
        }

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
    } catch (error: any) {
        console.error("Error creating interface:", error);
        res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
            success: false,
            error: "Failed to create interface",
            message: error.message
        });
    }
};

/**
 * PUT /api/nodes/:nodeId/interfaces/:interfaceId
 * Update an interface
 * Body: { ip?: string, mask?: string, cidr?: string }
 * Note: MAC address cannot be changed after creation
 */
export const updateInterface = async (req: Request, res: Response) => {
    try {
        const { nodeId, interfaceId } = req.params;
        const { ip, mask, cidr } = req.body;

        if (!nodeId || !interfaceId) {
            return res.status(StatusCodes.BAD_REQUEST).json({
                success: false,
                error: "Node ID and Interface IDP required"
            });
        }

        const existingInterface = await prisma.networkInterface.findUnique({
            where: { id: interfaceId },
            include: {
                node: true
            }
        });

        if (!existingInterface) {
            return res.status(StatusCodes.NOT_FOUND).json({
                success: false,
                error: "Interface not found"
            });
        }

        if (existingInterface.nodeId !== nodeId) {
            return res.status(StatusCodes.BAD_REQUEST).json({
                success: false,
                error: "Interface does not belong to this node"
            });
        }

        let finalIp: string = existingInterface.ip;
        let finalMask: string = existingInterface.mask;
        let finalCidr: number = existingInterface.cidr;

        // Parse updates
        if (cidr) {
            const [ipPart, prefix] = cidr.split("/");
            if (!ipPart || !prefix) {
                return res.status(StatusCodes.BAD_REQUEST).json({
                    success: false,
                    error: "Invalid CIDR notation"
                });
            }

            if (!NetworkInterface.isValidIP(ipPart)) {
                return res.status(StatusCodes.BAD_REQUEST).json({
                    success: false,
                    error: `Invalid IP address: ${ipPart}`
                });
            }

            const prefixNum = parseInt(prefix, 10);
            if (isNaN(prefixNum) || prefixNum < 0 || prefixNum > 32) {
                return res.status(StatusCodes.BAD_REQUEST).json({
                    success: false,
                    error: `Invalid CIDR prefix: ${prefix}`
                });
            }

            finalIp = ipPart;
            finalMask = NetworkInterface.cidrToMask(prefixNum);
            finalCidr = prefixNum;
        } else {
            if (ip !== undefined) {
                if (!NetworkInterface.isValidIP(ip)) {
                    return res.status(StatusCodes.BAD_REQUEST).json({
                        success: false,
                        error: `Invalid IP address: ${ip}`
                    });
                }
                finalIp = ip;
            }

            if (mask !== undefined) {
                if (!NetworkInterface.isValidSubnetMask(mask)) {
                    return res.status(StatusCodes.BAD_REQUEST).json({
                        success: false,
                        error: `Invalid subnet mask: ${mask}`
                    });
                }
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

            if (duplicate) {
                return res.status(StatusCodes.CONFLICT).json({
                    success: false,
                    error: `IP address ${finalIp} is already in use by ${duplicate.node.name}`
                });
            }
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
    } catch (error: any) {
        console.error("Error updating interface:", error);
        res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
            success: false,
            error: "Failed to update interface",
            message: error.message
        });
    }
};

/**
 * DELETE /api/nodes/:nodeId/interfaces/:interfaceId
 * Delete an interface
 */
export const deleteInterface = async (req: Request, res: Response) => {
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
    } catch (error: any) {
        console.error("Error deleting interface:", error);
        res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
            success: false,
            error: "Failed to delete interface",
            message: error.message
        });
    }
};