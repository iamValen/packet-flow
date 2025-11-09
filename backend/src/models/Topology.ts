import { Node, NodeType } from './Node.js';
import { Link } from './Link.js';
import { NetworkInterface } from './NetworkInterface.js';
import { Packet, Protocol } from './Packet.js';
import { Host } from './Host.js';
import { Router } from './Router.js';
import { Switch } from './Switch.js';
import { Firewall } from './Firewall.js';
import type { ARPEntry } from './Host.js';

/**
 * Represents a packet in transit within the topology
 */
interface PacketInFlight {
    packet: Packet;
    currentNode: Node;
    currentInterface?: NetworkInterface; // Interface the packet arrived on (if any)
}

/**
 * Represents information for the next hop of a packet
 */
interface NextHopInfo {
    nextNode: Node;
    nextInterface: NetworkInterface; // Interface on the next node where packet arrives
    viaLink: Link;
}

/**
 * Represents a packet waiting for ARP resolution
 */
interface PendingPacket {
    originalPacket: Packet;
    sourceHost: Host;
    sourceInterface: NetworkInterface;
    awaitingIp: string;
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
    private pendingPackets: PendingPacket[] = [];
    private deliveredPackets: Map<string, Packet> = new Map();

    /**
     * Create a new Topology instance
     * @param name - Topology name
     */
    constructor(name: string) {
        this.id = crypto.randomUUID();
        this.name = name;
        this.nodes = [];
        this.links = [];
        this.packetsInFlight = [];
        this.simulationRunning = false;
    }

    
    // Topology management

    /**
     * Add a node to the topology
     * @param node - Node to add
     */
    addNode(node: Node): void {
        if (!this.nodes.includes(node))
            this.nodes.push(node);
    }

    /**
     * Remove a node and all its connected links
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
     * Create a bidirectional link between two interfaces
     * @param intfA - First interface
     * @param intfB - Second interface
     * @returns The created Link
     * @throws Error if interfaces are invalid or already linked
     */
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

    /**
     * Remove a link from the topology
     * @param link - Link to remove
     */
    removeLink(link: Link): void {
        this.links = this.links.filter(l => l.id !== link.id);
    }

    /**
     * Get all links connected to a specific node
     * @param node - Node to query
     * @returns Array of Links
     */
    getLinksForNode(node: Node): Link[] {
        const nodeIntfs = node.getInterfaces();
        return this.links.filter(link =>
            nodeIntfs.some(intf => link.involvesInterface(intf))
        );
    }


    // Packet simulation

    /**
     * Send a packet from a host to a destination IP
     * Handles ARP resolution if necessary
     * @param sourceHost - Host sending the packet
     * @param dstIp - Destination IP
     * @param protocol - Packet protocol
     * @param payload - Optional payload
     * @returns The packet created
     */
    sendPacket(sourceHost: Host, dstIp: string, protocol: Protocol, payload?: string): Packet {
        const { packet, sourceInterface } = sourceHost.sendPacket(dstIp, protocol, payload);

        if (packet.dstMAC && packet.dstMAC !== "FF:FF:FF:FF:FF:FF") {
            this.packetsInFlight.push({ 
                packet, 
                currentNode: sourceHost
            });
            console.log(`+++ Packet ${packet.id} injected from ${sourceHost.name} (${sourceInterface.ip}) to ${dstIp}`);
            return packet;
        }

        const targetIp = sourceInterface.isInSubnet(dstIp) ? dstIp : sourceHost.defaultGateway!;
        const arpRequest = sourceHost.sendARPrequest(targetIp, sourceInterface);
        
        this.packetsInFlight.push({
            packet: arpRequest,
            currentNode: sourceHost
        });

        this.pendingPackets.push({
            originalPacket: packet,
            sourceHost,
            sourceInterface,
            awaitingIp: targetIp
        });

        console.log(`+++ Host ${sourceHost.name} ARPing for ${targetIp} before sending ${protocol} packet`);
        return packet;
    }

    /**
     * Check if a packet has reached its destination node
     * @param packet - Packet to check
     * @param node - Node to compare
     * @returns True if packet is destined for the node
     */
    private isDestination(packet: Packet, node: Node): boolean {
        const interfaces = node.getInterfaces();
        return interfaces.some(iface => iface.ip === packet.dstIp);
    }

