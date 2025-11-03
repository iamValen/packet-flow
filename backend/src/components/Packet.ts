export type Protocol = 'ICMP' | 'TCP' | 'UDP';

/**
 * Simulates a network Packet
 */
export class Packet {
    readonly id: string;
    readonly srcIp: string;
    readonly dstIp: string;
    protocol: Protocol;
    payload?: string;
    ttl: number;
    history: string[] = [];

    constructor(srcIp: string, dstIp: string, protocol: Protocol = 'ICMP', payload?: string) {
        this.id = crypto.randomUUID();
        this.srcIp = srcIp;
        this.dstIp = dstIp;
        this.protocol = protocol;
        if(payload != undefined) 
            this.payload = payload;
        this.ttl = 64;
    }

    decrementTTL() {
        this.ttl--;
    }

    isExpired(): boolean {
        return this.ttl <= 0;
    }

    logHop(nodeId: string) {
        this.history.push(nodeId);
    }
}
