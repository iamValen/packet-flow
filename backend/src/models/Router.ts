import { Node, NodeType } from "./Node.js";
import { NetworkInterface } from "./NetworkInterface.js";
import { Packet, Protocol, type ARPpayload, ARPpayloadType } from "./Packet.js";
import type { ARPEntry } from "./Host.js";

/**
 * Firewall action type
 * ALLOW = packet passes through
 * DROP = packet blocked
 */
const FirewallAction = {
    ALLOW: "ALLOW",
    DROP: "DROP",
} as const;
type FirewallAction = (typeof FirewallAction)[keyof typeof FirewallAction];

/**
 * Represents a firewall rule entry
 */
export type FirewallRule = {
    id: string;
    srcIp: string;
    dstIp: string;
    protocol: Protocol | null; 
    action: FirewallAction; // Action to take (ALLOW or DROP)
    priority: number; // Lower number = higher priority
};

/**
 * Represents a routing table entry
 */
export type RouteEntry = {
    destination: string;               // Destination network prefix
    mask: string;                      // Subnet mask
    cidr: number;                      // CIDR equivalent
    nextHopInterface: NetworkInterface; // Outgoing interface for the route
    isDefault: boolean;                // True if this is default route (0.0.0.0/0)
};

/**
 * Router node capable of forwarding packets, managing ARP cache, and applying firewall rules
 */
export class Router extends Node {
    readonly type: NodeType = NodeType.ROUTER;

    routingTable: RouteEntry[];                  // List of routing entries
    private _arpCache: Map<string, ARPEntry>;    // ARP cache: IP => MAC
    private readonly ARP_CACHE_TIMEOUT = 300_000; // ARP cache expiration in ms (5 min)

    private _rules: FirewallRule[] = [];         // List of firewall rules
    private _defaultPolicy: FirewallAction = FirewallAction.ALLOW; // Default firewall policy

    /**
     * Create a new Router instance
     * @param name - Router name
     * @param position - Visualization coordinates (x, y)
     * @param interfaces - Optional pre-attached network interfaces
     */
    constructor(
        name: string,
        position: { x: number; y: number },
        interfaces: NetworkInterface[] = []
    ) {
        super(name, position, interfaces);
        this.routingTable = [];
        this._arpCache = new Map();
    }

    /**
     * Determines whether this router can forward packets
     * @returns Always true for routers
     */
    override canForwardPacket(): boolean {
        return true;
    }

    /**
     * Get all interfaces attached to this router
     * @returns Array of NetworkInterface objects
     */
    override getInterfaces(): NetworkInterface[] {
        return this.interfaces;
    }


    // ARP Methods

    /**
     * Add an ARP cache entry mapping IP => MAC
     * @param ip - IPv4 address
     * @param mac - MAC address
     */
    addARPEntry(ip: string, mac: string): void {
        this._arpCache.set(ip, { mac, timestamp: Date.now() });
    }

    /**
     * Look up a MAC address in the ARP cache
     * @param ip - Destination IPv4 address
     * @returns MAC address if found and valid; null if missing or expired
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
     * Return a copy of the current ARP cache
     * @returns Map of IP => ARPEntry
     */
    getARPCache(): Map<string, ARPEntry> {
        return new Map(this._arpCache);
    }

    /**
     * Remove expired entries from ARP cache
     */
    private cleanARPCache(): void {
        const now = Date.now();
        for (const [ip, entry] of this._arpCache.entries()) {
            if (now - entry.timestamp > this.ARP_CACHE_TIMEOUT)
                this._arpCache.delete(ip);
        }
    }

