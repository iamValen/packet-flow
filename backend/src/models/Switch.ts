import { Node, NodeType } from './Node.js';
import { NetworkInterface } from './NetworkInterface.js';
import { Packet } from './Packet.js';

/**
 * Internal structure that represents an entry in the MAC address table
 */
interface MACTableEntry {
    mac: string;              // The MAC address learned
    interfaceId: string;      // The interface ID where the MAC was learned
    timestamp: number;        // Timestamp of when it was learned (for aging)
}

/**
 * Class that represents a Layer 2 Switch node
 * 
 * Performs MAC learning and intelligent forwarding. 
 * - Learns source MAC addresses dynamically
 * - Floods packets when the destination MAC is unknown
 * - Expires MAC entries after a configurable timeout
 */
export class Switch extends Node {
    readonly type: NodeType = NodeType.SWITCH;

    private macTable: Map<string, MACTableEntry>;
    private readonly MAC_TABLE_TIMEOUT = 300000; // 5 minutes timeout

    /**
     * Creates a Switch Node object
     * @param name - Name of the Switch
     * @param position - x,y position of the switch
     * @param interfaces - Network interfaces attached to the switch
     */
    constructor(name: string, position: { x: number; y: number }, interfaces: NetworkInterface[] = []) {
        super(name, position, interfaces);
        this.macTable = new Map();
    }

    override canForwardPacket(): boolean { return true; }
    override getInterfaces(): NetworkInterface[] { return this.interfaces; }

    /**
     * Forward a packet based on MAC learning and switching logic
     * - learns the source MAC address and associates it with the incoming port
     * - if the destination MAC is known then forward out that specific port
     * - if unknown then flood to all other interfaces
     * 
     * @param packet - Packet being forwarded
     * @param incomingInterface - Interface where the packet arrived
     * @returns Array of interfaces the packet should be sent out of
     */
    override forwardPacket(packet: Packet, incomingInterface?: NetworkInterface): NetworkInterface[] {
        packet.decrementTTL();
        if (packet.isExpired()) return [];

        packet.logHop(this);

        // Learn the source MAC address
        if (incomingInterface && packet.srcMAC) {
            this.learnMAC(packet.srcMAC, incomingInterface);
        }

        if (packet.dstMAC) {
            const targetInterface = this.lookupMAC(packet.dstMAC);
            if (targetInterface && targetInterface.id !== incomingInterface?.id) {
                // known unicast so send directly to target
                return [targetInterface];
            }
        }

        // if not flood the packet to all interfaces except the incoming one 
        const outInterfaces = this.interfaces.filter(
            iface => iface.id !== incomingInterface?.id
        );

        return outInterfaces;
    }


    // MAC Table logic

    /**
     * Learn a source MAC address and associate it with an incoming interface
     * @param srcMAC - The source MAC address of the packet
     * @param incomingInterface - The interface where the packet was received
     */
    private learnMAC(srcMAC: string, incomingInterface: NetworkInterface): void {
        this.macTable.set(srcMAC, {
            mac: srcMAC,
            interfaceId: incomingInterface.id,
            timestamp: Date.now()
        });
    }

    /**
     * Lookup which interface a MAC address is connected to
     * @param dstMAC - The destination MAC address to look up
     * @returns The interface if found and valid, otherwise null
     */
    private lookupMAC(dstMAC: string): NetworkInterface | null {
        const entry = this.macTable.get(dstMAC);
        if (!entry) return null;

        // check expiration
        if (Date.now() - entry.timestamp > this.MAC_TABLE_TIMEOUT) {
            this.macTable.delete(dstMAC);
            return null;
        }

        return this.interfaces.find(iface => iface.id === entry.interfaceId) || null;
    }
}
