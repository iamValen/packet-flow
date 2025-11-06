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

    /** Process one simulation step (move all packets forward by one hop) */
    step(): void {
        if (this.packetsInFlight.length === 0) {
            console.log("No packets in flight");
            return;
        }

        console.log(`\n--- Step (${this.packetsInFlight.length} packet(s) in flight) ---`);

        const newPacketsInFlight: PacketInFlight[] = [];

        for (const packetInFlight of this.packetsInFlight) {
            const nextHops = this.findAllNextHops(packetInFlight);

            if (nextHops.length === 0) continue; // delivered/dropped

            if (nextHops.length === 1) {
                const hop = nextHops[0]!;
                newPacketsInFlight.push({
                    packet: packetInFlight.packet,
                    currentNode: hop.nextNode,
                    currentInterface: hop.nextInterface
                });

                console.log(
                    `Packet ${packetInFlight.packet.id.slice(0, 8)}: ` +
                    `${packetInFlight.currentNode.name} → ${hop.nextNode.name} ` +
                    `(TTL: ${packetInFlight.packet.ttl})`
                );
            } else {
                // Multiple next hops = broadcast/flood
                console.log(
                    `📡 Packet ${packetInFlight.packet.id.slice(0, 8)} flooding from ${packetInFlight.currentNode.name} to ${nextHops.length} ports`
                );

                for (const hop of nextHops) {
                    const clonedPacket = packetInFlight.packet.clone();

                    newPacketsInFlight.push({
                        packet: clonedPacket,
                        currentNode: hop.nextNode,
                        currentInterface: hop.nextInterface
                    });

                    console.log(
                        `  ↳ Clone ${clonedPacket.id.slice(0, 8)}: ${packetInFlight.currentNode.name} → ${hop.nextNode.name} (TTL: ${clonedPacket.ttl})`
                    );
                }
            }
        }

        this.packetsInFlight = newPacketsInFlight;
    }

    /**
     * Find ALL next hops for a packet (supports flooding/broadcasting)
     */
    private findAllNextHops(packetInFlight: PacketInFlight): NextHopInfo[] {
        const { packet, currentNode, currentInterface } = packetInFlight;

        // Check if packet reached destination
        if (this.isDestination(packet, currentNode)) {
            if (currentNode instanceof Host) {
                currentNode.receivePacket(packet);
                console.log(`✓ Packet ${packet.id} reached destination ${currentNode.name}`);
            }
            return [];
        }

        // Collect outgoing interfaces
        let outgoingInterfaces: NetworkInterface[] = [];

        if (currentNode instanceof Host) {
            if (!currentInterface) {
                console.log(`✗ Host ${currentNode.name} has no interface to send from`);
                return [];
            }
            outgoingInterfaces = [currentInterface];
        } else if (currentNode instanceof Router) {
            outgoingInterfaces = currentNode.forwardPacket(packet, currentInterface);
        } else if (currentNode instanceof Switch) {
            outgoingInterfaces = currentNode.forwardPacket(packet, currentInterface);
        } else if (currentNode instanceof Firewall) {
            outgoingInterfaces = currentNode.forwardPacket(packet, currentInterface);
        }

        if (outgoingInterfaces.length === 0) {
            console.log(`✗ Packet ${packet.id} dropped at ${currentNode.name} (no route/filtered)`);
            return [];
        }

        const nextHops: NextHopInfo[] = [];

        for (const outInterface of outgoingInterfaces) {
            const link = this.links.find(l => l.involvesInterface(outInterface));
            if (!link) {
                console.log(`✗ No link found for interface ${outInterface.ip} on ${currentNode.name}`);
                continue;
            }

            const nextInterface = link.getOtherEnd(outInterface);
            if (!nextInterface || !nextInterface.parentNode) {
                console.log(`✗ No connected node found via link ${link.id}`);
                continue;
            }

            nextHops.push({
                nextNode: nextInterface.parentNode,
                nextInterface,
                viaLink: link
            });
        }

        return nextHops;
    }

    /** Run simulation continuously until all packets are delivered/dropped */
    async run(stepDelay: number = 1000): Promise<void> {
        this.simulationRunning = true;
        console.log("=== Simulation Started ===");

        while (this.packetsInFlight.length > 0 && this.simulationRunning) {
            this.step();
            await new Promise(resolve => setTimeout(resolve, stepDelay));
        }

        this.simulationRunning = false;
        console.log("=== Simulation Completed ===");
    }

    /** Stop the simulation */
    stop(): void {
        this.simulationRunning = false;
        console.log("Simulation stopped");
    }

    /** Clear all packets in flight */
    clearPackets(): void {
        this.packetsInFlight = [];
        console.log("All packets cleared");
    }

    /** Get current packets in flight (for visualization) */
    getPacketsInFlight(): ReadonlyArray<Readonly<PacketInFlight>> {
        return this.packetsInFlight;
    }

    /** Helper: find node by name */
    findNodeByName(name: string): Node | undefined {
        return this.nodes.find(n => n.name === name);
    }

    /** Helper: find node by IP */
    findNodeByIP(ip: string): Node | undefined {
        return this.nodes.find(node =>
            node.getInterfaces().some(iface => iface.ip === ip)
        );
    }

    /** Auto-configure directly connected routes for routers */
    autoConfigureRoutes(): void {
        for (const node of this.nodes) {
            if (node instanceof Router) {
                for (const iface of node.getInterfaces()) {
                    const network = iface.getNetworkAddress();
                    const mask = iface.mask;
                    node.addRoute(network, mask, iface);
                }
                console.log(`Auto-configured routes for router ${node.name}`);
            }
        }
    }

    toJSON(): object {
        return {
            id: this.id,
            name: this.name,
            nodes: this.nodes.map(n => n.toJSON()),
            links: this.links.map(l => l.toJSON())
        };
    }
}
