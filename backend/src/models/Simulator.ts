import { Topology } from "./Topology.js";
import { Node, NodeType } from "./Node.js";
import { NetworkInterface } from "./NetworkInterface.js";
import { Packet, Protocol } from "./Packet.js";
import { Host } from "./Host.js";
import { Router } from "./Router.js";
import { Switch } from "./Switch.js";

// packet in transit
type PacketInFlight = {
    packet: Packet;
    currentNode: Node;
    currentIface?: NetworkInterface;
};

// pending arp resolution
type PendingPacket = {
    packet: Packet;
    sourceNode: Host | Router;
    sourceIface: NetworkInterface;
    waitingFor: string;  // ip we're arping for
};

// next hop info
type NextHop = {
    node: Node;
    iface: NetworkInterface;
};

// delivered packet info
type DeliveredPacket = {
    packet: Packet;
    node: Node;
    timestamp: number;
};

/**
 * runs packet simulation on a topology
 * handles packet forwarding, arp resolution, etc
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

    // prefill arp caches to skip arp in simple mode
    fillARP(): void {
        const hosts = this.topology.nodes.filter(n => n.type === NodeType.HOST) as Host[];
        const routers = this.topology.nodes.filter(n => n.type === NodeType.ROUTER) as Router[];
        const switches = this.topology.nodes.filter(n => n.type === NodeType.SWITCH) as Switch[];

        // hosts learn about other hosts and routers in same subnet
        for (const host of hosts) {
            for (const hIface of host.getInterfaces()){
                // other hosts
                for (const other of hosts) {
                    if (other === host) continue;
                    for (const oIface of other.getInterfaces()){
                        if (hIface.isInSubnet(oIface.ip)) {
                            host.addARP(oIface.ip, oIface.mac);
                        }
                    }
                }
                // routers
                for (const router of routers) {
                    for (const rIface of router.getInterfaces()){
                        if (hIface.isInSubnet(rIface.ip)){
                            host.addARP(rIface.ip, rIface.mac);
                            router.addARP(hIface.ip, hIface.mac);
                        }
                    }
                }
            }
        }

        // routers learn about each other
        for (const router of routers) {
            for (const rIface of router.getInterfaces()){
                for (const host of hosts) {
                    for (const hIface of host.getInterfaces()){
                        if (rIface.isInSubnet(hIface.ip)){
                            router.addARP(hIface.ip, hIface.mac);
                        }
                    }
                }
                for (const other of routers) {
                    if (other === router) continue;
                    for (const oIface of other.getInterfaces()){
                        if (rIface.isInSubnet(oIface.ip)){
                            router.addARP(oIface.ip, oIface.mac);
                            other.addARP(rIface.ip, rIface.mac);
                        }
                    }
                }
            }
        }

        // switches learn macs from connected interfaces
        for (const sw of switches) {
            for (const swIface of sw.getInterfaces()){
                const link = this.topology.links.find(l => l.hasInterface(swIface));
                if (!link) continue;
                const otherIface = link.getOtherEnd(swIface);
                if (otherIface) {
                    sw.learnMAC(otherIface.mac, swIface);
                }
            }
        }

        console.log("arp caches filled");
    }

    // send a packet from a host
    sendPacket(source: Host, dstIp: string, protocol: Protocol, payload?: string): Packet {
        const { packet, iface } = source.sendPacket(dstIp, protocol, payload);

        // if we have the mac, send directly
        if (packet.dstMAC && packet.dstMAC !== "FF:FF:FF:FF:FF:FF") {
            this.packetsInFlight.push({ packet, currentNode: source });
            console.log(`+++ sent ${protocol} from ${source.name} to ${dstIp}`);
            return packet;
        }

        // need arp first
        const targetIp = iface.isInSubnet(dstIp) ? dstIp : source.defaultGateway!;
        const arpReq = source.makeARPRequest(targetIp, iface);
        this.packetsInFlight.push({ packet: arpReq, currentNode: source });
        this.pendingPackets.push({
            packet,
            sourceNode: source,
            sourceIface: iface,
            waitingFor: targetIp
        });
        console.log(`+++ arping for ${targetIp} before sending`);
        return packet;
    }

    // check if packet reached its destination
    private isDestination(packet: Packet, node: Node): boolean {
        return node.getInterfaces().some(i => i.ip === packet.dstIp);
    }

    // find next hops for a packet
    private findNextHops(pif: PacketInFlight): NextHop[] {
        const { packet, currentNode, currentIface } = pif;
        let outIfaces: NetworkInterface[] = [];

        if (currentNode instanceof Host) {
            // hosts only send, not forward
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

        // find next nodes via links
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

    // run one simulation step
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
            const atDest: boolean = this.isDestination(packet, currentNode);
            const isArp: boolean = packet.protocol === Protocol.ARP;

            // process packet at this node?
            const shouldProcess = atDest || (isArp && currentNode instanceof Router);

            if (shouldProcess && (currentNode instanceof Host || currentNode instanceof Router)){
                const reply = currentNode.receivePacket(packet);

                if (atDest) {
                    const deliveryInfo: DeliveredPacket = {
                        packet,
                        node: currentNode,
                        timestamp: Date.now()
                    };
                    this.delivered.push(deliveryInfo);
                    deliveredThisStep.push(deliveryInfo);
                    console.log(`✓ delivered ${packet.protocol} to ${currentNode.name}`);
                }

                // if there's a reply, queue it
                if (reply) {
                    // add reply packet to the simulation
                    newPackets.push({ packet: reply, currentNode });
                    console.log(`+++ ${currentNode.name} generated ${reply.protocol} reply`);
                }

                if (atDest) continue;
            }

            // find next hops
            const hops = this.findNextHops(pif);

            // handle router arp miss
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

            // forward packet
            if (hops.length === 1) {
                const hop = hops[0]!;
                newPackets.push({ packet, currentNode: hop.node, currentIface: hop.iface });
                console.log(`${packet.protocol}: ${currentNode.name} -> ${hop.node.name}`);
            } else {
                // broadcast - clone packet
                for (const hop of hops) {
                    const clone = packet.clone();
                    newPackets.push({ packet: clone, currentNode: hop.node, currentIface: hop.iface });
                    console.log(`${packet.protocol}: ${currentNode.name} -> ${hop.node.name} (broadcast)`);
                }
            }
        }

        // check pending arp
        const resolved: number[] = [];
        for (let i = 0; i < this.pendingPackets.length; i++) {
            const pending = this.pendingPackets[i]!;
            const cache = pending.sourceNode.getARPCache();
            const mac = cache.get(pending.waitingFor)?.mac;
            if (mac) {
                pending.packet.dstMAC = mac;
                newPackets.push({ packet: pending.packet, currentNode: pending.sourceNode });
                console.log(`=> arp resolved ${pending.waitingFor}, sending queued packet`);
                resolved.push(i);
            }
        }
        // remove resolved in reverse order
        for (let i = resolved.length - 1; i >= 0; i--) {
            this.pendingPackets.splice(resolved[i]!, 1);
        }

        this.packetsInFlight = newPackets;
        return { packetsInFlight: this.packetsInFlight.length, deliveredThisStep };
    }

    // run until all packets delivered
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

    stop(): void {
        this.running = false;
    }

    clear(): void {
        this.packetsInFlight = [];
        this.pendingPackets = [];
    }

    getPacketsInFlight(): readonly PacketInFlight[] {
        return this.packetsInFlight;
    }

    getDelivered(node: Node): Packet | undefined {
        for (const d of this.delivered) {
            if (d.node.name === node.name) return d.packet;
        }
        return undefined;
    }

    getAllDelivered(): readonly DeliveredPacket[] {
        return this.delivered;
    }
}