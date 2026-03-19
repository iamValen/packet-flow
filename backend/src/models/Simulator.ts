import { Topology } from "./Topology.js";
import { Node, NodeType } from "./Node.js";
import { NetworkInterface } from "./NetworkInterface.js";
import { Packet, Protocol } from "./Packet.js";
import { Host } from "./Host.js";
import { Router } from "./Router.js";
import { Switch } from "./Switch.js";

/** A packet currently in transit through the network. */
type PacketInFlight = {
    packet: Packet;
    currentNode: Node;
    currentIface?: NetworkInterface;
};

/** A packet waiting for ARP resolution before it can be sent. */
type PendingPacket = {
    packet: Packet;
    sourceNode: Host | Router;
    sourceIface: NetworkInterface;
    /** IP address we are waiting for an ARP reply from. */
    waitingFor: string;
};

/** Next-hop destination for a packet. */
type NextHop = {
    node: Node;
    iface: NetworkInterface;
};

/** A packet that has been successfully delivered to its destination. */
type DeliveredPacket = {
    packet: Packet;
    node: Node;
    timestamp: number;
};

/**
 * Drives packet simulation on a topology.
 * Handles step-by-step forwarding, ARP resolution, and delivery tracking.
 */
export class Simulator {
    private topology: Topology;
    private packetsInFlight: PacketInFlight[] = [];
    private pendingPackets: PendingPacket[] = [];
    private delivered: DeliveredPacket[] = [];
    private running = false;

    constructor(topology: Topology) {
        this.topology = topology;
    }

    /**
     * Pre-fills ARP caches for all nodes so packets skip ARP resolution.
     * Useful for simplified simulations where ARP overhead is not needed.
     */
    fillARP(): void {
        const hosts = this.topology.nodes.filter(n => n.type === NodeType.HOST) as Host[];
        const routers = this.topology.nodes.filter(n => n.type === NodeType.ROUTER) as Router[];
        const switches = this.topology.nodes.filter(n => n.type === NodeType.SWITCH) as Switch[];

        for (const host of hosts) {
            for (const hIface of host.getInterfaces()) {
                for (const other of hosts) {
                    if (other === host) continue;
                    for (const oIface of other.getInterfaces()) {
                        if (hIface.isInSubnet(oIface.ip))
                            host.addARP(oIface.ip, oIface.mac);
                    }
                }
                for (const router of routers) {
                    for (const rIface of router.getInterfaces()) {
                        if (hIface.isInSubnet(rIface.ip)) {
                            host.addARP(rIface.ip, rIface.mac);
                            router.addARP(hIface.ip, hIface.mac);
                        }
                    }
                }
            }
        }

        for (const router of routers) {
            for (const rIface of router.getInterfaces()) {
                for (const host of hosts) {
                    for (const hIface of host.getInterfaces()) {
                        if (rIface.isInSubnet(hIface.ip))
                            router.addARP(hIface.ip, hIface.mac);
                    }
                }
                for (const other of routers) {
                    if (other === router) continue;
                    for (const oIface of other.getInterfaces()) {
                        if (rIface.isInSubnet(oIface.ip)) {
                            router.addARP(oIface.ip, oIface.mac);
                            other.addARP(rIface.ip, rIface.mac);
                        }
                    }
                }
            }
        }

        for (const sw of switches) {
            for (const swIface of sw.getInterfaces()) {
                const link = this.topology.links.find(l => l.hasInterface(swIface));
                if (!link) continue;
                const otherIface = link.getOtherEnd(swIface);
                if (otherIface)
                    sw.learnMAC(otherIface.mac, swIface);
            }
        }

        console.log("arp caches filled");
    }

    /**
     * Injects a packet into the simulation from a host node.
     * If the destination MAC is unknown, an ARP request is generated first
     * and the data packet is queued until ARP resolves.
     * @param source - the host node sending the packet
     * @param dstIp - destination IP address
     * @param protocol - protocol to use
     * @param payload - optional packet payload
     * @returns the packet that was queued or sent
     */
    sendPacket(source: Host, dstIp: string, protocol: Protocol, payload?: string): Packet {
        const { packet, iface } = source.sendPacket(dstIp, protocol, payload);

        if (packet.dstMAC && packet.dstMAC !== "FF:FF:FF:FF:FF:FF") {
            this.packetsInFlight.push({ packet, currentNode: source });
            console.log(`+++ sent ${protocol} from ${source.name} to ${dstIp}`);
            return packet;
        }

        const targetIp = iface.isInSubnet(dstIp) ? dstIp : source.defaultGateway!;
        const arpReq = source.makeARPRequest(targetIp, iface);
        this.packetsInFlight.push({ packet: arpReq, currentNode: source });
        this.pendingPackets.push({ packet, sourceNode: source, sourceIface: iface, waitingFor: targetIp });
        console.log(`ARP request for ${targetIp} before sending`);
        return packet;
    }

    /** Returns true if the packet has arrived at its destination node. */
    private isDestination(packet: Packet, node: Node): boolean {
        return node.getInterfaces().some(i => i.ip === packet.dstIp);
    }

    /** Resolves the next hops for a packet currently at a given node. */
    private findNextHops(pif: PacketInFlight): NextHop[] {
        const { packet, currentNode, currentIface } = pif;
        let outIfaces: NetworkInterface[] = [];

        if (currentNode instanceof Host) {
            if (currentIface) return [];
            packet.decrementTTL();
            if (packet.isExpired()) return [];

            const sendIface = currentNode.getInterfaces().find(i =>
                i.isInSubnet(packet.dstIp) ||
                (currentNode.defaultGateway && i.isInSubnet(currentNode.defaultGateway))
            );
            if (sendIface) outIfaces = [sendIface];
        } else if (currentNode instanceof Router || currentNode instanceof Switch) {
            outIfaces = currentNode.forward(packet, currentIface);
        }

        const hops: NextHop[] = [];
        for (const outIface of outIfaces) {
            const link = this.topology.links.find(l => l.hasInterface(outIface));
            if (!link) continue;
            const nextIface = link.getOtherEnd(outIface);
            if (!nextIface?.parentNode) continue;
            hops.push({ node: nextIface.parentNode, iface: nextIface });
        }
        return hops;
    }

