import { Node, NodeType } from "./Node.js";
import { NetworkInterface } from "./NetworkInterface.js";
import { Packet, Protocol, ARPType, type ARPData } from "./Packet.js";

/** ARP cache entry with expiry tracking. */
type ARPEntry = {
    mac: string;
    timestamp: number;
};

/**
 * End-host node that sends and receives packets.
 * Maintains an ARP cache and supports an optional default gateway.
 */
export class Host extends Node {
    readonly type: NodeType = NodeType.HOST;
    private arpCache: Map<string, ARPEntry> = new Map();
    private readonly ARP_TIMEOUT = 3600000;  // 1 hour
    defaultGateway?: string;

    constructor(name: string, position: { x: number; y: number }, interfaces: NetworkInterface[] = []) {
        super(name, position, interfaces);
    }

    /** Sets the default gateway IP. Throws if the IP is invalid. */
    setDefaultGateway(ip: string): void {
        if (!NetworkInterface.isValidIP(ip)) throw new Error(`bad gateway: ${ip}`);
        this.defaultGateway = ip;
    }

    /**
     * Finds the outgoing interface that can reach the destination.
     * Falls back to the interface that can reach the default gateway.
     * If multiple interfaces are in the same subnet, the first one is used.
     */
    private pickInterface(dstIp: string): NetworkInterface | null {
        for (const iface of this.interfaces) {
            if (iface.isInSubnet(dstIp)) return iface;
        }
        if (this.defaultGateway) {
            for (const iface of this.interfaces) {
                if (iface.isInSubnet(this.defaultGateway)) return iface;
            }
        }
        return null;
    }

    /** Hosts do not forward packets. */
    override canForward(): boolean { return false; }
    override getInterfaces(): NetworkInterface[] { return this.interfaces; }

    override forward(_packet: Packet): NetworkInterface[] {
        throw new Error("hosts cant forward packets");
    }

    /** Adds or refreshes an ARP cache entry. */
    addARP(ip: string, mac: string): void {
        this.arpCache.set(ip, { mac, timestamp: Date.now() });
    }

    /**
     * Looks up a MAC address in the ARP cache.
     * @returns the MAC address, or null if not found or expired
     */
    lookupARP(ip: string): string | null {
        const entry: ARPEntry | undefined = this.arpCache.get(ip);
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

    /** Removes expired entries from the ARP cache. */
    private cleanARP(): void {
        const now = Date.now();
        for (const [ip, entry] of this.arpCache) {
            if (now - entry.timestamp > this.ARP_TIMEOUT)
                this.arpCache.delete(ip);
        }
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
        pkt.addHop(this);
        console.log(`[${this.name}] ARP who-has ${targetIP}?`);
        return pkt;
    }

    /**
     * Creates and prepares a packet for sending.
     * If the destination MAC is unknown, an ARP request is issued first.
     * @returns the packet and the outgoing interface
     */
    sendPacket(dstIp: string, protocol: Protocol, payload?: string): { packet: Packet; iface: NetworkInterface } {
        this.cleanARP();

        const iface = this.pickInterface(dstIp);
        if (!iface)
            throw new Error(`[${this.name}] cant reach ${dstIp} - check gateway config`);

        let dstMAC: string;

        if (iface.isInSubnet(dstIp)) {
            const mac = this.lookupARP(dstIp);
            if (mac) {
                dstMAC = mac;
            } else {
                this.makeARPRequest(dstIp, iface);
                dstMAC = "FF:FF:FF:FF:FF:FF";
            }
        } else {
            if (!this.defaultGateway) throw new Error(`[${this.name}] no gateway set`);
            const gwMAC = this.lookupARP(this.defaultGateway);
            if (gwMAC) {
                dstMAC = gwMAC;
            } else {
                this.makeARPRequest(this.defaultGateway, iface);
                dstMAC = "FF:FF:FF:FF:FF:FF";
            }
        }

        const pkt = new Packet(iface.ip, dstIp, protocol, payload, iface.mac, dstMAC);
        pkt.addHop(this);
        return { packet: pkt, iface };
    }

    /**
     * Handles an incoming packet. Learns the sender's MAC,
     * then dispatches to the appropriate protocol handler.
     * @returns a reply packet, or null if no reply is needed
     */
    receivePacket(packet: Packet): Packet | null {
        this.cleanARP();
        packet.addHop(this);

        if (packet.srcMAC && packet.srcMAC !== "FF:FF:FF:FF:FF:FF")
            this.addARP(packet.srcIp, packet.srcMAC);

        switch (packet.protocol) {
            case Protocol.ARP:
                return this.handleARP(packet);
            case Protocol.ICMP:
                return this.handleICMP(packet);
            case Protocol.UDP:
                console.log(`[${this.name}] got UDP: ${packet.payload || "(empty)"}`);
                return null;
            default:
                return null;
        }
    }

    /** Handles ARP requests (replies if targeted at us) and ARP replies (learns the MAC). */
    private handleARP(packet: Packet): Packet | null {
        const data: ARPData = JSON.parse(packet.payload!);

        if (data.type === ARPType.REQUEST) {
            const myIface = this.interfaces.find(i => i.ip === data.targetIP);
            if (myIface) {
                console.log(`[${this.name}] ARP reply to ${data.senderIP}`);
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
            console.log(`[${this.name}] learned ${data.senderIP} = ${data.senderMAC}`);
            this.addARP(data.senderIP, data.senderMAC);
        }
        return null;
    }

    /** Handles ICMP packets. Replies to echo requests addressed to one of our interfaces. */
    private handleICMP(packet: Packet): Packet | null {
        const myIface = this.interfaces.find(i => i.ip === packet.dstIp);
        if (!myIface) return null;

        if (packet.dstMAC !== "FF:FF:FF:FF:FF:FF" && packet.dstMAC !== myIface.mac)
            return null;

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
}