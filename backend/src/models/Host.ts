import { Node, NodeType } from "./Node.js";
import { NetworkInterface } from "./NetworkInterface.js";
import { ARPpayloadType, Packet, type ARPpayload } from "./Packet.js";
import { Protocol } from "./Packet.js";

/**
 * Represents a single ARP cache entry
 * Each entry stores a MAC address and its timestamp for aging out old records
 */
export type ARPEntry = {
    mac: string;       // mac address
    timestamp: number; // Timestamp of when it was added
};

/**
 * Represents a host node in the network.
 * Hosts are end devices that can send and receive packets but cannot forward them like routers or switches.
 * Each host can have one or more network interfaces, an ARP cache, and an optional default gateway.
 */
export class Host extends Node {
    readonly type: NodeType = NodeType.HOST;
    private _arpCache: Map<string, ARPEntry>; // Maps IP addresses => MAC entries
    private readonly ARP_CACHE_TIMEOUT = 300000; // 5-minute expiration time
    defaultGateway?: string; // Optional IP address of the default gateway

    /**
     * Create a new Host instance
     * @param name - Human-readable name of the host
     * @param position - UI placement coordinates {x, y}
     * @param interfaces - Optional list of pre-attached network interfaces
     */
    constructor(name: string, position: { x: number; y: number }, interfaces: NetworkInterface[] = []) {
        super(name, position, interfaces);
        this._arpCache = new Map();
    }

    /**
     * Configure the default gateway for this host
     * @param gatewayIp - IP address of the default gateway
     * @throws Error if provided IP is invalid
     */
    setDefaultGateway(gatewayIp: string): void {
        if (!NetworkInterface.isValidIP(gatewayIp))
            throw new Error(`Invalid gateway IP address: ${gatewayIp}`);
        
        this.defaultGateway = gatewayIp;
    }

    /**
     * Select the network interface used to reach a given destination IP.
     * If destination is local, return its subnet interface; otherwise use gateway"s interface.
     * @param dstIp - Destination IP address
     * @returns Selected NetworkInterface or null if unreachable
     */
    private selectInterface(dstIp: string): NetworkInterface | null {
        for (const iface of this.interfaces) {
            if (iface.isInSubnet(dstIp)) 
                return iface;
        }
        if (this.defaultGateway) {
            for (const iface of this.interfaces) {
                if (iface.isInSubnet(this.defaultGateway)) 
                    return iface;
            }
        }
        return null;
    }

    /**
     * Hosts cannot forward packets (only send and receive)
     * @returns Always false
     */
    override canForwardPacket(): boolean { return false; }

    /**
     * Return all network interfaces attached to this host
     * @returns Array of NetworkInterface objects
     */
    override getInterfaces(): NetworkInterface[] { return this.interfaces; }

    /**
     * Hosts cannot forward packets like routers or switches.
     * Calling this method will throw an error to prevent misuse.
     * @param packet - Packet attempted to be forwarded
     * @throws Error indicating forwarding is unsupported
     */
    override forwardPacket(packet: Packet): NetworkInterface[] {
        throw new Error("Hosts cannot forward packets");
    }


    // ARP Cache management

    /**
     * Add a new ARP entry to the cache
     * @param ip - IP address
     * @param mac - MAC address
     */
    addARPEntry(ip: string, mac: string): void {
        this._arpCache.set(ip, { mac, timestamp: Date.now() });
    }   


    /**
     * Look up a MAC address in the ARP cache for a given IP
     * @param ip - IP address to look up
     * @returns MAC address if found and valid, or null if expired/missing
     */
    private lookupARP(ip: string): string | null {
        const entry = this._arpCache.get(ip);
        if (!entry) return null;

        if (Date.now() - entry.timestamp > this.ARP_CACHE_TIMEOUT) {
            this._arpCache.delete(ip);
            return null;
        }
        return entry.mac;
    }

    /**
     * Return a copy of the host"s ARP cache
     * @returns Map of IP => ARPEntry
     */
    getARPCache(): Map<string, ARPEntry> {
        return new Map(this._arpCache);
    }

    /**
     * Remove expired entries from the ARP cache
     */
    private cleanARPCache(): void {
        const now = Date.now();
        for (const [ip, entry] of this._arpCache.entries()) {
            if (now - entry.timestamp > this.ARP_CACHE_TIMEOUT)
                this._arpCache.delete(ip);
        }
    }


    // ARP Handling

    /**
     * Construct an ARP request packet for a target IP
     * @param targetIP - IP address to resolve
     * @param ni - Network interface to send the ARP request from
     * @returns ARP request Packet object
     */
    sendARPrequest(targetIP: string, ni: NetworkInterface): Packet {
        const payload: ARPpayload = {
            action: ARPpayloadType.REQUEST,
            senderIP: ni.ip,
            senderMAC: ni.mac,
            targetIP,
        };

        const arpPacket = new Packet(
            ni.ip,
            targetIP,
            Protocol.ARP,
            JSON.stringify(payload),
            ni.mac,
            "FF:FF:FF:FF:FF:FF"
        );

        arpPacket.logHop(this);
        console.log(`Host ${this.name}: Sending ARP request to get MAC for ${targetIP}`);
        return arpPacket;
    }


    // Packet Sending

