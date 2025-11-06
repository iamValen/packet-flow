import { Node, NodeType } from "./Node.js";
import { NetworkInterface } from "./NetworkInterface.js";
import { Packet } from "./Packet.js";
import type { Protocol } from "./Packet.js";

/**
 * Enum to represent Firewall Rule action
 * Cleanest way to create enums
 */
const Action = {
    ALLOW: "ALLOW",
    DROP: "DROP",

} as const
// use that enum as a type
type Action = (typeof Action) [keyof typeof Action]   

/**
 * Specified type/format of Firewall Rule
 */
type FirewallRule = {
    id: string;
    srcIp?: string;
    dstIp?: string;
    protocol?: Protocol;
    action: Action;
    priority: number;
}

/**
 * Class that represents a Firewall
 */
export class Firewall extends Node {
    readonly type: NodeType = NodeType.FIREWALL;
    private _rules: FirewallRule[];
    private _defaultPolicy: Action;

    /**
     * Creates a Firewall Node object
     * @param name - Name of the Firewall
     * @param position - x,y position
     * @param interfaces - Network Interfaces that belong to this firewall 
     */
    constructor(name: string, position: { x: number; y: number }, interfaces: NetworkInterface[] = []) {
        super(name, position, interfaces);
        this._rules = [];
        this._defaultPolicy = Action.ALLOW;
    }

    override canForwardPacket(): boolean { return true; }
    override getInterfaces(): NetworkInterface[] { return this.interfaces; }


    /**
     * Adds a Firewall Rule to the current Firewall wit the {@link FirewallRule} structure
     * @param srcIp - Source IPv4 Address
     * @param dstIp - Destination IPv4 Address
     * @param protocol - Specified protocol of this {@link FirewallRule} with the options in {@link Protocol}
     * @param action - Specified Action of this {@link FirewallRule} with the options in {@link Action}
     * @param priority - Priority defined number, lower number = higher priority
     */
    addRule(srcIp: string, dstIp: string, protocol: Protocol, action: Action, priority: number = 100): void {
        if (srcIp && !NetworkInterface.isValidIP(srcIp)) {
            throw new Error(`Invalid source IP: ${srcIp}`);
        }
        if (dstIp && !NetworkInterface.isValidIP(dstIp)) {
            throw new Error(`Invalid destination IP: ${dstIp}`);
        }

        const rule: FirewallRule = {
            id: crypto.randomUUID(),
            srcIp,
            dstIp,
            protocol,
            action,
            priority
        };

        this._rules.push(rule);
        this._rules.sort((a, b) => a.priority - b.priority);
    }

    /**
     * Removes a Firewall Rule given the ruleId string
     * @param ruleId - ID of the Firewall Rule
     * @returns true if removed, false if not found
     */
    removeRule(ruleId: string): boolean {
        const originalLength = this._rules.length;
        this._rules = this._rules.filter(r => r.id !== ruleId);
        return this._rules.length < originalLength;
    }

    /**
     * Set default policy of the firewall
     * The firewall will do the {@link Action} to all the requests, unless there's a {@link FirewallRule} that says otherwise  
     * @param policy 
     */
    setDefaultPolicy(policy: Action): void {
        this._defaultPolicy = policy;
    }

    /**
     * Gives all the firewall rules in a immutable way
     * @returns the firewall rules
     */
    getRules(): readonly Readonly<FirewallRule>[] {
        return this._rules.map(r => Object.freeze({ ...r }));
    }

    override forwardPacket(packet: Packet, incomingInterface?: NetworkInterface): NetworkInterface[] {
        packet.decrementTTL();
        if (packet.isExpired()) return [];

        packet.logHop(this);

        for (const rule of this._rules) {
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

        if (this._rules.length === 0 && this._defaultPolicy === Action.DROP) {
            console.log(`Firewall ${this.name}: Blocked packet ${packet.id} (default policy)`);
            return [];
        }

        const outInterfaces = this.interfaces.filter(iface => iface.id !== incomingInterface?.id);
        return outInterfaces;
    }
}