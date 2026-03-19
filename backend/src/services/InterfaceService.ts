import { StatusCodes } from "http-status-codes";
import { prisma } from "../prisma.js";
import { AppError } from "../middleware/errorHandler.js";
import { NetworkInterface } from "../models/NetworkInterface.js";

class InterfaceService {
    /**
     * Returns all interfaces for a node, ordered by creation date.
     * @throws if the node is not found
     */
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

    /**
     * Returns a single interface by id.
     * @throws if the interface is not found or does not belong to the given node
     */
    async getById(nodeId: string, ifaceId: string) {
        const iface = await prisma.networkInterface.findUnique({ where: { id: ifaceId } });
        if (!iface) throw new AppError(StatusCodes.NOT_FOUND, "interface not found");
        if (iface.nodeId !== nodeId) throw new AppError(StatusCodes.BAD_REQUEST, "wrong node");
        return iface;
    }

    /**
     * Creates a new network interface on a node.
     * Accepts either CIDR notation or a separate IP + mask.
     * A MAC address is auto-generated if not provided.
     * @throws if the node is not found, the address is invalid, or the IP is already in use in the topology
     */
    async create(nodeId: string, ip?: string, mask?: string, cidr?: string, mac?: string) {
        const node = await prisma.node.findUnique({ where: { id: nodeId } });
        if (!node) throw new AppError(StatusCodes.NOT_FOUND, "node not found");

        let finalIp: string, finalMask: string, finalCidr: number;

        if (cidr) {
            const [ipPart, prefix] = cidr.split("/");
            if (!ipPart || !prefix) throw new AppError(StatusCodes.BAD_REQUEST, "bad cidr");
            finalIp = ipPart;
            const prefixNum = parseInt(prefix, 10);
            if (isNaN(prefixNum) || prefixNum < 0 || prefixNum > 32)
                throw new AppError(StatusCodes.BAD_REQUEST, `bad prefix: ${prefix}`);
            if (!NetworkInterface.isValidIP(finalIp))
                throw new AppError(StatusCodes.BAD_REQUEST, `bad ip: ${finalIp}`);
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

        const finalMac = mac?.toUpperCase() || NetworkInterface.generateMAC();
        if (mac && !NetworkInterface.isValidMAC(mac))
            throw new AppError(StatusCodes.BAD_REQUEST, `bad mac: ${mac}`);

        const existing = await prisma.networkInterface.findFirst({
            where: { node: { topologyId: node.topologyId }, ip: finalIp }
        });
        if (existing) throw new AppError(StatusCodes.CONFLICT, `ip ${finalIp} already used`);

        const niModel = new NetworkInterface(finalIp, finalMask, finalMac);

        return await prisma.networkInterface.create({
            data: {
                ip: finalIp,
                mask: finalMask,
                cidr: finalCidr,
                mac: finalMac,
                networkAddress: niModel.getNetworkAddress(),
                broadcastAddress: niModel.getBroadcastAddress(),
                nodeId
            }
        });
    }

    /**
     * Updates an interface's IP addressing.
     * Accepts either CIDR notation or separate IP + mask fields.
     * @throws if the interface is not found, does not belong to the node, or the new IP is already in use
     */
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
            if (isNaN(prefixNum) || prefixNum < 0 || prefixNum > 32)
                throw new AppError(StatusCodes.BAD_REQUEST, `bad prefix: ${prefix}`);
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

        if (finalIp !== iface.ip) {
            const existing = await prisma.networkInterface.findFirst({
                where: {
                    node: { topologyId: iface.node.topologyId },
                    ip: finalIp,
                    id: { not: ifaceId }
                }
            });
            if (existing) throw new AppError(StatusCodes.CONFLICT, `ip ${finalIp} already used`);
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

    /**
     * Deletes an interface.
     * @throws if the interface is not found or does not belong to the given node
     */
    async delete(nodeId: string, ifaceId: string) {
        const iface = await prisma.networkInterface.findUnique({ where: { id: ifaceId } });
        if (!iface) throw new AppError(StatusCodes.NOT_FOUND, "interface not found");
        if (iface.nodeId !== nodeId) throw new AppError(StatusCodes.BAD_REQUEST, "wrong node");

        await prisma.networkInterface.delete({ where: { id: ifaceId } });
        return { id: iface.id, ip: iface.ip };
    }
}

export default new InterfaceService();