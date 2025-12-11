import { PrismaClient } from "@prisma/client";
import { Topology } from "../models/Topology.js";
import { Host } from "../models/Host.js";
import { Router } from "../models/Router.js";
import { Switch } from "../models/Switch.js";
import { NetworkInterface } from "../models/NetworkInterface.js";
import { Simulator } from "../models/Simulator.js";
import type { Node } from "../models/Node.js";
import { NodeType } from "../models/Node.js";

const prisma = new PrismaClient();

export type BuildResult = {
    topology: Topology;
    simulator: Simulator;
    nodeMap: Map<string, Node>;
    ifaceMap: Map<string, NetworkInterface>;
};

/**
 * builds a topology from the database for simulation
 */
export async function buildFromDB( topologyId: string, autoFillARP: boolean = false): Promise<BuildResult> {
    // grab everything from db
    const dbTopo = await prisma.topology.findUnique({
        where: { id: topologyId },
        include: {
            nodes: {
                include: {
                    interfaces: true,
                    routingEntries: { include: { nextHopInterface: true } }
                }
            },
            links: { include: { interfaceA: true, interfaceB: true } }
        }
    });

    if (!dbTopo) throw new Error(`topology ${topologyId} not found`);

    const topology = new Topology(dbTopo.name);
    const nodeMap = new Map<string, Node>();
    const ifaceMap = new Map<string, NetworkInterface>();

    // create nodes
    for (const dbNode of dbTopo.nodes) {
        const ifaces: NetworkInterface[] = [];

        for (const dbIface of dbNode.interfaces) {
            const ni = new NetworkInterface(dbIface.ip, dbIface.mask, dbIface.mac);
            ifaces.push(ni);
            ifaceMap.set(dbIface.id, ni);
        }

        let node: Node;
        const pos = { x: dbNode.positionX, y: dbNode.positionY };

        switch (dbNode.type) {
            case NodeType.HOST:
                node = new Host(dbNode.name, pos, ifaces);
                if (dbNode.defaultGateway) {
                    (node as Host).setDefaultGateway(dbNode.defaultGateway);
                }
                break;
            case NodeType.ROUTER:
                node = new Router(dbNode.name, pos, ifaces);
                break;
            case NodeType.SWITCH:
                node = new Switch(dbNode.name, pos, ifaces);
                break;
            default:
                throw new Error(`unknown type: ${dbNode.type}`);
        }

        topology.addNode(node);
        nodeMap.set(dbNode.id, node);
    }

    // create links
    for (const dbLink of dbTopo.links) {
        const ifaceA = ifaceMap.get(dbLink.interfaceAId);
        const ifaceB = ifaceMap.get(dbLink.interfaceBId);
        if (ifaceA && ifaceB) {
            topology.addLink(ifaceA, ifaceB);
        }
    }

    // auto configure routes
    console.log("=== configuring routes ===");
    topology.autoConfigureRoutes();

    // create simulator
    const simulator = new Simulator(topology);

    // fill arp if requested
    if (autoFillARP) {
        console.log("=== filling arp caches ===");
        simulator.fillARP();
    }

    return { topology, simulator, nodeMap, ifaceMap };
}