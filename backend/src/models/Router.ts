import { Node, NodeType } from "./Node.js";
import { NetworkInterface } from "./NetworkInterface.js";
import { Packet, Protocol, ARPType, type ARPData } from "./Packet.js";

type ARPEntry = { mac: string; timestamp: number; };

/** A routing table entry. */
export type Route = {
    destination: string;
    mask: string;
    cidr: number;
    outInterface: NetworkInterface;
    isDefault: boolean;
};

/**
 * Layer-3 router that forwards packets between networks.
 * Maintains a routing table and an ARP cache.
 */
export class Router extends Node {
    readonly type: NodeType = NodeType.ROUTER;
    routes: Route[] = [];
    private arpCache: Map<string, ARPEntry> = new Map();
    private readonly ARP_TIMEOUT = 3600000;  // 1 hour

    constructor(name: string, position: { x: number; y: number }, interfaces: NetworkInterface[] = []) {
        super(name, position, interfaces);
    }

    override canForward(): boolean { return true; }
    override getInterfaces(): NetworkInterface[] { return this.interfaces; }

    /** Adds or refreshes an ARP cache entry. */
    addARP(ip: string, mac: string): void {
        this.arpCache.set(ip, { mac, timestamp: Date.now() });
    }

    /**
     * Looks up a MAC address in the ARP cache.
     * @returns the MAC address, or null if not found or expired
     */
    lookupARP(ip: string): string | null {
        const entry = this.arpCache.get(ip);
        if (!entry) return null;
        if (Date.now() - entry.timestamp > this.ARP_TIMEOUT) {
            this.arpCache.delete(ip);
            return null;
        }
        return entry.mac;
    }

    /** Returns a copy of the ARP cache. */
    getARPCache(): Map<string, ARPEntry> {
        return new Map(this.arpCache);
    }

    /** Builds and returns an ARP request packet for the given target IP. */
    makeARPRequest(targetIP: string, iface: NetworkInterface): Packet {
        const data: ARPData = {
            type: ARPType.REQUEST,
            senderIP: iface.ip,
            senderMAC: iface.mac,
            targetIP
        };
        const pkt = new Packet(
            iface.ip, targetIP, Protocol.ARP,
            JSON.stringify(data), iface.mac, "FF:FF:FF:FF:FF:FF"
        );
        console.log(`[${this.name}] ARP who-has ${targetIP}?`);
        return pkt;
    }

    /** Clears all routing table entries. */
    clearRoutes(): void { this.routes = []; }

    /** Returns a copy of the routing table. */
    getRoutes(): Route[] { return [...this.routes]; }

    /**
     * Adds a route to the routing table, sorted by longest prefix match.
     * @throws if destination/mask are invalid, the interface is not on this router, or the route already exists
     */
    addRoute(destination: string, mask: string, outIface: NetworkInterface): void {
        if (!NetworkInterface.isValidIP(destination) || !NetworkInterface.isValidSubnetMask(mask))
            throw new Error(`bad route: ${destination}/${mask}`);
        if (!this.interfaces.includes(outIface))
            throw new Error(`interface not on this router`);
        if (this.routes.some(r => r.destination === destination && r.mask === mask))
            throw new Error(`route exists: ${destination}/${mask}`);

        const cidr = NetworkInterface.maskToCidr(mask);
        this.routes.push({
            destination, mask, cidr, outInterface: outIface,
            isDefault: destination === "0.0.0.0" && mask === "0.0.0.0"
        });
        this.routes.sort((a, b) => b.cidr - a.cidr);
    }

    /** Adds a default route (0.0.0.0/0) via the given interface. */
    setDefaultRoute(iface: NetworkInterface): void {
        this.addRoute("0.0.0.0", "0.0.0.0", iface);
    }

    /**
     * Looks up the outgoing interface for a destination IP using longest-prefix match.
     * @returns the matching interface, or null if no route is found
     */
    lookupRoute(dstIp: string): NetworkInterface | null {
        for (const route of this.routes) {
            if (this.matchesRoute(dstIp, route.destination, route.mask))
                return route.outInterface;
        }
        return null;
    }

    private matchesRoute(ip: string, network: string, mask: string): boolean {
        const ipParts = ip.split(".").map(Number);
        const netParts = network.split(".").map(Number);
        const maskParts = mask.split(".").map(Number);
        for (let i = 0; i < 4; i++) {
            if ((ipParts[i]! & maskParts[i]!) !== (netParts[i]! & maskParts[i]!)) return false;
        }
        return true;
    }

