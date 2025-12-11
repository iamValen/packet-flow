import { StatusCodes } from "http-status-codes";

import { prisma } from "../prisma.js";
import { AppError } from "../middleware/errorHandler.js";
import { NetworkInterface } from "../models/NetworkInterface.js";

class InterfaceService {
    async getAll(nodeId: string) {
        const node = await prisma.node.findUnique({
            where: { id: nodeId },
            include: { topology: { select: { id: true, name: true } } }
        });
        if (!node) throw new AppError(StatusCodes.NOT_FOUND, "node not found");

        const ifaces = await prisma.networkInterface.findMany({
            where: { nodeId },
            orderBy: { createdAt: "asc" }
        });
        return { node, interfaces: ifaces };
    }

    async getById(nodeId: string, ifaceId: string) {
        const iface = await prisma.networkInterface.findUnique({ where: { id: ifaceId } });
        if (!iface) throw new AppError(StatusCodes.NOT_FOUND, "interface not found");
        if (iface.nodeId !== nodeId) throw new AppError(StatusCodes.BAD_REQUEST, "wrong node");
        return iface;
    }

    async create(nodeId: string, ip?: string, mask?: string, cidr?: string, mac?: string) {
        const node = await prisma.node.findUnique({ where: { id: nodeId } });
        if (!node) throw new AppError(StatusCodes.NOT_FOUND, "node not found");

        let finalIp: string, finalMask: string, finalCidr: number;

        // parse cidr notation or ip/mask
        if (cidr) {
            const [ipPart, prefix] = cidr.split("/");
            if (!ipPart || !prefix) throw new AppError(StatusCodes.BAD_REQUEST, "bad cidr");
            finalIp = ipPart;
            const prefixNum = parseInt(prefix, 10);
            if (isNaN(prefixNum) || prefixNum < 0 || prefixNum > 32) {
                throw new AppError(StatusCodes.BAD_REQUEST, `bad prefix: ${prefix}`);
            }
            if (!NetworkInterface.isValidIP(finalIp)) throw new AppError(StatusCodes.BAD_REQUEST, `bad ip: ${finalIp}`);
            finalMask = NetworkInterface.cidrToMask(prefixNum);
            finalCidr = prefixNum;
        } else if (ip && mask) {
            if (!NetworkInterface.isValidIP(ip)) throw new AppError(StatusCodes.BAD_REQUEST, `bad ip: ${ip}`);
            if (!NetworkInterface.isValidSubnetMask(mask)) throw new AppError(StatusCodes.BAD_REQUEST, `bad mask: ${mask}`);
            finalIp = ip;
            finalMask = mask;
            finalCidr = NetworkInterface.maskToCidr(mask);
        } else {
            throw new AppError(StatusCodes.BAD_REQUEST, "need cidr or ip+mask");
        }

        // generate mac if not provided
        let finalMac = mac?.toUpperCase() || NetworkInterface.generateMAC();
        if (mac && !NetworkInterface.isValidMAC(mac)) {
            throw new AppError(StatusCodes.BAD_REQUEST, `bad mac: ${mac}`);
        }

        // check ip not taken in this topology
        const existing = await prisma.networkInterface.findFirst({
            where: { node: { topologyId: node.topologyId }, ip: finalIp }
        });
        if (existing) throw new AppError(StatusCodes.CONFLICT, `ip ${finalIp} already used`);

        // calc network and broadcast
        const niModel = new NetworkInterface(finalIp, finalMask, finalMac);
        const networkAddr = niModel.getNetworkAddress();
        const broadcastAddr = niModel.getBroadcastAddress();

        return await prisma.networkInterface.create({
            data: {
                ip: finalIp,
                mask: finalMask,
                cidr: finalCidr,
                mac: finalMac,
                networkAddress: networkAddr,
                broadcastAddress: broadcastAddr,
                nodeId
            }
        });
    }

    async update(nodeId: string, ifaceId: string, ip?: string, mask?: string, cidr?: string) {
        const iface = await prisma.networkInterface.findUnique({
            where: { id: ifaceId },
            include: { node: true }
        });
        if (!iface) throw new AppError(StatusCodes.NOT_FOUND, "interface not found");
        if (iface.nodeId !== nodeId) throw new AppError(StatusCodes.BAD_REQUEST, "wrong node");

        let finalIp = iface.ip;
        let finalMask = iface.mask;
        let finalCidr = iface.cidr;

        if (cidr) {
            const [ipPart, prefix] = cidr.split("/");
            if (!ipPart || !prefix) throw new AppError(StatusCodes.BAD_REQUEST, "bad cidr");
            if (!NetworkInterface.isValidIP(ipPart)) throw new AppError(StatusCodes.BAD_REQUEST, `bad ip: ${ipPart}`);
            const prefixNum = parseInt(prefix, 10);
            if (isNaN(prefixNum) || prefixNum < 0 || prefixNum > 32) {
                throw new AppError(StatusCodes.BAD_REQUEST, `bad prefix: ${prefix}`);
            }
            finalIp = ipPart;
            finalMask = NetworkInterface.cidrToMask(prefixNum);
            finalCidr = prefixNum;
        } else {
            if (ip !== undefined) {
                if (!NetworkInterface.isValidIP(ip)) throw new AppError(StatusCodes.BAD_REQUEST, `bad ip: ${ip}`);
                finalIp = ip;
            }
            if (mask !== undefined) {
                if (!NetworkInterface.isValidSubnetMask(mask)) throw new AppError(StatusCodes.BAD_REQUEST, `bad mask: ${mask}`);
                finalMask = mask;
                finalCidr = NetworkInterface.maskToCidr(mask);
            }
        }

        // check ip not taken by another interface
        if (finalIp !== iface.ip) {
            const existing = await prisma.networkInterface.findFirst({
                where: {
                    node: { topologyId: iface.node.topologyId },
                    ip: finalIp,
                    id: { not: ifaceId }
                }
            });
            if (existing) throw new AppError(409, `ip ${finalIp} already used`);
        }

        const niModel = new NetworkInterface(finalIp, finalMask, iface.mac);

        return await prisma.networkInterface.update({
            where: { id: ifaceId },
            data: {
                ip: finalIp,
                mask: finalMask,
                cidr: finalCidr,
                networkAddress: niModel.getNetworkAddress(),
                broadcastAddress: niModel.getBroadcastAddress()
            }
        });
    }

    async delete(nodeId: string, ifaceId: string) {
        const iface = await prisma.networkInterface.findUnique({ where: { id: ifaceId } });
        if (!iface) throw new AppError(StatusCodes.NOT_FOUND, "interface not found");
        if (iface.nodeId !== nodeId) throw new AppError(StatusCodes.BAD_REQUEST, "wrong node");

        await prisma.networkInterface.delete({ where: { id: ifaceId } });
        return { id: iface.id, ip: iface.ip };
    }
}

export default new InterfaceService();