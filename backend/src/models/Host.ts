import { Node, NodeType } from './Node.js';
import { NetworkInterface } from './NetworkInterface.js';
import { Packet } from './Packet.js';
import { Protocol } from './Packet.js';

/**
 * Represents a host node in the network
 * Hosts are end devices that can send and receive packets but can't forward them like routers or switches
 * Each host can have one or more network interfaces
 */
export class Host extends Node {
    readonly type: NodeType = NodeType.HOST;
    defaultGateway?: string;

    /**
     * Creates a host object, using Node's super
     * @param id Unique identifier for this host
     * @param name Human-readable name of the host
     * @param position x/y coordinates for UI canvas placement
     * @param interfaces Optional array of NetworkInterface objects assigned to this host
     */
    constructor(name: string, position: { x: number; y: number }, interfaces: NetworkInterface[] = []) {
        super(name, position, interfaces);
        this.interfaces = interfaces;
    }

    /**
     * Set the default gateway of the Network where is the Host located
     * @param gatewayIp
     */
    setDefaultGateway(gatewayIp: string): void {
        this.defaultGateway = gatewayIp;
    }

    /**
     * Select which interface to use for sending to a destination IP
     * Selects the interface that is in the same subnet as the destination IP
     * @param dstIp
     * @returns the appropriate interface
     */
    private selectInterface(dstIp: string): NetworkInterface | null {
        // Check if destination is in any directly connected network
        for (const iface of this.interfaces) {
            if (iface.isInSubnet(dstIp)) 
                return iface;
        }
        // Use default gateway if configured
        if (this.defaultGateway) {
            for (const iface of this.interfaces) {
                if (iface.isInSubnet(this.defaultGateway)) 
                    return iface;
            }
        }
        
        return null; // No route available
    }
    
    /**
     * Hosts cannot forward packets to other nodes
     * @returns false
     */
    override canForwardPacket(): boolean { return false; }
    override getInterfaces(): NetworkInterface[] { return this.interfaces; }

    /**
     * Hosts do not implement packet forwarding
     * Calling this method will throw an error to prevent misuse
     * @param packet Any packet object
     * @throws Error indicating hosts cannot forward packets
     */
    override forwardPacket(packet: Packet): NetworkInterface[] {
        throw new Error("Hosts cannot forward packets");
    }


    /**
     * Send a packet from this host to a destination IP
     * Now returns the packet and source interface for simulation engine
     * @param dstIp destination IP
     * @param protocol 
     * @param payload optional data sent in the packet
     * @returns the created packet and the Source Interface (where the packet was "created")
     */
    sendPacket(dstIp: string, protocol: Protocol, payload?: string): { packet: Packet; sourceInterface: NetworkInterface } {
        // Select appropriate interface
        const sourceInterface = this.selectInterface(dstIp);
        if (!sourceInterface)
            throw new Error(`No interface available to reach ${dstIp}`);

        const packet = new Packet(
            sourceInterface.ip,
            dstIp,
            protocol,
            payload,
            sourceInterface.mac
        );

        packet.logHop(this);

        return { packet, sourceInterface };
    }

    /**
     * Receive a packet at this host
     * Logs the hop in the packet object and can be used to display the packet arrival in the frontend
     * @param packet The packet received by this host
     */
    receivePacket(packet: Packet): Packet | null {
        packet.logHop(this);
        console.log(`Host ${this.name} received packet from ${packet.srcIp}: ${packet.payload || 'ICMP Echo'}`);
        
        if (packet.protocol === Protocol.ICMP && packet.payload === 'ICMP Echo Request') {
            // Create ICMP reply
            const sourceInterface = this.interfaces.find(i => i.ip === packet.dstIp);
            if (sourceInterface) {
                const reply = new Packet(
                    sourceInterface.ip,
                    packet.srcIp,
                    Protocol.ICMP,
                    'ICMP Echo Reply',
                    sourceInterface.mac
                );
                return reply; // Topology should inject this
            }
        }

        return null;
    }
}