import { StatusCodes } from "http-status-codes";
import { prisma } from "../prisma.js";
import { AppError } from "../middleware/errorHandler.js";
import { NetworkInterface } from "../models/NetworkInterface.js";

class InterfaceService {
    async getAllInterfaces(nodeId: string) {
        if (!nodeId) {
            throw new AppError(StatusCodes.BAD_REQUEST, "Node ID is required");
        }

        const node = await prisma.node.findUnique({
            where: { id: nodeId },
            include: {
                topology: {
                    select: { id: true, name: true }
                }
            }
        });

        if (!node) {
            throw new AppError(StatusCodes.NOT_FOUND, "Node not found");
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
            orderBy: { createdAt: 'asc' }
        });

        return { node, interfaces };
    }

    async getInterfaceById(nodeId: string, interfaceId: string) {
        if (!nodeId || !interfaceId) {
            throw new AppError(StatusCodes.BAD_REQUEST, "Node ID and Interface ID are required");
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
            throw new AppError(StatusCodes.NOT_FOUND, "Interface not found");
        }

        if (iface.nodeId !== nodeId) {
            throw new AppError(StatusCodes.BAD_REQUEST, "Interface does not belong to this node");
        }

        return iface;
    }

    async createInterface(nodeId: string, ip?: string, mask?: string, cidr?: string, mac?: string) {
        if (!nodeId) {
            throw new AppError(StatusCodes.BAD_REQUEST, "Node ID is required");
        }

        const node = await prisma.node.findUnique({
            where: { id: nodeId }
        });

        if (!node) {
            throw new AppError(StatusCodes.NOT_FOUND, "Node not found");
        }

        let finalIp: string;
        let finalMask: string;
        let finalCidr: number;
        let finalMac: string;

        if (cidr) {
            const [ipPart, prefix] = cidr.split("/");
            if (!ipPart || !prefix) {
                throw new AppError(StatusCodes.BAD_REQUEST, "Invalid CIDR notation");
            }

            finalIp = ipPart;
            const prefixNum = parseInt(prefix, 10);
            
            if (!NetworkInterface.isValidIP(finalIp)) {
                throw new AppError(StatusCodes.BAD_REQUEST, `Invalid IP address: ${finalIp}`);
            }

            if (isNaN(prefixNum) || prefixNum < 0 || prefixNum > 32) {
                throw new AppError(StatusCodes.BAD_REQUEST, `Invalid CIDR prefix: ${prefix}. Must be between 0 and 32`);
            }

            finalMask = NetworkInterface.cidrToMask(prefixNum);
            finalCidr = prefixNum;
        } else if (ip && mask) {
            if (!NetworkInterface.isValidIP(ip)) {
                throw new AppError(StatusCodes.BAD_REQUEST, `Invalid IP address: ${ip}`);
            }
            if (!NetworkInterface.isValidSubnetMask(mask)) {
                throw new AppError(StatusCodes.BAD_REQUEST, `Invalid subnet mask: ${mask}`);
            }

            finalIp = ip;
            finalMask = mask;
            finalCidr = NetworkInterface.maskToCidr(mask);
        } else {
            throw new AppError(StatusCodes.BAD_REQUEST, "Either 'cidr' or both 'ip' and 'mask' are required");
        }

        if (mac) {
            if (!NetworkInterface.isValidMAC(mac)) {
                throw new AppError(StatusCodes.BAD_REQUEST, `Invalid MAC address: ${mac}`);
            }
            finalMac = mac.toUpperCase();
        } else {
            finalMac = NetworkInterface.generateMAC();
        }

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

        if (existingIP) {
            throw new AppError(StatusCodes.CONFLICT, `IP address ${finalIp} is already in use by ${existingIP.node.name}`);
        }

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

        return iface;
    }

    async updateInterface(nodeId: string, interfaceId: string, ip?: string, mask?: string, cidr?: string) {
        if (!nodeId || !interfaceId) {
            throw new AppError(StatusCodes.BAD_REQUEST, "Node ID and Interface ID are required");
        }

        const existingInterface = await prisma.networkInterface.findUnique({
            where: { id: interfaceId },
            include: { node: true }
        });

        if (!existingInterface) {
            throw new AppError(StatusCodes.NOT_FOUND, "Interface not found");
        }

        if (existingInterface.nodeId !== nodeId) {
            throw new AppError(StatusCodes.BAD_REQUEST, "Interface does not belong to this node");
        }

        let finalIp: string = existingInterface.ip;
        let finalMask: string = existingInterface.mask;
        let finalCidr: number = existingInterface.cidr;

        if (cidr) {
            const [ipPart, prefix] = cidr.split("/");
            if (!ipPart || !prefix) {
                throw new AppError(StatusCodes.BAD_REQUEST, "Invalid CIDR notation");
            }
            if (!NetworkInterface.isValidIP(ipPart)) {
                throw new AppError(StatusCodes.BAD_REQUEST, `Invalid IP address: ${ipPart}`);
            }

            const prefixNum = parseInt(prefix, 10);
            if (isNaN(prefixNum) || prefixNum < 0 || prefixNum > 32) {
                throw new AppError(StatusCodes.BAD_REQUEST, `Invalid CIDR prefix: ${prefix}. Must be between 0 and 32`);
            }

            finalIp = ipPart;
            finalMask = NetworkInterface.cidrToMask(prefixNum);
            finalCidr = prefixNum;
        } else {
            if (ip !== undefined) {
                if (!NetworkInterface.isValidIP(ip)) {
                    throw new AppError(StatusCodes.BAD_REQUEST, `Invalid IP address: ${ip}`);
                }
                finalIp = ip;
            }

            if (mask !== undefined) {
                if (!NetworkInterface.isValidSubnetMask(mask)) {
                    throw new AppError(StatusCodes.BAD_REQUEST, `Invalid subnet mask: ${mask}`);
                }
                finalMask = mask;
                finalCidr = NetworkInterface.maskToCidr(mask);
            }
        }

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
                throw new AppError(StatusCodes.CONFLICT, `IP address ${finalIp} is already in use by ${duplicate.node.name}`);
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

        return iface;
    }

    async deleteInterface(nodeId: string, interfaceId: string) {
        if (!nodeId || !interfaceId) {
            throw new AppError(StatusCodes.BAD_REQUEST, "Node ID and Interface ID are required");
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
            throw new AppError(StatusCodes.NOT_FOUND, "Interface not found");
        }

        if (iface.nodeId !== nodeId) {
            throw new AppError(StatusCodes.BAD_REQUEST, "Interface does not belong to this node");
        }

        await prisma.networkInterface.delete({
            where: { id: interfaceId }
        });

        return {
            id: iface.id,
            ip: iface.ip,
            mac: iface.mac,
            nodeName: iface.node.name,
            linksCount: iface._count.linksAsA + iface._count.linksAsB
        };
    }
}

export default new InterfaceService();