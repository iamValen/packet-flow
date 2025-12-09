import { Node, NodeType } from "./Node.js";
import { Link } from "./Link.js";
import { NetworkInterface } from "./NetworkInterface.js";
import { Packet, Protocol } from "./Packet.js";
import { Host } from "./Host.js";
import { Router } from "./Router.js";
import { Switch } from "./Switch.js";
import type { ARPEntry } from "./Host.js";

/*
 * Represents a packet in transit within the topology
 */
interface PacketInFlight {
    packet: Packet;
    currentNode: Node;
    currentInterface?: NetworkInterface; // interface the packet arrived on
}

// Represents information for the next hop of a packet
interface NextHopInfo {
    nextNode: Node;
    nextInterface: NetworkInterface; // interface on the next node where packet arrives
    viaLink: Link;
}

// Represents a packet waiting for ARP resolution
interface PendingPacket {
    originalPacket: Packet;
    sourceNode: Host | Router;
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
        
        const exists = this.links.find(link => link.involvesInterface(intfA) || link.involvesInterface(intfB));
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
            sourceNode: sourceHost,
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
            else {
                packet.decrementTTL();
                if (packet.isExpired()) return [];
            }
            const sendInterface = currentNode.getInterfaces().find(iface => 
                iface.isInSubnet(packet.dstIp) || 
                (currentNode.defaultGateway && iface.isInSubnet(currentNode.defaultGateway))
            );
            if (sendInterface) outgoingInterfaces = [sendInterface];
        } else if (currentNode instanceof Router || currentNode instanceof Switch) {
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

    // ARP / MAC utils

    /**
     * Populate ARP tables for all hosts and routers in the topology
     * it's used to simplify packet analysis and remove ARP packet from the equasion
     */
    fillARP(): void {
        const hosts = this.nodes.filter(node => node.type === NodeType.HOST) as Host[];
        const routers = this.nodes.filter(node => node.type === NodeType.ROUTER) as Router[];
        const switches = this.nodes.filter(node => node.type === NodeType.SWITCH) as Switch[];

        // Populate host-to-host in same subnet
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
                
                // host-to-router in same subnet
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

        // router to router ARP entries
        for (const router of routers) {
            for (const routerInterface of router.getInterfaces()) {
                // learn all hosts reachable through this interface
                for (const host of hosts) {
                    for (const hostInterface of host.getInterfaces()) {
                        if (routerInterface.isInSubnet(hostInterface.ip)) {
                            router.addARPEntry(hostInterface.ip, hostInterface.mac);
                        }
                    }
                }
                
                // learn other routers in same subnet
                for (const otherRouter of routers) {
                    if (otherRouter === router) continue;
                    for (const otherInterface of otherRouter.getInterfaces()) {
                        if (routerInterface.isInSubnet(otherInterface.ip)) {
                            router.addARPEntry(otherInterface.ip, otherInterface.mac);
                            otherRouter.addARPEntry(routerInterface.ip, routerInterface.mac);
                        }
                    }
                }
            }
        }

        // Populate switch MAC tables
        for (const sw of switches) {
            for (const swInterface of sw.getInterfaces()) {
                const link = this.links.find(l => l.involvesInterface(swInterface));
                if (!link) continue;

                const otherInterface = link.getOtherEnd(swInterface);
                if (!otherInterface) continue;

                sw.learnMAC(otherInterface.mac, swInterface);
            }
        }
    }

    /**
     * Get a host's ARP cache by name
     * @param hostName - Name of the host
     * @returns Map of IP => ARPEntry or null if host not found
     */
    getHostARPCache(hostName: string): Map<string, ARPEntry> | null {
        const host = this.nodes.find(node => 
            node.name === hostName && node.type === NodeType.HOST
        ) as Host | undefined;

        return host ? host.getARPCache() : null;
    }

    // Simulation Control

    /**
     * Run the simulation until all packets are delivered or stopped
     * @param stepDelay - Delay in ms between steps
     */
    async run(stepDelay: number = 1000, autoPopulateARP: boolean = false): Promise<void> {
        this.simulationRunning = true;
        console.log("=== Simulation Started ===");

        if (autoPopulateARP) {
            console.warn("Running in Simple Mode - ARP caches pre-populated");
            this.fillARP();
        }

        while (this.packetsInFlight.length > 0 && this.simulationRunning) {
            this.step();
            await new Promise(resolve => setTimeout(resolve, stepDelay));
        }

        this.simulationRunning = false;
        console.log("=== Simulation Completed ===");
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
                (currentNode instanceof Router));

            if (shouldProcessHere) {
                if (currentNode instanceof Host || currentNode instanceof Router) {
                    const reply = currentNode.receivePacket(packet);
                    
                    if (isAtDestination) {
                        this.deliveredPackets.set(packet.dstIp + "-" + currentNode.name, packet);
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

            const nextHops: NextHopInfo[] = this.findAllNextHops(packetInFlight);

            // if router ARP miss
            if (nextHops.length === 0 && currentNode instanceof Router && packet.protocol !== Protocol.ARP) {
                const arpInfo = currentNode.needsArpResolution(packet.dstIp);
                
                if (arpInfo.needed && arpInfo.outInterface) {
                    // Send ARP request
                    const arpRequest = currentNode.sendARPrequest(arpInfo.targetIp, arpInfo.outInterface);
                    newPacketsInFlight.push({
                        packet: arpRequest,
                        currentNode
                    });
                    
                    this.pendingPackets.push({
                        originalPacket: packet,
                        sourceNode: currentNode as Router,
                        sourceInterface: arpInfo.outInterface,
                        awaitingIp: arpInfo.targetIp
                    });
                    
                    console.log(`Router ${currentNode.name}: ARP miss, queued packet for ${arpInfo.targetIp}`);
                    continue;
                }
            }

            // Drop packets with no route
            if (nextHops.length === 0) {
                console.log(`Packet ${packet.id} dropped at ${currentNode.name} (no route)`);
                continue;
            }

            // forward packet
            if (nextHops.length === 1) {
                const hop = nextHops[0]!;
                newPacketsInFlight.push({
                    packet: packet,
                    currentNode: hop.nextNode,
                    currentInterface: hop.nextInterface
                });
                console.log(`Packet ${packet.id.slice(0, 8)}: ${currentNode.name} => ${hop.nextNode.name}`);
            } else {
                for (const hop of nextHops) {
                    const clonedPacket = packet.clone();
                    newPacketsInFlight.push({
                        packet: clonedPacket,
                        currentNode: hop.nextNode,
                        currentInterface: hop.nextInterface
                    });
                    console.log(`Packet ${packet.id.slice(0, 8)}: ${currentNode.name} => ${hop.nextNode.name} (broadcast fan-out)`);
                }
            }
        }

        // Resolve pending ARP
        if (this.pendingPackets.length > 0) {
            const resolved: number[] = [];

            for (let i = 0; i < this.pendingPackets.length; i++) {
                const pending = this.pendingPackets[i];
                if (pending) {
                    const cache = pending.sourceNode.getARPCache();
                    const mac = cache.get(pending.awaitingIp)?.mac;
                    
                    if (mac) {
                        pending.originalPacket.dstMAC = mac;
                        newPacketsInFlight.push({
                            packet: pending.originalPacket,
                            currentNode: pending.sourceNode,
                        });
                        console.log(`=> ARP resolved for ${pending.awaitingIp}, sending queued packet from ${pending.sourceNode.name}`);
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
     * Helper: Get network address from IP and mask
     */
    private getNetworkAddress(ip: string, mask: string): string {
        const ipParts = ip.split('.').map(Number);
        const maskParts = mask.split('.').map(Number);
        const networkParts = ipParts.map((part, i) => part & (maskParts[i] ?? 0));
        return networkParts.join('.');
    }

    /**
     * Auto-configure directly connected routes for all routers
     * (Original method - only adds directly connected networks)
     */
    autoConfigureRoutes(): void {
        for (const node of this.nodes) {
            if (node instanceof Router) {
                for (const iface of node.getInterfaces()) {
                    const network = iface.getNetworkAddress();
                    const mask = iface.mask;
                    try {
                        node.addRoute(network, mask, iface);
                    } catch (e) {
                        // Route already exists, skip
                    }
                }
                console.log(`Auto-configured directly connected routes for router ${node.name}`);
            }
        }
    }

    /**
     * Auto-configure ALL routes for routers using a distance-vector-like algorithm.
     * This simulates how routes would be learned in a real network (similar to RIP).
     * 
     * Steps:
     * 1. Clear existing routes on all routers
     * 2. Add directly connected networks
     * 3. Build adjacency map (which routers connect to which)
     * 4. Propagate routes between neighboring routers
     * 5. Add default routes for edge routers (routers with only one neighbor)
     */
    autoConfigureAllRoutes(): void {
        const routers = this.nodes.filter(node => node.type === NodeType.ROUTER) as Router[];
        
        if (routers.length === 0) {
            console.log("No routers in topology, skipping route configuration");
            return;
        }

        // Step 1: Clear existing routes on all routers
        for (const router of routers) {
            router.clearRoutes();
        }

        // Step 2: Add directly connected networks to each router
        for (const router of routers) {
            for (const iface of router.getInterfaces()) {
                if (iface.ip && iface.mask) {
                    const network = this.getNetworkAddress(iface.ip, iface.mask);
                    try {
                        router.addRoute(network, iface.mask, iface);
                    } catch (e) {
                        // Route already exists
                    }
                }
            }
        }

        // Step 3: Build adjacency map - find which routers are directly connected
        // Map: routerId -> [{ neighborRouter, viaOurInterface, neighborInterface }]
        type Adjacency = { 
            neighbor: Router; 
            viaInterface: NetworkInterface;
            neighborInterface: NetworkInterface;
        };
        const adjacencyMap = new Map<string, Adjacency[]>();

        for (const router of routers) {
            adjacencyMap.set(router.id, []);
        }

        // Check each link to find router-to-router connections
        for (const link of this.links) {
            const nodeA = link.interfaceA.parentNode;
            const nodeB = link.interfaceB.parentNode;

            // Only care about router-to-router links
            if (nodeA instanceof Router && nodeB instanceof Router) {
                // Add A -> B
                adjacencyMap.get(nodeA.id)!.push({
                    neighbor: nodeB,
                    viaInterface: link.interfaceA,
                    neighborInterface: link.interfaceB
                });
                // Add B -> A
                adjacencyMap.get(nodeB.id)!.push({
                    neighbor: nodeA,
                    viaInterface: link.interfaceB,
                    neighborInterface: link.interfaceA
                });
            }
        }

        // Step 4: Propagate routes using distance-vector algorithm
        // Run multiple iterations to ensure all routes propagate through the network
        const maxIterations = routers.length + 1;

        for (let iteration = 0; iteration < maxIterations; iteration++) {
            let changed = false;

            for (const router of routers) {
                const neighbors = adjacencyMap.get(router.id) || [];

                for (const { neighbor, viaInterface } of neighbors) {
                    // Learn routes from this neighbor
                    const neighborRoutes = neighbor.getRoutingTable();

                    for (const route of neighborRoutes) {
                        // Skip default routes (we'll handle those separately)
                        if (route.isDefault) continue;

                        // Skip if this network is directly connected to us
                        const isDirectlyConnected = router.getInterfaces().some(iface => {
                            const ourNetwork = this.getNetworkAddress(iface.ip, iface.mask);
                            return ourNetwork === route.destination && iface.mask === route.mask;
                        });

                        if (isDirectlyConnected) continue;

                        // Check if we already have a route to this network
                        const existingRoutes = router.getRoutingTable();
                        const hasRoute = existingRoutes.some(
                            r => r.destination === route.destination && r.mask === route.mask
                        );

                        if (!hasRoute) {
                            // Add route to this network via our interface to the neighbor
                            try {
                                router.addRoute(route.destination, route.mask, viaInterface);
                                changed = true;
                                console.log(`Router ${router.name}: Learned route to ${route.destination}/${route.mask} via ${neighbor.name}`);
                            } catch (e) {
                                // Route exists or invalid
                            }
                        }
                    }
                }
            }

            // If no changes in this iteration, routes have converged
            if (!changed) {
                console.log(`Routes converged after ${iteration + 1} iteration(s)`);
                break;
            }
        }

        // Step 5: Add default routes for edge routers (routers with only one neighbor router)
        for (const router of routers) {
            const neighbors = adjacencyMap.get(router.id) || [];

            // If router has exactly one router neighbor, add default route through it
            if (neighbors.length === 1) {
                const { viaInterface } = neighbors[0]!;
                const existingRoutes = router.getRoutingTable();
                const hasDefault = existingRoutes.some(r => r.isDefault);

                if (!hasDefault) {
                    try {
                        router.addRoute("0.0.0.0", "0.0.0.0", viaInterface);
                        console.log(`Router ${router.name}: Added default route via ${viaInterface.ip}`);
                    } catch (e) {
                        // Default route already exists
                    }
                }
            }
        }

        // Log final routing tables
        for (const router of routers) {
            const routes = router.getRoutingTable();
            console.log(`\nRouter ${router.name} routing table (${routes.length} routes):`);
            for (const route of routes) {
                const prefix = route.isDefault ? "(default) " : "";
                console.log(`  ${prefix}${route.destination}/${route.cidr} via ${route.nextHopInterface.ip}`);
            }
        }
    }
}