    /**
     * Finds the best outgoing interface for a destination,
     * preferring directly connected subnets over routing table entries.
     */
    private findOutInterface(dstIp: string): NetworkInterface | null {
        const direct = this.interfaces.find(i => i.isInSubnet(dstIp));
        if (direct) return direct;
        return this.lookupRoute(dstIp);
    }

    /**
     * Checks whether an ARP request is needed before forwarding to the destination.
     * @todo In real networks, if dstIp is not in the same subnet as outIface, we should ARP for the gateway instead.
     */
    needsARP(dstIp: string): { needed: boolean; targetIp: string; outIface: NetworkInterface | null } {
        const outIface = this.findOutInterface(dstIp);
        if (!outIface) return { needed: false, targetIp: dstIp, outIface: null };
        const mac = this.lookupARP(dstIp);
        return { needed: !mac, targetIp: dstIp, outIface };
    }

    /**
     * Processes a packet addressed to this router (ARP or ICMP).
     * @returns a reply packet, or null if no reply is needed
     */
    receivePacket(packet: Packet): Packet | null {
        packet.addHop(this);

        if (packet.srcMAC && packet.srcMAC !== "FF:FF:FF:FF:FF:FF")
            this.addARP(packet.srcIp, packet.srcMAC);

        switch (packet.protocol) {
            case Protocol.ARP:
                return this.handleARP(packet);
            case Protocol.ICMP:
                return this.handleICMP(packet);
            default:
                return null;
        }
    }

    private handleARP(packet: Packet): Packet | null {
        const data: ARPData = JSON.parse(packet.payload!);

        if (data.senderIP && data.senderMAC)
            this.addARP(data.senderIP, data.senderMAC);

        if (data.type === ARPType.REQUEST) {
            const myIface = this.interfaces.find(i => i.ip === data.targetIP);
            if (myIface) {
                console.log(`[${this.name}] ARP reply ${myIface.ip}`);
                const reply: ARPData = {
                    type: ARPType.REPLY,
                    senderIP: myIface.ip,
                    senderMAC: myIface.mac,
                    targetIP: data.senderIP,
                    targetMAC: data.senderMAC
                };
                const pkt = new Packet(
                    myIface.ip, data.senderIP, Protocol.ARP,
                    JSON.stringify(reply), myIface.mac, data.senderMAC
                );
                pkt.addHop(this);
                return pkt;
            }
        } else if (data.type === ARPType.REPLY) {
            this.addARP(data.senderIP, data.senderMAC);
        }
        return null;
    }

    private handleICMP(packet: Packet): Packet | null {
        const myIface = this.interfaces.find(i => i.ip === packet.dstIp);
        if (!myIface) return null;
        if (packet.dstMAC !== "FF:FF:FF:FF:FF:FF" && packet.dstMAC !== myIface.mac) return null;

        console.log(`[${this.name}] got ICMP from ${packet.srcIp}`);

        if (packet.payload === "ICMP Echo Request") {
            const reply = new Packet(
                myIface.ip, packet.srcIp, Protocol.ICMP,
                "ICMP Echo Reply", myIface.mac, packet.srcMAC
            );
            reply.addHop(this);
            return reply;
        }
        return null;
    }

    /**
     * Forwards a packet to the next hop.
     * Learns the source MAC, resolves the destination MAC via ARP cache,
     * and updates packet headers before sending.
     * @todo Router should generate and send an ARP request on cache miss instead of dropping.
     */
    override forward(packet: Packet, incomingIface?: NetworkInterface): NetworkInterface[] {
        if (incomingIface && packet.srcMAC && packet.srcMAC !== "FF:FF:FF:FF:FF:FF")
            this.addARP(packet.srcIp, packet.srcMAC);

        const outIface = this.findOutInterface(packet.dstIp);
        if (!outIface) {
            console.log(`[${this.name}] no route to ${packet.dstIp}`);
            return [];
        }

        const dstMAC = this.lookupARP(packet.dstIp);
        if (!dstMAC) {
            console.log(`[${this.name}] arp miss for ${packet.dstIp}, waiting for ARP`);
            return [];
        }

        packet.decrementTTL();
        if (packet.isExpired()) {
            console.log(`[${this.name}] packet expired`);
            return [];
        }

        packet.addHop(this);
        packet.srcMAC = outIface.mac;
        packet.dstMAC = dstMAC;

        console.log(`[${this.name}] forwarding to ${packet.dstIp}`);
        return [outIface];
    }
}