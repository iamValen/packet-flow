import { Node, NodeType } from "./Node.js";
import { Link } from "./Link.js";
import { NetworkInterface } from "./NetworkInterface.js";
import { Router } from "./Router.js";

/**
 * holds the network structure - nodes and links
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

    addNode(node: Node): void {
        if (!this.nodes.includes(node))
            this.nodes.push(node);
    }

    removeNode(node: Node): void {
        this.nodes = this.nodes.filter(n => n.id !== node.id);
        // also remove any links to this node
        const nodeIfaces = node.getInterfaces();
        this.links = this.links.filter(link =>
            !nodeIfaces.some(iface => link.hasInterface(iface))
        );
    }

    addLink(ifaceA: NetworkInterface, ifaceB: NetworkInterface): Link {
        if (ifaceA === ifaceB) throw new Error("cant link interface to itself");
        if (ifaceA.parentNode === ifaceB.parentNode) {
            throw new Error("cant link two interfaces on same node");
        }
        // check if either is already connected
        const alreadyLinked = this.links.find(l =>
            l.hasInterface(ifaceA) || l.hasInterface(ifaceB)
        );
        if (alreadyLinked) throw new Error("interface already connected");

        const link = new Link(ifaceA, ifaceB);
        this.links.push(link);
        return link;
    }

    removeLink(link: Link): void {
        this.links = this.links.filter(l => l.id !== link.id);
    }

    getLinksForNode(node: Node): Link[] {
        const ifaces = node.getInterfaces();
        return this.links.filter(l => ifaces.some(i => l.hasInterface(i)));
    }

    findNodeByName(name: string): Node | undefined {
        return this.nodes.find(n => n.name === name);
    }

    findNodeByIP(ip: string): Node | undefined {
        return this.nodes.find(node =>
            node.getInterfaces().some(iface => iface.ip === ip)
        );
    }

    // helper for routing config
    private getNetworkAddr(ip: string, mask: string): string {
        const ipParts = ip.split(".").map(Number);
        const maskParts = mask.split(".").map(Number);
        return ipParts.map((p, i) => p & (maskParts[i] ?? 0)).join(".");
    }

    /**
     * auto configure routes on all routers
     * uses distance-vector style algorithm
     */
    autoConfigureRoutes(): void {
        const routers = this.nodes.filter(n => n.type === NodeType.ROUTER) as Router[];
        if (routers.length === 0) return;

        // clear old routes
        routers.forEach(r => r.clearRoutes());

        // add directly connected networks
        for (const router of routers) {
            for (const iface of router.getInterfaces()) {
                const network = this.getNetworkAddr(iface.ip, iface.mask);
                try {
                    router.addRoute(network, iface.mask, iface);
                } catch (e) { /* route exists */ }
            }
        }

        // build adjacency - which routers connect to which
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

        // propagate routes (like RIP)
        const maxIter = routers.length + 1;
        for (let i = 0; i < maxIter; i++) {
            let changed = false;
            for (const router of routers) {
                const myNeighbors = neighbors.get(router.id) || [];
                for (const { router: neighbor, viaIface } of myNeighbors) {
                    for (const route of neighbor.getRoutes()) {
                        if (route.isDefault) continue;
                        // skip if directly connected
                        const isDirect = router.getInterfaces().some(iface => {
                            const net = this.getNetworkAddr(iface.ip, iface.mask);
                            return net === route.destination && iface.mask === route.mask;
                        });
                        if (isDirect) continue;
                        // add if we dont have it
                        const exists = router.getRoutes().some(r =>
                            r.destination === route.destination && r.mask === route.mask
                        );
                        if (!exists) {
                            try {
                                router.addRoute(route.destination, route.mask, viaIface);
                                changed = true;
                            } catch (e) { /* exists */ }
                        }
                    }
                }
            }
            if (!changed) break;
        }

        // add default route for edge routers (1 neighbor)
        for (const router of routers) {
            const myNeighbors = neighbors.get(router.id) || [];
            if (myNeighbors.length === 1) {
                const hasDefault = router.getRoutes().some(r => r.isDefault);
                if (!hasDefault) {
                    try {
                        router.addRoute("0.0.0.0", "0.0.0.0", myNeighbors[0]!.viaIface);
                    } catch (e) { /* exists */ }
                }
            }
        }

        console.log("--- routes configured ---");
    }
}