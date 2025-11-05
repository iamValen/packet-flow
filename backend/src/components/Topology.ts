import { Node } from './Node.js';
import { Link } from './Link.js';
import { NetworkInterface } from './NetworkInterface.js';
import { Packet, Protocol } from './Packet.js';
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
    private packetsInFlight: PacketInFlight[];
    private simulationRunning: boolean;
    private simulationInterval?: number;

    constructor(name: string) {
        this.id = crypto.randomUUID();
        this.name = name;
        this.nodes = [];
        this.links = [];
        this.packetsInFlight = [];
        this.simulationRunning = false;
    }

    /** Add a node to the topology */
    addNode(node: Node): void {
        if (!this.nodes.includes(node))
            this.nodes.push(node);
    }

    /** Remove a node and all its links */
    removeNode(node: Node): void {
        this.nodes = this.nodes.filter(n => n.id !== node.id);
        const nodeInterfaces = node.getInterfaces();
        this.links = this.links.filter(link =>
            !nodeInterfaces.some(intf => link.involvesInterface(intf))
        );
    }

    /** Add a link between two interfaces */
    addLink(intfA: NetworkInterface, intfB: NetworkInterface): Link {
        if (intfA === intfB)
            throw new Error(`Cannot create link: both ends are the same interface`);

        if (intfA.parentNode && intfB.parentNode && intfA.parentNode === intfB.parentNode)
            throw new Error(`Cannot create link: both interfaces belong to the same node (${intfA.parentNode.name})`);
        
        const exists = this.links.find(link =>
            link.involvesInterface(intfA) || link.involvesInterface(intfB)
        );
        if (exists)
            throw new Error(`Cannot create link: one or both interfaces are already linked`);

        const link = new Link(intfA, intfB);
        this.links.push(link);
        return link;
    }


    removeLink(link: Link): void {
        this.links = this.links.filter(l => l.id !== link.id);
    }

    getLinksForNode(node: Node): Link[] {
        const nodeIntfs = node.getInterfaces();
        return this.links.filter(link =>
            nodeIntfs.some(intf => link.involvesInterface(intf))
        );
    }

    // Packet Simulation

    sendPacket(sourceHost: Host, dstIp: string, protocol: Protocol, payload?: string): Packet {
        const { packet, sourceInterface } = sourceHost.sendPacket(dstIp, protocol, payload);

        this.packetsInFlight.push({
            packet,
            currentNode: sourceHost,
            currentInterface: sourceInterface
        });

        console.log(`+++ Packet ${packet.id} injected from ${sourceHost.name} (${sourceInterface.ip}) to ${dstIp}`);
        return packet;
    }

    private isDestination(packet: Packet, node: Node): boolean {
        const interfaces = node.getInterfaces();
        return interfaces.some(iface => iface.ip === packet.dstIp);
    }
}
