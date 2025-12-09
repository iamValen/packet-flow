import { PrismaClient } from "@prisma/client";
import { Topology } from "../models/Topology.js";
import { Host } from "../models/Host.js";
import { Router } from "../models/Router.js";
import { Switch } from "../models/Switch.js";
import { NetworkInterface } from "../models/NetworkInterface.js";
import { Protocol } from "../models/Packet.js";
import type { Node } from "../models/Node.js";

const prisma = new PrismaClient();

export type SimulationBuildResult = {
    topology: Topology;
    nodeMap: Map<string, Node>;
    interfaceMap: Map<string, NetworkInterface>;
};

export class SimulationBuilder {
    /**
     * Build a simulation topology from database
     * 
     * @param topologyId - Database topology ID
     * @param autoPopulateARP - Pre-fill ARP caches for simplified simulation
     * @param autoConfigureRoutes - Auto-configure routes on all routers (recommended)
     */
    static async buildFromDatabase(
        topologyId: string,
        autoPopulateARP: boolean = false,
        autoConfigureRoutes: boolean = true  // NEW: default to true
    ): Promise<SimulationBuildResult> {
        const dbTopology = await prisma.topology.findUnique({
            where: { id: topologyId },
            include: {
                nodes: {
                    include: {
                        interfaces: true,
                        firewallRules: { orderBy: { priority: 'asc' } },
                        routingEntries: { include: { nextHopInterface: true } }
                    }
                },
                links: { include: { interfaceA: true, interfaceB: true } }
            }
        });

        if (!dbTopology) {
            throw new Error(`Topology with ID ${topologyId} not found`);
        }

        const topology: Topology = new Topology(dbTopology.name);
        const nodeMap = new Map<string, Node>();
        const interfaceMap = new Map<string, NetworkInterface>();

        // Create nodes and interfaces
        for (const dbNode of dbTopology.nodes) {
            const interfaces: NetworkInterface[] = [];

            for (const dbInterface of dbNode.interfaces) {
                const ni = new NetworkInterface(
                    dbInterface.ip,
                    dbInterface.mask,
                    dbInterface.mac
                );
                interfaces.push(ni);
                interfaceMap.set(dbInterface.id, ni);
            }

            let node: Node;
            const position: { x: number; y: number } = { x: dbNode.positionX, y: dbNode.positionY };

            switch (dbNode.type) {
                case "HOST":
                    node = new Host(dbNode.name, position, interfaces);
                    if (dbNode.defaultGateway) {
                        (node as Host).setDefaultGateway(dbNode.defaultGateway);
                    }
                    break;
                case "ROUTER":
                    node = new Router(dbNode.name, position, interfaces);
                    break;
                case "SWITCH":
                    node = new Switch(dbNode.name, position, interfaces);
                    break;
                default:
                    throw new Error(`Unknown node type: ${dbNode.type}`);
            }

            topology.addNode(node);
            nodeMap.set(dbNode.id, node);

            // Load manually configured routes and firewall rules for routers
            // (These will be used if autoConfigureRoutes is false)
            if (node instanceof Router && !autoConfigureRoutes) {
                for (const route of dbNode.routingEntries) {
                    const nextHopInterface = interfaceMap.get(route.nextHopInterfaceId);
                    if (nextHopInterface) {
                        try {
                            node.addRoute(route.destination, route.mask, nextHopInterface);
                        } catch (e) {
                            // Route might already exist
                        }
                    }
                }
            }

            // Always load firewall rules
            if (node instanceof Router) {
                for (const rule of dbNode.firewallRules) {
                    node.addRule(
                        rule.srcIp,
                        rule.dstIp,
                        rule.protocol as Protocol | null,
                        rule.action as "ALLOW" | "DROP",
                        rule.priority
                    );
                }
            }
        }

        // Create all links
        for (const dbLink of dbTopology.links) {
            const interfaceA: NetworkInterface | undefined = interfaceMap.get(dbLink.interfaceAId);
            const interfaceB: NetworkInterface | undefined = interfaceMap.get(dbLink.interfaceBId);

            if (interfaceA && interfaceB) {
                topology.addLink(interfaceA, interfaceB);
            }
        }

        // Auto-configure routes for all routers (like a real network with dynamic routing)
        if (autoConfigureRoutes) {
            console.log("=== Auto-configuring routes for all routers ===");
            topology.autoConfigureAllRoutes();
        }

        // Pre-fill ARP caches if requested
        if (autoPopulateARP) {
            console.log("=== Pre-populating ARP caches ===");
            topology.fillARP();
        }

        return { topology, nodeMap, interfaceMap };
    }
}