    /**
     * Process one simulation step: forwards packets and resolves pending ARP
     */
    step(): void {
        if (this.packetsInFlight.length === 0) {
            console.log("No packets in flight");
            return;
        }

        console.log(`\n--- Step (${this.packetsInFlight.length} packet(s) in flight) ---`);

        const newPacketsInFlight: PacketInFlight[] = [];

        for (const packetInFlight of this.packetsInFlight) {
            const { packet, currentNode, currentInterface } = packetInFlight;

            const isAtDestination = this.isDestination(packet, currentNode);
            
            const shouldProcessHere = isAtDestination || 
                (packet.protocol === Protocol.ARP && 
                (currentNode instanceof Router || currentNode instanceof Firewall));

            if (shouldProcessHere) {
                if (currentNode instanceof Host || currentNode instanceof Router || currentNode instanceof Firewall) {
                    const reply = currentNode.receivePacket(packet);
                    
                     if (isAtDestination) {
                        this.deliveredPackets.set(packet.dstIp + '-' + currentNode.name, packet);
                        console.log(`✓ Packet ${packet.id} reached destination ${currentNode.name}`);
                    }

                    if (reply) {
                        const replyIntf = currentNode.getInterfaces().find(i => i.ip === reply.srcIp)
                            || currentNode.getInterfaces()[0];
                        if (replyIntf) {
                            newPacketsInFlight.push({
                                packet: reply,
                                currentNode
                            });
                        }
                    }
                }
                
                if (isAtDestination) continue;
            }

            const nextHops = this.findAllNextHops(packetInFlight);

            if (nextHops.length === 0) {
                console.log(`Packet ${packet.id} dropped at ${currentNode.name} (no route)`);
                continue;
            }

            if (nextHops.length === 1) {
                const hop = nextHops[0]!;
                newPacketsInFlight.push({
                    packet: packet,
                    currentNode: hop.nextNode,
                    currentInterface: hop.nextInterface
                });
                console.log(`Packet ${packet.id.slice(0, 8)}: ${currentNode.name} → ${hop.nextNode.name}`);
            } else {
                for (const hop of nextHops) {
                    newPacketsInFlight.push({
                        packet,
                        currentNode: hop.nextNode,
                        currentInterface: hop.nextInterface
                    });
                    console.log(`Packet ${packet.id.slice(0, 8)}: ${currentNode.name} → ${hop.nextNode.name} (broadcast fan-out)`);
                }
            }
        }

        // Resolve pending ARP
        if (this.pendingPackets.length > 0) {
            const resolved: number[] = [];
            for (let i = 0; i < this.pendingPackets.length; i++) {
                const pending = this.pendingPackets[i];
                if (pending) {
                    const mac = pending.sourceHost.getARPCache().get(pending.awaitingIp)?.mac;
                    if (mac) {
                        pending.originalPacket.dstMAC = mac;
                        newPacketsInFlight.push({
                            packet: pending.originalPacket,
                            currentNode: pending.sourceHost,
                        });
                        console.log(`→ ARP resolved for ${pending.awaitingIp}, sending queued packet.`);
                        resolved.push(i);
                    }
                }
            }

            for (let j = resolved.length - 1; j >= 0; j--) {
                const idx = resolved[j];
                if (idx !== undefined) this.pendingPackets.splice(idx, 1);
            }
        }

        this.packetsInFlight = newPacketsInFlight;
    }

    /**
     * Retrieve a delivered packet to a specific node
     * @param destinationNode - Node to check
     * @returns Delivered Packet or undefined
     */
    getDeliveredPacket(destinationNode: Node): Packet | undefined {
        for (const [key, packet] of this.deliveredPackets) {
            if (key.endsWith(destinationNode.name)) {
                return packet;
            }
        }
        return undefined;
    }