    /**
     * Send a packet from this host to a destination IP
     * Performs ARP lookup or ARP request as needed.
     * @param dstIp - Destination IP
     * @param protocol - Protocol (ICMP/TCP/UDP)
     * @param payload - Optional payload string
     * @returns Object containing the created Packet and the source interface used
     */
    sendPacket(dstIp: string, protocol: Protocol, payload?: string): { packet: Packet; sourceInterface: NetworkInterface } {
        this.cleanARPCache();
        const sourceInterface = this.selectInterface(dstIp);
        if (!sourceInterface)
            throw new Error(`No interface available to reach ${dstIp}`);

        let dstMAC: string;

        if (sourceInterface.isInSubnet(dstIp)) {
            const resolvedMAC = this.lookupARP(dstIp);
            if (resolvedMAC) {
                dstMAC = resolvedMAC;
            } else {
                this.sendARPrequest(dstIp, sourceInterface);
                dstMAC = "FF:FF:FF:FF:FF:FF";
            }
        } else {
            if (!this.defaultGateway)
                throw new Error(`No default gateway configured on ${this.name}`);

            const gatewayMAC = this.lookupARP(this.defaultGateway);
            if (gatewayMAC) dstMAC = gatewayMAC;
            else {
                this.sendARPrequest(this.defaultGateway, sourceInterface);
                console.log(`Host ${this.name}: ARP miss for gateway ${this.defaultGateway}, sending ARP request`);
                dstMAC = "FF:FF:FF:FF:FF:FF";
            }
        }

        const packet = new Packet(sourceInterface.ip, dstIp, protocol, payload, sourceInterface.mac, dstMAC);
        packet.logHop(this);
        return { packet, sourceInterface };
    }


    // Packet Receiving

    /**
     * Handle incoming ICMP packets
     * @param packet - Packet received
     * @returns ICMP Echo Reply if it was a request for this host, otherwise null
     */
    receiveICMPpacket(packet: Packet): Packet | null {
        const targetInterface = this.interfaces.find(ni => ni.ip === packet.dstIp);
        if (!targetInterface) return null;

        const isBroadcast = packet.dstMAC === "FF:FF:FF:FF:FF:FF";
        const isForOurMAC = packet.dstMAC === targetInterface.mac;
        if (!isBroadcast && !isForOurMAC) return null;

        console.log(`Host ${this.name} received ICMP from ${packet.srcIp}: ${packet.payload || "ICMP Echo"}`);

        if (packet.protocol === Protocol.ICMP && packet.payload === "ICMP Echo Request") {
            const reply = new Packet(
                targetInterface.ip,
                packet.srcIp,
                Protocol.ICMP,
                "ICMP Echo Reply",
                targetInterface.mac,
                packet.srcMAC
            );
            reply.logHop(this);
            return reply;
        }

        return null;
    }

    /**
     * Handle incoming ARP packets (requests and replies)
     * @param packet - Packet received
     * @returns ARP Reply packet if applicable, otherwise null
     */
    receiveARPpacket(packet: Packet): Packet | null {
        const arpPayload: ARPpayload = JSON.parse(packet.payload!);

        if (arpPayload.action === ARPpayloadType.REQUEST) {
            const ourNI = this.interfaces.find(i => i.ip === arpPayload.targetIP);
            if (ourNI) {
                console.log(`Host ${this.name}: Received ARP request for ${arpPayload.targetIP}, replying...`);

                const replyPayload: ARPpayload = {
                    action: ARPpayloadType.REPLY,
                    senderIP: ourNI.ip,
                    senderMAC: ourNI.mac,
                    targetIP: arpPayload.senderIP,
                    targetMAC: arpPayload.senderMAC
                };

                const reply = new Packet(
                    ourNI.ip,
                    arpPayload.senderIP,
                    Protocol.ARP,
                    JSON.stringify(replyPayload),
                    ourNI.mac,
                    arpPayload.senderMAC
                );

                reply.logHop(this);
                return reply;
            }
        } else if (arpPayload.action === ARPpayloadType.REPLY) {
            console.log(`Host ${this.name}: Received ARP reply from ${packet.srcIp}`);
            this.addARPEntry(arpPayload.senderIP, arpPayload.senderMAC);
        }

        return null;
    }

    /**
     * Handle any incoming packet received by this host
     * Updates ARP cache and routes to protocol-specific handler.
     * @param packet - Packet received by the host
     * @returns Reply packet if generated (ARP/ICMP), otherwise null
     */
    receivePacket(packet: Packet): Packet | null {
        this.cleanARPCache();
        packet.logHop(this);

        if (packet.srcMAC && packet.srcMAC !== "FF:FF:FF:FF:FF:FF")
            this.addARPEntry(packet.srcIp, packet.srcMAC);

        switch (packet.protocol) {
            case Protocol.ARP:
                return this.receiveARPpacket(packet);
            case Protocol.ICMP:
                return this.receiveICMPpacket(packet);
            case Protocol.TCP:
            case Protocol.UDP:
                console.log(`Host ${this.name}: Received ${packet.protocol} packet (payload: ${packet.payload ?? "none"})`);
                return null;
            default:
                console.warn(`Host ${this.name}: Unknown protocol ${packet.protocol}, dropping packet`);
                return null;
        }
    }
}
