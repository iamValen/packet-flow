import { Node, NodeType } from "./Node.js";
import { NetworkInterface } from "./NetworkInterface.js";
import { Packet } from "./Packet.js";
import type { Protocol } from "./Packet.js";


const Action = {
    ALLOW: "ALLOW",
    DROP: "DROP",

} as const

type Action = (typeof Action) [keyof typeof Action]   



type FirewallRule = {
    id: string;
    srcIp?: string;
    dstIp?: string;
    protocol?: Protocol;
    action: Action;
    priority: number;
}

export class Firewall extends Node {
    readonly type: NodeType = NodeType.FIREWALL;
    interfaces: NetworkInterface[];
    private rules: FirewallRule[];
    private defaultPolicy: Action;

    constructor(name: string, position: { x: number; y: number }, interfaces: NetworkInterface[] = []) {
        super(name, position);
        this.interfaces = interfaces;
        this.rules = [];
        this.defaultPolicy = Action.ALLOW;
        
        for (const iface of this.interfaces) {
        iface.setParentNode(this);
        }
    }

    canForwardPacket(): boolean {
        return true;
    }

    getInterfaces(): NetworkInterface[] {
        return this.interfaces;
    }

    addRule(srcIp: string, dstIp: string, protocol: Protocol, action: Action, priority: number = 100): void {
        const rule: FirewallRule = {
            id: crypto.randomUUID(),
            srcIp,
            dstIp,
            protocol,
            action,
            priority
        };
        this.rules.push(rule);
        this.rules.sort((a, b) => a.priority - b.priority);
    }

    setDefaultPolicy(policy: Action): void {
        this.defaultPolicy = policy;
    }

    getRules(): Readonly<FirewallRule[]> {
        return this.rules;
    }

    forwardPacket(packet: Packet, incomingInterface?: NetworkInterface): NetworkInterface[] {
        packet.decrementTTL();
        if (packet.isExpired()) return [];

        packet.logHop(this);

        for (const rule of this.rules) {
            const srcMatch = !rule.srcIp || rule.srcIp === packet.srcIp;
            const dstMatch = !rule.dstIp || rule.dstIp === packet.dstIp;
            const protocolMatch = !rule.protocol || rule.protocol === packet.protocol;

            if (srcMatch && dstMatch && protocolMatch) {
                if (rule.action === Action.DROP) {
                    console.log(`Firewall ${this.name}: Blocked packet ${packet.id} (rule ${rule.id})`);
                    return [];
                }
                break;
            }
        }

        if (this.rules.length === 0 && this.defaultPolicy === Action.DROP) {
            console.log(`Firewall ${this.name}: Blocked packet ${packet.id} (default policy)`);
            return [];
        }

        const outInterfaces = this.interfaces.filter(iface => iface.id !== incomingInterface?.id);
        return outInterfaces;
    }
}