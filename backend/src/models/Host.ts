import { Node, NodeType } from "./Node.js";
import { NetworkInterface } from "./NetworkInterface.js";
import { Packet, Protocol, ARPType, type ARPData } from "./Packet.js";

// arp cache entry with timeout tracking
type ARPEntry = {
    mac: string;
    timestamp: number;
};

/**
 * end device that sends/receives packets
 * has arp cache and optional default gateway
 */
export class Host extends Node {
    readonly type: NodeType = NodeType.HOST;
    private arpCache: Map<string, ARPEntry> = new Map();
    private readonly ARP_TIMEOUT = 3600000;  // 1 hour
    defaultGateway?: string;

    constructor(name: string, position: { x: number; y: number }, interfaces: NetworkInterface[] = []) {
        super(name, position, interfaces);
    }

    setDefaultGateway(ip: string): void {
        if (!NetworkInterface.isValidIP(ip)) throw new Error(`bad gateway: ${ip}`);
        this.defaultGateway = ip;
    }

    // find interface that can reach the dst
    private pickInterface(dstIp: string): NetworkInterface | null {
        // direct route?
        for (const iface of this.interfaces) {
            if (iface.isInSubnet(dstIp)) return iface;
        }
        // use gateway
        if (this.defaultGateway) {
            for (const iface of this.interfaces) {
                if (iface.isInSubnet(this.defaultGateway)) return iface;
            }
        }
        return null;
    }

    override canForward(): boolean { return false; }  // hosts dont forward
    override getInterfaces(): NetworkInterface[] { return this.interfaces; }

    override forward(packet: Packet): NetworkInterface[] {
        throw new Error("hosts cant forward packets");
    }

    // arp stuff
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

    private cleanARP(): void {
        const now = Date.now();
        for (const [ip, entry] of this.arpCache) {
            if (now - entry.timestamp > this.ARP_TIMEOUT) {
                this.arpCache.delete(ip);
            }
        }
    }

    // build arp request packet
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

    // create and send a packet
    sendPacket(dstIp: string, protocol: Protocol, payload?: string): { packet: Packet; iface: NetworkInterface } {
        this.cleanARP();

        const iface = this.pickInterface(dstIp);
        if (!iface) {
            throw new Error(`[${this.name}] cant reach ${dstIp} - check gateway config`);
        }

        let dstMAC: string;

        // is dst in our subnet?
        if (iface.isInSubnet(dstIp)) {
            const mac = this.lookupARP(dstIp);
            if (mac) {
                dstMAC = mac;
            } else {
                // need arp first - use broadcast
                this.makeARPRequest(dstIp, iface);
                dstMAC = "FF:FF:FF:FF:FF:FF";
            }
        } else {
            // going through gateway
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

    // handle incoming packet
    receivePacket(packet: Packet): Packet | null {
        this.cleanARP();
        packet.addHop(this);

        // learn sender mac
        if (packet.srcMAC && packet.srcMAC !== "FF:FF:FF:FF:FF:FF") {
            this.addARP(packet.srcIp, packet.srcMAC);
        }

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

    private handleARP(packet: Packet): Packet | null {
        const data: ARPData = JSON.parse(packet.payload!);

        if (data.type === ARPType.REQUEST) {
            // is this for us?
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

    private handleICMP(packet: Packet): Packet | null {
        const myIface = this.interfaces.find(i => i.ip === packet.dstIp);
        if (!myIface) return null;

        // check mac
        if (packet.dstMAC !== "FF:FF:FF:FF:FF:FF" && packet.dstMAC !== myIface.mac) {
            return null;
        }

        console.log(`[${this.name}] got ICMP from ${packet.srcIp}`);

        // reply to echo requests
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