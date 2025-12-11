import { NetworkInterface } from "./NetworkInterface.js";
import type { Node } from "./Node.js";

export const Protocol = {
    ICMP: "ICMP",
    UDP: "UDP",
    ARP: "ARP"
    // TCP: "TCP"
} as const;

export type Protocol = (typeof Protocol)[keyof typeof Protocol];

// ARP stuff
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
};

/**
 * a packet that moves through the network
 * keeps track of where its been (history) for visualization
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
    history: Node[] = [];  // nodes this packet visited
    readonly created: number;

    constructor( srcIp: string, dstIp: string, protocol: Protocol = Protocol.ICMP, payload?: string, srcMAC?: string, dstMAC?: string) {
        if (!NetworkInterface.isValidIP(srcIp)) throw new Error(`bad src ip: ${srcIp}`);
        if (!NetworkInterface.isValidIP(dstIp)) throw new Error(`bad dst ip: ${dstIp}`);

        this.id = crypto.randomUUID();
        this.srcIp = srcIp;
        this.dstIp = dstIp;
        this.srcMAC = srcMAC || "FF:FF:FF:FF:FF:FF";
        if(dstMAC) this.dstMAC = dstMAC;
        this.protocol = protocol;
        if(payload) this.payload = payload;
        this.ttl = 64;  // standard ttl
        this.created = Date.now();
    }

    // make a copy for broadcast scenarios
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

    // called at each hop
    decrementTTL(): void {
        this.ttl--;
    }

    isExpired(): boolean {
        return this.ttl <= 0;
    }

    // track where packet has been
    addHop(node: Node): void {
        this.history.push(node);
    }

    setDstMAC(mac: string): void {
        this.dstMAC = mac;
    }
}