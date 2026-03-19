import type { Protocol } from "./Packet.js";

export const FirewallAction = {
    ALLOW: "ALLOW",
    DROP: "DROP"
} as const;
export type FirewallAction = (typeof FirewallAction)[keyof typeof FirewallAction];

/** A single firewall rule entry. */
export type FirewallRule = {
    id: string;
    /** "any" or a specific IP/CIDR */
    srcIp: string;
    /** "any" or a specific IP/CIDR */
    dstIp: string;
    protocol?: Protocol;
    action: FirewallAction;
    /** Lower number = higher priority (checked first). */
    priority: number;
};

/**
 * Stateless packet-filter firewall.
 * Rules are checked in priority order (lowest priority number wins).
 * Falls back to `defaultAction` if no rule matches.
 */
export class Firewall {
    private rules: FirewallRule[] = [];
    /** Action used when no rule matches. Defaults to ALLOW. */
    private defaultAction: FirewallAction = FirewallAction.ALLOW;

    /**
     * Adds a rule and re-sorts the list by priority.
     * @returns the created rule with its generated id
     */
    addRule(rule: Omit<FirewallRule, "id">): FirewallRule {
        const newRule: FirewallRule = { ...rule, id: crypto.randomUUID() };
        this.rules.push(newRule);
        this.rules.sort((a, b) => a.priority - b.priority);
        return newRule;
    }

    /**
     * Removes a rule by id.
     * @returns true if the rule was found and removed
     */
    removeRule(id: string): boolean {
        const idx = this.rules.findIndex(r => r.id === id);
        if (idx === -1) return false;
        this.rules.splice(idx, 1);
        return true;
    }

    /** Returns a shallow copy of all rules in priority order. */
    getRules(): FirewallRule[] {
        return [...this.rules];
    }

    /** Removes all rules. */
    clearRules(): void {
        this.rules = [];
    }

    /** Sets the action used when no rule matches. */
    setDefaultAction(action: FirewallAction): void {
        this.defaultAction = action;
    }

    /**
     * Checks whether a packet should be allowed or dropped.
     * Rules are evaluated in priority order; the first match wins.
     * @returns ALLOW or DROP
     */
    check(srcIp: string, dstIp: string, protocol?: Protocol): FirewallAction {
        for (const rule of this.rules) {
            if (this.matches(rule, srcIp, dstIp, protocol))
                return rule.action;
        }
        return this.defaultAction;
    }

    /** Returns true if the rule matches the given packet parameters. */
    private matches(rule: FirewallRule, srcIp: string, dstIp: string, protocol?: Protocol): boolean {
        if (rule.srcIp !== "any" && !this.ipMatches(srcIp, rule.srcIp)) return false;
        if (rule.dstIp !== "any" && !this.ipMatches(dstIp, rule.dstIp)) return false;
        if (rule.protocol && protocol && rule.protocol !== protocol) return false;
        return true;
    }

    /** Checks if an IP matches a format string (exact match or CIDR). */
    private ipMatches(ip: string, format: string): boolean {
        if (ip === format) return true;

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

    /** Converts a dotted-decimal IP string to a 32-bit unsigned integer. */
    private ipToNum(ip: string): number {
        const parts = ip.split(".").map(Number);
        return ((parts[0]! << 24) | (parts[1]! << 16) | (parts[2]! << 8) | parts[3]!) >>> 0;
    }
}