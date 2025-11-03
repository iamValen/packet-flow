import { Node } from "./Node.js"

export type Protocol = 'ICMP' | 'TCP' | 'UDP';

/**
 * Simulates a network Packet
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

    constructor(srcIp: string, dstIp: string, protocol: Protocol = 'ICMP', payload?: string, srcMAC?: string) {
        this.id = crypto.randomUUID();
        this.srcIp = srcIp;
        this.dstIp = dstIp;
        this.srcMAC = srcMAC || 'FF:FF:FF:FF:FF:FF';
        this.protocol = protocol;
        if(payload != undefined) this.payload = payload;
        this.ttl = 64;
        this.timestamp = Date.now();
    }

    decrementTTL(): void {
        this.ttl--;
    }

    isExpired(): boolean {
        return this.ttl <= 0;
    }

    /**
     * Push node to the history to visualize each hop through each node
     * @param nodeID current node where the packet is
     */
    logHop(node: Node): void {
        this.history.push(node);
    }
    
    setDestinationMAC(mac: string): void {
        this.dstMAC = mac;
    }
}