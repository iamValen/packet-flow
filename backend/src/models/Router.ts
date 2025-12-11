import { Node, NodeType } from "./Node.js";
import { NetworkInterface } from "./NetworkInterface.js";
import { Packet, Protocol, ARPType, type ARPData } from "./Packet.js";

type ARPEntry = { mac: string; timestamp: number; };

// routing table entry
export type Route = {
    destination: string;
    mask: string;
    cidr: number;
    outInterface: NetworkInterface;
    isDefault: boolean;
};

/**
 * forwards packets between networks
 * has routing table and arp cache
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

    // arp methods
    addARP(ip: string, mac: string): void {
        this.arpCache.set(ip, { mac, timestamp: Date.now() });
    }

    lookupARP(ip: string): string | null {
        const entry = this.arpCache.get(ip);
        if (!entry) return null;
        if (Date.now() - entry.timestamp > this.ARP_TIMEOUT) {
            this.arpCache.delete(ip);
            return null;
        }
        return entry.mac;
    }

    getARPCache(): Map<string, ARPEntry> {
        return new Map(this.arpCache);
    }

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

    // routing methods
    clearRoutes(): void { this.routes = []; }
    getRoutes(): Route[] { return [...this.routes]; }

    addRoute(destination: string, mask: string, outIface: NetworkInterface): void {
        if (!NetworkInterface.isValidIP(destination) || !NetworkInterface.isValidSubnetMask(mask)) {
            throw new Error(`bad route: ${destination}/${mask}`);
        }
        if (!this.interfaces.includes(outIface)) {
            throw new Error(`interface not on this router`);
        }
        // check duplicate
        if (this.routes.some(r => r.destination === destination && r.mask === mask)) {
            throw new Error(`route exists: ${destination}/${mask}`);
        }

        const cidr = NetworkInterface.maskToCidr(mask);
        this.routes.push({
            destination, mask, cidr, outInterface: outIface,
            isDefault: destination === "0.0.0.0" && mask === "0.0.0.0"
        });
        // sort by longest prefix first
        this.routes.sort((a, b) => b.cidr - a.cidr);
    }

    setDefaultRoute(iface: NetworkInterface): void {
        this.addRoute("0.0.0.0", "0.0.0.0", iface);
    }

    // find route for destination
    lookupRoute(dstIp: string): NetworkInterface | null {
        for (const route of this.routes) {
            if (this.matchesRoute(dstIp, route.destination, route.mask)) {
                return route.outInterface;
            }
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

    // find best output interface
    private findOutInterface(dstIp: string): NetworkInterface | null {
        // check directly connected first
        const direct = this.interfaces.find(i => i.isInSubnet(dstIp));
        if (direct) return direct;
        // check routing table
        return this.lookupRoute(dstIp);
    }

    // check if we need arp before forwarding
    needsARP(dstIp: string): { needed: boolean; targetIp: string; outIface: NetworkInterface | null } {
        const outIface = this.findOutInterface(dstIp);
        if (!outIface) return { needed: false, targetIp: dstIp, outIface: null };
        
        // determine what IP to ARP for:
        // - if destination is directly connected, ARP for destination
        // - if destination is remote (via route), ARP for destination on that interface
        //   (in real networks, you'd ARP for next-hop, but our simplified model
        //    routes packets to the right subnet where the destination lives)
        const mac = this.lookupARP(dstIp);
        return { needed: !mac, targetIp: dstIp, outIface };
    }

    // handle incoming packets addressed to us
    receivePacket(packet: Packet): Packet | null {
        packet.addHop(this);

        if (packet.srcMAC && packet.srcMAC !== "FF:FF:FF:FF:FF:FF") {
            this.addARP(packet.srcIp, packet.srcMAC);
        }

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

        if (data.senderIP && data.senderMAC) {
            this.addARP(data.senderIP, data.senderMAC);
        }

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

    // forward packet to next hop
    override forward(packet: Packet, incomingIface?: NetworkInterface): NetworkInterface[] {
        // learn source mac first (before any early returns)
        if (incomingIface && packet.srcMAC && packet.srcMAC !== "FF:FF:FF:FF:FF:FF") {
            this.addARP(packet.srcIp, packet.srcMAC);
        }

        const outIface = this.findOutInterface(packet.dstIp);
        if (!outIface) {
            console.log(`[${this.name}] no route to ${packet.dstIp}`);
            return [];
        }

        // try to resolve dst mac BEFORE modifying packet state
        const dstMAC = this.lookupARP(packet.dstIp);
        if (!dstMAC) {
            // ARP miss - return empty array to let Simulator handle ARP resolution
            // Don't modify packet (TTL, hop) yet - that happens when we actually forward
            // This prevents the packet from being forwarded with broadcast MAC
            // which would cause switches to flood it to all ports
            console.log(`[${this.name}] arp miss for ${packet.dstIp}, waiting for ARP`);
            return [];
        }

        // Now we can actually forward - apply packet modifications
        packet.decrementTTL();
        if (packet.isExpired()) {
            console.log(`[${this.name}] packet expired`);
            return [];
        }

        packet.addHop(this);

        // update macs for next hop
        packet.srcMAC = outIface.mac;
        packet.dstMAC = dstMAC;
        
        console.log(`[${this.name}] forwarding to ${packet.dstIp}`);
        return [outIface];
    }
}