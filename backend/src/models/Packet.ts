import { Node } from "./Node.js"

export const Protocol = {
    ICMP: "ICMP",
    UDP: "UDP",
    TCP: "TCP",
} as const
// use that enum as a type
export type Protocol = (typeof Protocol) [keyof typeof Protocol] 

/**
 * Represents a Network Packet - the basic data unit traveling between nodes
 * It carries addressing (IP/MAC), protocol, and optional payload data
 */
export class Packet {
    readonly id: string;
    readonly srcIp: string;
    readonly dstIp: string;
    readonly srcMAC: string;
    dstMAC?: string;
    protocol: Protocol;
    payload?: string;
    ttl: number;
    history: Node[] = [];
    readonly timestamp: number;
    
    /**
     * Create a Network Packet
     * @param srcIp - Source IP address (IPv4) of the sender
     * @param dstIp - Destination IP address (IPv4)
     * @param protocol - Transport/network protocol: ICMP, TCP, UDP
     * @param payload - Optional packet data (e.g., "ICMP Echo Request")
     * @param srcMAC - Optional source MAC address (for Layer 2 simulation)
     */
    constructor(srcIp: string, dstIp: string, protocol: Protocol = Protocol.ICMP, payload?: string, srcMAC?: string) {
        this.id = crypto.randomUUID();
        this.srcIp = srcIp;
        this.dstIp = dstIp;
        this.srcMAC = srcMAC || 'FF:FF:FF:FF:FF:FF';
        this.protocol = protocol;
        if(payload != undefined) this.payload = payload;
        this.ttl = 64;
        this.timestamp = Date.now();
    }

    /**
     * Create a deep clone of this packet for broadcast/multicast scenarios
     * Each clone gets a new ID but maintains the same payload and addressing
     * @returns A new Packet instance with copied properties
     */
    clone(): Packet {
        const clonedPacket = new Packet(
            this.srcIp,
            this.dstIp,
            this.protocol,
            this.payload,
            this.srcMAC
        );
        
        if (this.dstMAC) clonedPacket.dstMAC = this.dstMAC;
        clonedPacket.ttl = this.ttl;
        
        // copy history (clone array to avoid shared reference)
        clonedPacket.history = [...this.history];
        
        return clonedPacket;
    }

    /**
     * Decrease the packet’s Time To Live by one - called on every hop
     * If TTL reaches 0, the packet is considered expired and must be dropped
     */
    decrementTTL(): void {
        this.ttl--;
    }

    /**
     * Check if the packet’s TTL has reached zero or below
     * @returns true if the packet should be discarded due to TTL expiration
     */
    isExpired(): boolean {
        return this.ttl <= 0;
    }

    /**
     * Append the node to the history to visualize each hop through each node
     * @param nodeID current node where the packet is
     */
    logHop(node: Node): void {
        this.history.push(node);
    }

    /**
     * Set or update the destination MAC address for this packet
     * Useful for switches or ARP-like mechanisms when resolving Layer 2 destinations
     * @param mac Destination MAC address
     */
    setDestinationMAC(mac: string): void {
        this.dstMAC = mac;
    }
}