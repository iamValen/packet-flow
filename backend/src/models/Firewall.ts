import type { Protocol } from "./Packet.js";

export const FirewallAction = {
    ALLOW: "ALLOW",
    DROP: "DROP"
} as const;
export type FirewallAction = (typeof FirewallAction)[keyof typeof FirewallAction]

export type FirewallRule = {
    id: string;
    srcIp: string;      // "any" or ip/cidr
    dstIp: string;      // "any" or ip/cidr
    protocol?: Protocol;
    action: FirewallAction;
    priority: number;   // lower = higher priority
}

/**
 * packet filter firewall
 * checks rules in priority order (lowest is highest priority)
 */
export class Firewall {
    private rules: FirewallRule[] = [];
    private defaultAction: FirewallAction = FirewallAction.ALLOW; // if no rules match uses this rule

    addRule(rule: Omit<FirewallRule, "id">): FirewallRule {
        const newRule: FirewallRule = {
            ...rule,
            id: crypto.randomUUID()
        };
        this.rules.push(newRule);
        this.rules.sort((a, b) => a.priority - b.priority);
        return newRule;
    }

    removeRule(id: string): boolean {
        const idx = this.rules.findIndex(r => r.id === id);
        if (idx === -1) return false;
        this.rules.splice(idx, 1);
        return true;
    }

    getRules(): FirewallRule[] {
        return [...this.rules];
    }

    clearRules(): void {
        this.rules = [];
    }

    setDefaultAction(action: FirewallAction): void {
        this.defaultAction = action;
    }

    // check if packet should be allowed
    check(srcIp: string, dstIp: string, protocol?: Protocol): FirewallAction {
        for (const rule of this.rules) {
            if (this.matches(rule, srcIp, dstIp, protocol)) {
                return rule.action;
            }
        }
        return this.defaultAction;
    }

    // check if rule matches given packet info
    private matches(rule: FirewallRule, srcIp: string, dstIp: string, protocol?: Protocol): boolean {
        // check src
        if (rule.srcIp !== "any" && !this.ipMatches(srcIp, rule.srcIp)) {
            return false;
        }
        // check dst
        if (rule.dstIp !== "any" && !this.ipMatches(dstIp, rule.dstIp)) {
            return false;
        }
        // check protocol
        if (rule.protocol && protocol && rule.protocol !== protocol) {
            return false;
        }
        return true;
    }

    // check if ip matches given format
    private ipMatches(ip: string, format: string): boolean {
        // exact match
        if (ip === format) return true;

        // CIDR match (e.g. 192.168.1.0/24)
        if (format.includes("/")) {
            const [network, prefixStr] = format.split("/");
            const prefix = parseInt(prefixStr!, 10);
            if (isNaN(prefix) || prefix < 0 || prefix > 32) return false;

            const ipNum = this.ipToNum(ip);
            const netNum = this.ipToNum(network!);
            const mask = prefix === 0 ? 0 : (~0 << (32 - prefix)) >>> 0;

            return (ipNum & mask) === (netNum & mask);
        }

        return false;
    }

    // convert ip to number
    private ipToNum(ip: string): number {
        const parts = ip.split(".").map(Number);
        return ((parts[0]! << 24) | (parts[1]! << 16) | (parts[2]! << 8) | parts[3]!) >>> 0;
    }
}