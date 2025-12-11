import { Node, NodeType } from "./Node.js";
import { NetworkInterface } from "./NetworkInterface.js";
import { Packet } from "./Packet.js";

// mac table entry
type MACEntry = {
    mac: string;
    ifaceId: string;
    timestamp: number;
};

/**
 * layer 2 switch - learns MACs and forwards based on that
 * floods unknown destinations to all ports
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

    // learn a mac on a port
    learnMAC(mac: string, iface: NetworkInterface): void {
        if (!NetworkInterface.isValidMAC(mac)) throw new Error(`bad mac: ${mac}`);
        if (mac === "FF:FF:FF:FF:FF:FF") return;  // dont learn broadcast
        if (this.macTable.has(mac)) return;

        this.macTable.set(mac, {
            mac,
            ifaceId: iface.id,
            timestamp: Date.now()
        });
    }

    // lookup which port has this mac
    private lookupMAC(mac: string): NetworkInterface | null {
        const entry = this.macTable.get(mac);
        if (!entry) return null;
        if (Date.now() - entry.timestamp > this.MAC_TIMEOUT) {
            this.macTable.delete(mac);
            return null;
        }
        return this.interfaces.find(i => i.id === entry.ifaceId) || null;
    }

    private cleanMAC(): void {
        const now = Date.now();
        for (const [mac, entry] of this.macTable) {
            if (now - entry.timestamp > this.MAC_TIMEOUT) {
                this.macTable.delete(mac);
            }
        }
    }
    
    override forward(packet: Packet, incomingIface?: NetworkInterface): NetworkInterface[] {
        this.cleanMAC();

        packet.decrementTTL();
        if (packet.isExpired()) return [];

        packet.addHop(this);

        // learn source mac
        if (incomingIface && packet.srcMAC) {
            this.learnMAC(packet.srcMAC, incomingIface);
        }

        // known destination?
        if (packet.dstMAC) {
            const targetIface = this.lookupMAC(packet.dstMAC);
            if (targetIface && targetIface.id !== incomingIface?.id) {
                return [targetIface];
            }
        }

        // flood to all ports except incoming
        return this.interfaces.filter(i => i.id !== incomingIface?.id);
    }
}