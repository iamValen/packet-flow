import { Node, NodeType } from "./Node.js";
import { NetworkInterface } from "./NetworkInterface.js";
import { Packet } from "./Packet.js";

/** A MAC table entry with expiry tracking. */
type MACEntry = {
    mac: string;
    ifaceId: string;
    timestamp: number;
};

/**
 * Layer-2 switch. Learns source MACs on arrival and forwards to the
 * known destination port. Floods to all ports when the destination is unknown.
 */
export class Switch extends Node {
    readonly type: NodeType = NodeType.SWITCH;
    private macTable: Map<string, MACEntry> = new Map();
    private readonly MAC_TIMEOUT = 300000;  // 5 min

    constructor(name: string, position: { x: number; y: number }, interfaces: NetworkInterface[] = []) {
        super(name, position, interfaces);
    }

    override canForward(): boolean { return true; }
    override getInterfaces(): NetworkInterface[] { return this.interfaces; }

    /**
     * Records a MAC address → interface mapping.
     * Ignores broadcast MACs and entries that are already known.
     * @throws if the MAC address format is invalid
     */
    learnMAC(mac: string, iface: NetworkInterface): void {
        if (!NetworkInterface.isValidMAC(mac)) throw new Error(`bad mac: ${mac}`);
        if (mac === "FF:FF:FF:FF:FF:FF") return;
        if (this.macTable.has(mac)) return;

        this.macTable.set(mac, { mac, ifaceId: iface.id, timestamp: Date.now() });
    }

    /**
     * Looks up the interface associated with a MAC address.
     * @returns the matching interface, or null if unknown or expired
     */
    private lookupMAC(mac: string): NetworkInterface | null {
        const entry = this.macTable.get(mac);
        if (!entry) return null;
        if (Date.now() - entry.timestamp > this.MAC_TIMEOUT) {
            this.macTable.delete(mac);
            return null;
        }
        return this.interfaces.find(i => i.id === entry.ifaceId) || null;
    }

    /** Removes expired entries from the MAC table. */
    private cleanMAC(): void {
        const now = Date.now();
        for (const [mac, entry] of this.macTable) {
            if (now - entry.timestamp > this.MAC_TIMEOUT)
                this.macTable.delete(mac);
        }
    }

    /**
     * Forwards a packet out the appropriate port.
     * Learns the source MAC, then either unicasts to the known destination port
     * or floods to all ports except the incoming one.
     */
    override forward(packet: Packet, incomingIface?: NetworkInterface): NetworkInterface[] {
        this.cleanMAC();

        packet.decrementTTL();
        if (packet.isExpired()) return [];

        packet.addHop(this);

        if (incomingIface && packet.srcMAC)
            this.learnMAC(packet.srcMAC, incomingIface);

        if (packet.dstMAC) {
            const targetIface = this.lookupMAC(packet.dstMAC);
            if (targetIface && targetIface.id !== incomingIface?.id)
                return [targetIface];
        }

        // destination unknown — flood to all ports except the incoming one
        return this.interfaces.filter(i => i.id !== incomingIface?.id);
    }
}