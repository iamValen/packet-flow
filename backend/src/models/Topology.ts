import { Node, NodeType } from "./Node.js";
import { Link } from "./Link.js";
import { NetworkInterface } from "./NetworkInterface.js";
import { Router } from "./Router.js";

/**
 * Holds the full network structure: nodes and the links connecting them.
 */
export class Topology {
    readonly id: string;
    name: string;
    nodes: Node[] = [];
    links: Link[] = [];

    constructor(name: string) {
        this.id = crypto.randomUUID();
        this.name = name;
    }

    /** Adds a node to the topology if it is not already present. */
    addNode(node: Node): void {
        if (!this.nodes.includes(node))
            this.nodes.push(node);
    }

    /** Removes a node and all links connected to any of its interfaces. */
    removeNode(node: Node): void {
        this.nodes = this.nodes.filter(n => n.id !== node.id);
        const nodeIfaces = node.getInterfaces();
        this.links = this.links.filter(link =>
            !nodeIfaces.some(iface => link.hasInterface(iface))
        );
    }

    /**
     * Creates a link between two interfaces and registers it on the topology.
     * @throws if the interfaces are identical, belong to the same node, or are already linked
     */
    addLink(ifaceA: NetworkInterface, ifaceB: NetworkInterface): Link {
        if (ifaceA === ifaceB) throw new Error("cant link interface to itself");
        if (ifaceA.parentNode === ifaceB.parentNode)
            throw new Error("cant link two interfaces on same node");

        const alreadyLinked = this.links.find(l =>
            l.hasInterface(ifaceA) || l.hasInterface(ifaceB)
        );
        if (alreadyLinked) throw new Error("interface already connected");

        const link = new Link(ifaceA, ifaceB);
        this.links.push(link);
        return link;
    }

    /** Removes a link from the topology. */
    removeLink(link: Link): void {
        this.links = this.links.filter(l => l.id !== link.id);
    }

    /** Returns all links that involve at least one interface of the given node. */
    getLinksForNode(node: Node): Link[] {
        const ifaces = node.getInterfaces();
        return this.links.filter(l => ifaces.some(i => l.hasInterface(i)));
    }

    /** Finds a node by name, or returns undefined if not found. */
    findNodeByName(name: string): Node | undefined {
        return this.nodes.find(n => n.name === name);
    }

    /** Finds the node that owns the given IP address, or returns undefined. */
    findNodeByIP(ip: string): Node | undefined {
        return this.nodes.find(node =>
            node.getInterfaces().some(iface => iface.ip === ip)
        );
    }

    /** Computes the network address for a given IP and subnet mask. */
    private getNetworkAddr(ip: string, mask: string): string {
        const ipParts = ip.split(".").map(Number);
        const maskParts = mask.split(".").map(Number);
        return ipParts.map((p, i) => p & (maskParts[i] ?? 0)).join(".");
    }

    /**
     * Auto-configures routes on all routers using a distance-vector algorithm (similar to RIP).
     * Steps:
     * 1. Adds directly connected network routes to each router.
     * 2. Builds a neighbour adjacency map from router-to-router links.
     * 3. Propagates routes iteratively until no new routes are learned.
     * 4. Adds a default route to any edge router that has exactly one neighbour.
     */
    autoConfigureRoutes(): void {
        const routers = this.nodes.filter(n => n.type === NodeType.ROUTER) as Router[];
        if (routers.length === 0) return;

        routers.forEach(r => r.clearRoutes());

        for (const router of routers) {
            for (const iface of router.getInterfaces()) {
                const network = this.getNetworkAddr(iface.ip, iface.mask);
                try {
                    router.addRoute(network, iface.mask, iface);
                } catch { /* route already exists */ }
            }
        }

        type Neighbor = { router: Router; viaIface: NetworkInterface; };
        const neighbors = new Map<string, Neighbor[]>();
        routers.forEach(r => neighbors.set(r.id, []));

        for (const link of this.links) {
            const nodeA = link.ifaceA.parentNode;
            const nodeB = link.ifaceB.parentNode;
            if (nodeA instanceof Router && nodeB instanceof Router) {
                neighbors.get(nodeA.id)!.push({ router: nodeB, viaIface: link.ifaceA });
                neighbors.get(nodeB.id)!.push({ router: nodeA, viaIface: link.ifaceB });
            }
        }

        const maxIter = routers.length + 1;
        for (let i = 0; i < maxIter; i++) {
            let changed = false;
            for (const router of routers) {
                for (const { router: neighbor, viaIface } of neighbors.get(router.id) ?? []) {
                    for (const route of neighbor.getRoutes()) {
                        if (route.isDefault) continue;
                        const isDirect = router.getInterfaces().some(iface => {
                            const net = this.getNetworkAddr(iface.ip, iface.mask);
                            return net === route.destination && iface.mask === route.mask;
                        });
                        if (isDirect) continue;
                        const exists = router.getRoutes().some(r =>
                            r.destination === route.destination && r.mask === route.mask
                        );
                        if (!exists) {
                            try {
                                router.addRoute(route.destination, route.mask, viaIface);
                                changed = true;
                            } catch { /* already exists */ }
                        }
                    }
                }
            }
            if (!changed) break;
        }

        for (const router of routers) {
            const myNeighbors = neighbors.get(router.id) ?? [];
            if (myNeighbors.length === 1) {
                const hasDefault = router.getRoutes().some(r => r.isDefault);
                if (!hasDefault) {
                    try {
                        router.addRoute("0.0.0.0", "0.0.0.0", myNeighbors[0]!.viaIface);
                    } catch { /* already exists */ }
                }
            }
        }

        console.log("--- routes configured ---");
    }
}