    /**
     * Determine all next hop interfaces for a packet
     * @param packetInFlight - Packet in flight info
     * @returns Array of NextHopInfo
     */
    private findAllNextHops(packetInFlight: PacketInFlight): NextHopInfo[] {
        const { packet, currentNode, currentInterface } = packetInFlight;
        let outgoingInterfaces: NetworkInterface[] = [];

        if (currentNode instanceof Host) {
            if (currentInterface) return [];
            const sendInterface = currentNode.getInterfaces().find(iface => 
                iface.isInSubnet(packet.dstIp) || 
                (currentNode.defaultGateway && iface.isInSubnet(currentNode.defaultGateway))
            );
            if (sendInterface) outgoingInterfaces = [sendInterface];
        } else if (currentNode instanceof Router || currentNode instanceof Switch || currentNode instanceof Firewall) {
            outgoingInterfaces = currentNode.forwardPacket(packet, currentInterface);
        }

        const nextHops: NextHopInfo[] = [];

        for (const outInterface of outgoingInterfaces) {
            const link = this.links.find(l => l.involvesInterface(outInterface));
            if (!link) continue;
            
            const nextInterface = link.getOtherEnd(outInterface);
            if (!nextInterface || !nextInterface.parentNode) continue;

            nextHops.push({
                nextNode: nextInterface.parentNode,
                nextInterface,
                viaLink: link
            });
        }

        return nextHops;
    }

    /**
     * Run the simulation until all packets are delivered or stopped
     * @param stepDelay - Delay in ms between steps
     */
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


    // ARP / MAC utils

    /**
     * Populate ARP tables for all hosts and routers
     */
    populateARPCaches(): void {
        const hosts = this.nodes.filter(node => node.type === NodeType.HOST) as Host[];
        const routers = this.nodes.filter(node => node.type === NodeType.ROUTER) as Router[];
        const switches = this.nodes.filter(node => node.type === NodeType.SWITCH) as Switch[];

        for (const host of hosts) {
            for (const hostInterface of host.getInterfaces()) {
                for (const otherHost of hosts) {
                    if (otherHost === host) continue;
                    for (const otherInterface of otherHost.getInterfaces()) {
                        if (hostInterface.isInSubnet(otherInterface.ip)) {
                            host.addARPEntry(otherInterface.ip, otherInterface.mac);
                        }
                    }
                }
                for (const router of routers) {
                    for (const routerInterface of router.getInterfaces()) {
                        if (hostInterface.isInSubnet(routerInterface.ip)) {
                            host.addARPEntry(routerInterface.ip, routerInterface.mac);
                            router.addARPEntry(hostInterface.ip, hostInterface.mac);
                        }
                    }
                }
            }
        }

        for (const sw of switches) {
            for (const swInterface of sw.getInterfaces()) {
                const link = this.links.find(l => l.involvesInterface(swInterface));
                if (!link) continue;

                const otherInterface = link.getOtherEnd(swInterface);
                if (!otherInterface) continue;

                sw.addMACEntry(otherInterface.mac, swInterface);
            }
        }
    }

    /**
     * Get a host's ARP cache by name
     * @param hostName - Name of the host
     * @returns Map of IP → ARPEntry or null if host not found
     */
    getHostARPCache(hostName: string): Map<string, ARPEntry> | null {
        const host = this.nodes.find(node => 
            node.name === hostName && node.type === NodeType.HOST
        ) as Host | undefined;

        return host ? host.getARPCache() : null;
    }


    // Simulation Control

    /**
     * Stop the simulation
     */
    stop(): void {
        this.simulationRunning = false;
        console.log("Simulation stopped");
    }

    /**
     * Clear all packets in flight
     */
    clearPackets(): void {
        this.packetsInFlight = [];
        console.log("All packets cleared");
    }

    /**
     * Retrieve all packets currently in flight
     * @returns Read-only array of packets in flight
     */
    getPacketsInFlight(): ReadonlyArray<Readonly<PacketInFlight>> {
        return this.packetsInFlight;
    }

    /**
     * Find a node by name
     * @param name - Node name
     * @returns Node or undefined
     */
    findNodeByName(name: string): Node | undefined {
        return this.nodes.find(n => n.name === name);
    }

    /**
     * Find a node containing a specific IP
     * @param ip - IP to search for
     * @returns Node or undefined
     */
    findNodeByIP(ip: string): Node | undefined {
        return this.nodes.find(node =>
            node.getInterfaces().some(iface => iface.ip === ip)
        );
    }

    /**
     * Auto-configure routes for all routers based on connected interfaces
     */
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

    /**
     * Export topology to JSON
     * @returns Object representing topology
     */
    toJSON(): object {
        return {
            id: this.id,
            name: this.name,
            nodes: this.nodes.map(n => n.toJSON()),
            links: this.links.map(l => l.toJSON())
        };
    }
}
