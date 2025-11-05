import { Node } from './Node.js';
import { Link } from './Link.js';
import { NetworkInterface } from './NetworkInterface.js';
import { Packet } from './Packet.js';
import { Host } from './Host.js';
import { Router } from './Router.js';
import { Switch } from './Switch.js';
import { Firewall } from './Firewall.js';

interface PacketInFlight {
    packet: Packet;
    currentNode: Node;
    currentInterface?: NetworkInterface;
}

interface NextHopInfo {
    nextNode: Node;
    nextInterface: NetworkInterface;
    viaLink: Link;
}

/**
 * Represents a network topology and simulation engine
 */
export class Topology {
    readonly id: string;
    name: string;
    nodes: Node[];
    links: Link[];
    private packetsInFlight: PacketInFlight[]; // Track active packets
    private simulationRunning: boolean; // Simulation state
    private simulationInterval?: number; // For continuous simulation

    constructor(name: string) {
        this.id = crypto.randomUUID();
        this.name = name;
        this.nodes = [];
        this.links = [];
        this.packetsInFlight = [];
        this.simulationRunning = false;
    }

    /**
     * Add a node to the topology
     * @param node - Node to add
     */
    addNode(node: Node): void {
        if (!this.nodes.includes(node))
            this.nodes.push(node);
    }

    /**
     * Remove a node and all its links
     * @param node - Node to remove
     */
    removeNode(node: Node): void {
        this.nodes = this.nodes.filter(n => n.id !== node.id);
        const nodeInterfaces = node.getInterfaces();
        this.links = this.links.filter(link => 
            !nodeInterfaces.some(intf => link.involvesInterface(intf))
        );
    }

    /**
     * Add a link between two interfaces
     * @param intfA - One end of the Link
     * @param intfB - Other end of the link
     */
    addLink(intfA: NetworkInterface, intfB: NetworkInterface): Link {
        const link = new Link(intfA, intfB);
        this.links.push(link);
        return link;
    }

    /**
     * Remove a link
     * @param link - Link to remove
     */
    removeLink(link: Link): void {
        this.links = this.links.filter(l => l.id !== link.id);
    }

}