    /**
     * Advances the simulation by one tick.
     * Each packet in flight moves to its next hop.
     * Pending ARP-blocked packets are released once ARP resolves.
     * @returns the number of packets still in flight and the packets delivered this step
     */
    step(): { packetsInFlight: number; deliveredThisStep: DeliveredPacket[] } {
        const deliveredThisStep: DeliveredPacket[] = [];

        if (this.packetsInFlight.length === 0) {
            console.log("no packets in flight");
            return { packetsInFlight: 0, deliveredThisStep };
        }

        console.log(`--- step (${this.packetsInFlight.length} packets) ---`);
        const newPackets: PacketInFlight[] = [];

        for (const pif of this.packetsInFlight) {
            const { packet, currentNode, currentIface } = pif;
            const atDest = this.isDestination(packet, currentNode);
            const isArp = packet.protocol === Protocol.ARP;

            // hosts and routers process packets addressed to them; routers also handle ARP in transit
            const shouldProcess = atDest || (isArp && currentNode instanceof Router);

            if (shouldProcess && (currentNode instanceof Host || currentNode instanceof Router)) {
                const reply = currentNode.receivePacket(packet);

                if (atDest) {
                    const deliveryInfo: DeliveredPacket = { packet, node: currentNode, timestamp: Date.now() };
                    this.delivered.push(deliveryInfo);
                    deliveredThisStep.push(deliveryInfo);
                    console.log(`Delivered ${packet.protocol} to ${currentNode.name}\n`);
                }

                if (reply) {
                    newPackets.push({ packet: reply, currentNode });
                    console.log(`${currentNode.name} generated ${reply.protocol} reply`);
                }

                if (atDest) continue;
            }

            const hops = this.findNextHops(pif);

            if (hops.length === 0 && currentNode instanceof Router && !isArp) {
                const arpInfo = currentNode.needsARP(packet.dstIp);
                if (arpInfo.needed && arpInfo.outIface) {
                    const arpReq = currentNode.makeARPRequest(arpInfo.targetIp, arpInfo.outIface);
                    newPackets.push({ packet: arpReq, currentNode });
                    this.pendingPackets.push({
                        packet,
                        sourceNode: currentNode,
                        sourceIface: arpInfo.outIface,
                        waitingFor: arpInfo.targetIp
                    });
                    console.log(`router ${currentNode.name} arping for ${arpInfo.targetIp}`);
                    continue;
                }
            }

            if (hops.length === 0) {
                console.log(`packet dropped at ${currentNode.name}`);
                continue;
            }

            if (hops.length === 1) {
                const hop = hops[0]!;
                newPackets.push({ packet, currentNode: hop.node, currentIface: hop.iface });
                console.log(`${packet.protocol}: ${currentNode.name} -> ${hop.node.name}`);
            } else {
                for (const hop of hops) {
                    const clone = packet.clone();
                    newPackets.push({ packet: clone, currentNode: hop.node, currentIface: hop.iface });
                    console.log(`${packet.protocol}: ${currentNode.name} -> ${hop.node.name} (broadcast)`);
                }
            }
        }

        const resolved: number[] = [];
        for (let i = 0; i < this.pendingPackets.length; i++) {
            const pending = this.pendingPackets[i]!;
            const mac = pending.sourceNode.getARPCache().get(pending.waitingFor)?.mac;
            if (mac) {
                pending.packet.dstMAC = mac;
                newPackets.push({ packet: pending.packet, currentNode: pending.sourceNode });
                console.log(`=> arp resolved ${pending.waitingFor}, sending queued packet`);
                resolved.push(i);
            }
        }
        for (let i = resolved.length - 1; i >= 0; i--)
            this.pendingPackets.splice(resolved[i]!, 1);

        this.packetsInFlight = newPackets;
        return { packetsInFlight: this.packetsInFlight.length, deliveredThisStep };
    }

    /**
     * Runs the simulation continuously until all packets are delivered or `stop()` is called.
     * @param delay - milliseconds to wait between steps
     */
    async run(delay: number = 1000): Promise<void> {
        this.running = true;
        console.log("=== simulation started ===");

        while (this.packetsInFlight.length > 0 && this.running) {
            this.step();
            await new Promise(r => setTimeout(r, delay));
        }

        this.running = false;
        console.log("=== simulation done ===");
    }

    /** Stops a running simulation. */
    stop(): void {
        this.running = false;
    }

    /** Clears all in-flight and pending packets. */
    clear(): void {
        this.packetsInFlight = [];
        this.pendingPackets = [];
    }

    /** Returns all packets currently in flight. */
    getPacketsInFlight(): readonly PacketInFlight[] {
        return this.packetsInFlight;
    }

    /**
     * Returns the first delivered packet received by a given node, if any.
     * @param node - the node to check
     */
    getDelivered(node: Node): Packet | undefined {
        for (const d of this.delivered) {
            if (d.node.name === node.name) return d.packet;
        }
        return undefined;
    }

    /** Returns all delivered packets across the entire simulation. */
    getAllDelivered(): readonly DeliveredPacket[] {
        return this.delivered;
    }
}