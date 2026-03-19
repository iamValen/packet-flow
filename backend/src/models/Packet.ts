import { NetworkInterface } from "./NetworkInterface.js";
import type { Node } from "./Node.js";

export const Protocol = {
    ICMP: "ICMP",
    UDP: "UDP",
    ARP: "ARP"
} as const;

export type Protocol = (typeof Protocol)[keyof typeof Protocol];

export const ARPType = {
    REQUEST: "REQUEST",
    REPLY: "REPLY"
} as const;

export type ARPType = (typeof ARPType)[keyof typeof ARPType];

export interface ARPData {
    type: ARPType;
    senderIP: string;
    senderMAC: string;
    targetIP: string;
    targetMAC?: string;
}

/**
 * A packet travelling through the network.
 * Tracks its full hop history for visualization.
 */
export class Packet {
    readonly id: string;
    readonly srcIp: string;
    readonly dstIp: string;
    srcMAC: string;
    dstMAC?: string;
    protocol: Protocol;
    payload?: string;
    ttl: number;
    /** Ordered list of nodes this packet has visited. */
    history: Node[] = [];
    readonly created: number;

    constructor(
        srcIp: string,
        dstIp: string,
        protocol: Protocol = Protocol.ICMP,
        payload?: string,
        srcMAC?: string,
        dstMAC?: string
    ) {
        if (!NetworkInterface.isValidIP(srcIp)) throw new Error(`bad src ip: ${srcIp}`);
        if (!NetworkInterface.isValidIP(dstIp)) throw new Error(`bad dst ip: ${dstIp}`);

        this.id = crypto.randomUUID();
        this.srcIp = srcIp;
        this.dstIp = dstIp;
        this.srcMAC = srcMAC || "FF:FF:FF:FF:FF:FF";
        if (dstMAC) this.dstMAC = dstMAC;
        this.protocol = protocol;
        if (payload) this.payload = payload;
        this.ttl = 64;
        this.created = Date.now();
    }

    /** Creates a deep copy of this packet (used for broadcast scenarios). */
    clone(): Packet {
        const copy = new Packet(
            this.srcIp,
            this.dstIp,
            this.protocol,
            this.payload,
            this.srcMAC,
            this.dstMAC
        );
        copy.ttl = this.ttl;
        copy.history = [...this.history];
        return copy;
    }

    /** Decrements the TTL by one. */
    decrementTTL(): void {
        this.ttl--;
    }

    /** Returns true if the TTL has reached zero. */
    isExpired(): boolean {
        return this.ttl <= 0;
    }

    /** Records a node in the packet's hop history. */
    addHop(node: Node): void {
        this.history.push(node);
    }

    setDstMAC(mac: string): void {
        this.dstMAC = mac;
    }
}