    /**
     * Create an ARP request packet for a target IP
     * @param targetIP - Destination IP to query
     * @param ni - Interface used to send the ARP request
     * @returns Packet representing the ARP request
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
            "FF:FF:FF:FF:FF:FF" // Broadcast MAC
        );

        console.log(`Router ${this.name}: Sending ARP request for ${targetIP}`);
        return arpPacket;
    }

    public needsArpResolution(dstIp: string): { needed: boolean; targetIp: string; outInterface: NetworkInterface | null } {
        const outInterface = this.findOutgoingInterface(dstIp);
        if (!outInterface) return { needed: false, targetIp: dstIp, outInterface: null };
        
        const nextHopIp = dstIp;
        const nextHopMAC = this.lookupARP(nextHopIp);
        
        return {
            needed: !nextHopMAC,
            targetIp: nextHopIp,
            outInterface
        };
    }


    // Receive Packets 

    /**
     * Handle an incoming ICMP packet
     * @param packet - Packet received
     * @returns ICMP Echo Reply if the packet is ICMP Echo Request for this router; otherwise null
     */
    receiveICMPpacket(packet: Packet): Packet | null {
        const targetInterface = this.interfaces.find(ni => ni.ip === packet.dstIp);
        if (!targetInterface) return null;

        const isBroadcast = packet.dstMAC === "FF:FF:FF:FF:FF:FF";
        const isForOurMAC = packet.dstMAC === targetInterface.mac;
        if (!isBroadcast && !isForOurMAC) return null;

        console.log(`Router ${this.name} received ICMP from ${packet.srcIp}: ${packet.payload || "ICMP Echo"}`);

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
     * Handle an incoming ARP packet
     * @param packet - Packet received
     * @returns ARP Reply if packet is a request for this router; otherwise null
     */
    receiveARPpacket(packet: Packet): Packet | null {
        const arpPayload: ARPpayload = JSON.parse(packet.payload!);

        if (arpPayload.senderIP && arpPayload.senderMAC)
            this.addARPEntry(arpPayload.senderIP, arpPayload.senderMAC);

        if (arpPayload.action === ARPpayloadType.REQUEST) {
            const ourNI = this.interfaces.find(i => i.ip === arpPayload.targetIP);
            if (ourNI) {
                console.log(`Router ${this.name}: Received ARP request for ${arpPayload.targetIP}, replying...`);

                const replyPayload: ARPpayload = {
                    action: ARPpayloadType.REPLY,
                    senderIP: ourNI.ip,
                    senderMAC: ourNI.mac,
                    targetIP: arpPayload.senderIP,
                    targetMAC: arpPayload.senderMAC,
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
            console.log(`Router ${this.name}: Received ARP reply from ${packet.srcIp}`);
            this.addARPEntry(arpPayload.senderIP, arpPayload.senderMAC);
        }

        return null;
    }

    /**
     * Handle a general incoming packet
     * @param packet - Packet received
     * @returns Reply packet if generated (ARP/ICMP), otherwise null
     */
    receivePacket(packet: Packet): Packet | null {
        this.cleanARPCache();
        packet.logHop(this);

        if (packet.srcMAC && packet.srcMAC !== "FF:FF:FF:FF:FF:FF")
            this.addARPEntry(packet.srcIp, packet.srcMAC);

        switch (packet.protocol) {
            case Protocol.ARP: return this.receiveARPpacket(packet);
            case Protocol.ICMP: return this.receiveICMPpacket(packet);
            default: return null;
        }
    }


    // Routing Methods

    /**
     * Add a static route to the routing table
     * @param destination - Network prefix (IPv4)
     * @param mask - Subnet mask (IPv4)
     * @param nextHopInterface - Interface to forward packets to
     * @throws Error if route already exists or inputs are invalid
     */
    addRoute(destination: string, mask: string, nextHopInterface: NetworkInterface): void {
        if (!NetworkInterface.isValidIP(destination) || !NetworkInterface.isValidSubnetMask(mask))
            throw new Error(`Invalid network or mask: ${destination}/${mask}`);

        if (!this.interfaces.includes(nextHopInterface))
            throw new Error(`Next-hop interface does not belong to router ${this.name}`);

        if (this.routingTable.some(r => r.destination === destination && r.mask === mask))
            throw new Error(`Route ${destination}/${mask} already exists`);

        const cidr = NetworkInterface.maskToCidr(mask);
        const route: RouteEntry = { destination, mask, cidr, nextHopInterface, isDefault: destination === "0.0.0.0" && mask === "0.0.0.0" };

        this.routingTable.push(route);
        this.routingTable.sort((a, b) => b.cidr - a.cidr);
    }

    /**
     * Set default route (0.0.0.0/0) to a specific interface
     * @param gatewayInterface - Interface for default route
     */
    setDefaultRoute(gatewayInterface: NetworkInterface): void {
        this.addRoute("0.0.0.0", "0.0.0.0", gatewayInterface);
    }

    /**
     * Look up the next hop interface for a destination IP using routing table
     * @param dstIp - Destination IP
     * @returns NetworkInterface for next hop or null if no route found
     */
    lookupRoute(dstIp: string): NetworkInterface | null {
        for (const route of this.routingTable) {
            if (this.ipMatchesRoute(dstIp, route.destination, route.mask)) return route.nextHopInterface;
        }
        return null;
    }

    /**
     * Check if IP belongs to a network prefix using subnet mask
     * @param ip - IP address to check
     * @param network - Network prefix
     * @param mask - Subnet mask
     * @returns True if IP is in network, false otherwise
     */
    private ipMatchesRoute(ip: string, network: string, mask: string): boolean {
        const ipParts = ip.split(".").map(Number);
        const netParts = network.split(".").map(Number);
        const maskParts = mask.split(".").map(Number);

        for (let i = 0; i < 4; i++) {
            if ((ipParts[i]! & maskParts[i]!) !== (netParts[i]! & maskParts[i]!)) return false;
        }
        return true;
    }

    /**
     * Determine the outgoing interface for a given destination IP
     * Checks direct subnet first, then routing table
     * @param dstIp - Destination IP
     * @returns NetworkInterface to forward to, or null if no route
     */
    private findOutgoingInterface(dstIp: string): NetworkInterface | null {
        const direct = this.interfaces.find(intf => intf.isInSubnet(dstIp));
        return direct || this.lookupRoute(dstIp);
    }


    // Firewall Methods

    /**
     * Add a firewall rule
     * @param srcIp - Source IP to match, or "any"
     * @param dstIp - Destination IP to match, or "any"
     * @param protocol - Protocol to match (ICMP/TCP/UDP) or null
     * @param action - ALLOW or DROP
     * @param priority - Priority (lower = higher)
     */
    addRule(srcIp: string, dstIp: string, protocol: Protocol | null, action: FirewallAction, priority = 100): void {
        if (!NetworkInterface.isValidIP(srcIp) && srcIp !== "any") throw new Error(`Invalid source IP: ${srcIp}`);
        if (!NetworkInterface.isValidIP(dstIp) && dstIp !== "any") throw new Error(`Invalid destination IP: ${dstIp}`);

        const rule: FirewallRule = { id: crypto.randomUUID(), srcIp, dstIp, protocol, action, priority };
        this._rules.push(rule);
        this._rules.sort((a, b) => a.priority - b.priority);
    }

    /**
     * Get all firewall rules
     * @returns Copy of the firewall rules array
     */
    getRules(): FirewallRule[] { return [...this._rules]; }

    /**
     * Set default firewall policy
     * @param policy - ALLOW or DROP
     */
    setDefaultPolicy(policy: FirewallAction): void { this._defaultPolicy = policy; }

    /**
     * Evaluate a packet against firewall rules
     * @param packet - Packet to check
     * @returns True if allowed, false if dropped
     */
    private evaluateFirewall(packet: Packet): boolean {
        for (const rule of this._rules) {
            const srcMatch: boolean = rule.srcIp === "any" || rule.srcIp === packet.srcIp;
            const dstMatch: boolean = rule.dstIp === "any" || rule.dstIp === packet.dstIp;
            const protocolMatch = rule.protocol === null || rule.protocol === packet.protocol;

            if (srcMatch && dstMatch && protocolMatch) {
                if (rule.action === FirewallAction.DROP) {
                    console.log(`Router ${this.name}: Firewall DROPPED packet from ${packet.srcIp} => ${packet.dstIp}`);
                    return false;
                }
                else {
                    console.log(`Router ${this.name}: Firewall ALLOWED packet from ${packet.srcIp} => ${packet.dstIp}`);
                }
                return true;
            }
        }
        const allow: boolean = this._defaultPolicy === FirewallAction.ALLOW;
        if(allow)
            console.log(`Router ${this.name}: Firewall (DEFUALT RULE) ALLOWED packet from ${packet.srcIp} => ${packet.dstIp}`);
        else
            console.log(`Router ${this.name}: Firewall (DEFUALT RULE) DROPPED packet from ${packet.srcIp} => ${packet.dstIp}`);
        return allow;
    }

    
    // Packet Forwarding

    /**
     * Forward a packet through the router
     * Steps: decrement TTL, update ARP, log hop, check firewall, find outgoing interface, ARP resolution
     * @param packet - Packet to forward
     * @param incomingInterface - Interface packet arrived from (optional)
     * @returns Array of NetworkInterface(s) to forward packet to; empty if dropped
     */
    override forwardPacket(packet: Packet, incomingInterface?: NetworkInterface): NetworkInterface[] {
        packet.decrementTTL();
        if (packet.isExpired()) {
            console.log(`Router ${this.name}: Packet ${packet.id} expired`);
            return [];
        }

        if (incomingInterface && packet.srcMAC && packet.srcMAC !== "FF:FF:FF:FF:FF:FF") {
            this.addARPEntry(packet.srcIp, packet.srcMAC);
        }

        packet.logHop(this);

        if (!this.evaluateFirewall(packet)) return [];

        const outInterface = this.findOutgoingInterface(packet.dstIp);
        if (!outInterface) {
            console.log(`Router ${this.name}: No route to ${packet.dstIp}, dropping packet ${packet.id}`);
            return [];
        }

        packet.srcMAC = outInterface.mac;
        
        // Determine next hop IP
        // If destination is in the same subnet as outInterface, next hop is the destination itself
        // if not, we"d need to look up next-hop router (but for directly connected networks, it"s the destination)
        const nextHopIp = packet.dstIp;
        const nextHopMAC = this.lookupARP(nextHopIp);

        if (nextHopMAC) {
            packet.dstMAC = nextHopMAC;
            console.log(`Router ${this.name}: Forwarding to ${packet.dstIp} via ${outInterface.ip} (MAC: ${nextHopMAC.slice(0, 8)}...)`);
            return [outInterface];
        } else {
            // when ARP is needed but cache is pre-populated (test mode), it should still forward the packet
            console.log(`Router ${this.name}: ARP miss for ${nextHopIp}`);
            
            packet.dstMAC = "FF:FF:FF:FF:FF:FF";
            
            return [outInterface]; // the Topology layer will handle ARP queueing
        }
    }
}
