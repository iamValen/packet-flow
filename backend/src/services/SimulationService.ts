import { prisma } from "../prisma.js";
import { AppError } from "../middleware/errorHandler.js";
import { buildFromDB, type BuildResult } from "../controllers/SimulationBuilder.js";
import { Protocol } from "../models/Packet.js";
import { Host } from "../models/Host.js";
import type { Node } from "../models/Node.js";
import type { Simulator } from "../models/Simulator.js";
import { StatusCodes } from "http-status-codes";

// active simulation in memory
type SimRuntime = {
    simulator: Simulator;
    nodeMap: Map<string, Node>;
    running: boolean;
    lastUsed: number;
};

/**
 * manages simulation lifecycle:
 * - creating/loading simulations into memory
 * - sending packets and stepping simulation
 * - tracking packet states for frontend
 * - cleanup of idle simulations
 */
class SimulationService {
    private active = new Map<string, SimRuntime>();
    private readonly TIMEOUT = 30 * 60 * 1000;  // 30 min

    constructor() {
        // cleanup old sims every 5 min
        setInterval(() => this.cleanup(), 5 * 60 * 1000);
    }

    private cleanup() {
        const now = Date.now();
        for (const [id, sim] of this.active) {
            if (!sim.running && now - sim.lastUsed > this.TIMEOUT) {
                this.active.delete(id);
                console.log(`cleaned up sim ${id}`);
            }
        }
    }

    private touch(id: string) {
        const sim = this.active.get(id);
        if (sim) sim.lastUsed = Date.now();
    }

    async getAll(topologyId: string) {
        const topo = await prisma.topology.findUnique({ where: { id: topologyId } });
        if (!topo) throw new AppError(StatusCodes.NOT_FOUND, "topology not found");

        const sims = await prisma.simulationSession.findMany({
            where: { topologyId },
            orderBy: { createdAt: "desc" }
        });

        return sims.map(s => ({
            ...s,
            isActive: this.active.has(s.id)
        }));
    }

    async create(topologyId: string, name?: string, autoPopulateARP?: boolean) {
        const topo = await prisma.topology.findUnique({ where: { id: topologyId } });
        if (!topo) throw new AppError(StatusCodes.NOT_FOUND, "topology not found");

        // save to db
        const sim = await prisma.simulationSession.create({
            data: {
                name: name || `Sim-${Date.now()}`,
                autoPopulateARP: autoPopulateARP ?? true,
                stepDelay: 1000,
                status: "IDLE",
                topologyId
            }
        });

        // build runtime
        const { simulator, nodeMap } = await buildFromDB(topologyId, autoPopulateARP ?? true);

        this.active.set(sim.id, {
            simulator,
            nodeMap,
            running: false,
            lastUsed: Date.now()
        });

        return {
            simulation: sim,
            info: { nodes: nodeMap.size }
        };
    }

    async getById(topologyId: string, simId: string) {
        const sim = await prisma.simulationSession.findUnique({ where: { id: simId } });
        if (!sim || sim.topologyId !== topologyId) throw new AppError(StatusCodes.NOT_FOUND, "sim not found");

        this.touch(simId);

        const runtime = this.active.get(simId);
        return {
            ...sim,
            isActive: !!runtime,
            packetsInFlight: runtime?.simulator.getPacketsInFlight().length || 0
        };
    }

    // loads a simulation into memory
    async load(topologyId: string, simId: string, autoARP = true) {
        const sim = await prisma.simulationSession.findUnique({ where: { id: simId } });
        if (!sim || sim.topologyId !== topologyId) throw new AppError(StatusCodes.NOT_FOUND, "sim not found");

        if (this.active.has(simId)) throw new AppError(StatusCodes.CONFLICT, "already loaded");

        const { simulator, nodeMap } = await buildFromDB(topologyId, autoARP);

        this.active.set(simId, {
            simulator,
            nodeMap,
            running: false,
            lastUsed: Date.now()
        });

        return { loaded: true, nodes: nodeMap.size };
    }

    async sendPacket(simId: string, sourceNodeId: string, dstIp: string, protocol: Protocol, payload?: string) {
        const runtime = this.active.get(simId);
        if (!runtime) throw new AppError(StatusCodes.NOT_FOUND, "sim not loaded");

        this.touch(simId);

        const source = runtime.nodeMap.get(sourceNodeId);
        if (!source || !(source instanceof Host)) {
            throw new AppError(StatusCodes.BAD_REQUEST, "source must be a host");
        }

        // validate protocol (only ICMP and UDP for user-initiated packets)
        if (protocol !== Protocol.ICMP && protocol !== Protocol.UDP) {
            throw new AppError(StatusCodes.BAD_REQUEST, "protocol must be ICMP or UDP");
        }

        const pkt = runtime.simulator.sendPacket(source, dstIp, protocol as Protocol, payload);

        return {
            packet: {
                id: pkt.id,
                srcIp: pkt.srcIp,
                dstIp: pkt.dstIp,
                protocol: pkt.protocol,
                ttl: pkt.ttl,
                history: pkt.history.map((n: Node) => n.name)
            },
            packetsInFlight: runtime.simulator.getPacketsInFlight().length
        };
    }

    async step(simId: string) {
        const runtime = this.active.get(simId);
        if (!runtime) throw new AppError(StatusCodes.NOT_FOUND, "sim not loaded");

        this.touch(simId);

        // run a step and get delivery info
        const stepResult = runtime.simulator.step();
        const packets = runtime.simulator.getPacketsInFlight();

        // format delivered packets
        const delivered = stepResult.deliveredThisStep.map(d => ({
            packetId: d.packet.id,
            protocol: d.packet.protocol,
            srcIp: d.packet.srcIp,
            dstIp: d.packet.dstIp,
            deliveredTo: d.node.name
        }));

        return {
            packetsInFlight: packets.length,
            delivered,
            packets: packets.map((p: any) => ({
                id: p.packet.id,
                currentNode: p.currentNode.name,
                srcIp: p.packet.srcIp,
                dstIp: p.packet.dstIp,
                protocol: p.packet.protocol,
                ttl: p.packet.ttl,
                history: p.packet.history.map((n: any) => n.name)
            }))
        };
    }
    
    async run(simId: string, delay?: number, maxSteps?: number) {
        const runtime = this.active.get(simId);
        if (!runtime) throw new AppError(StatusCodes.NOT_FOUND, "sim not loaded");
        if (runtime.running) throw new AppError(StatusCodes.CONFLICT, "already running");

        const stepDelay = delay ?? 100;
        const max = maxSteps ?? 100;

        runtime.running = true;
        this.touch(simId);
        await prisma.simulationSession.update({ where: { id: simId }, data: { status: "RUNNING" } });

        let steps = 0;
        const start = Date.now();

        try {
            while (runtime.simulator.getPacketsInFlight().length > 0 && steps < max && runtime.running) {
                runtime.simulator.step();
                steps++;
                this.touch(simId);
                await new Promise(r => setTimeout(r, stepDelay));
            }

            await prisma.simulationSession.update({ where: { id: simId }, data: { status: "COMPLETED" } });

            return {
                steps,
                duration: Date.now() - start,
                remaining: runtime.simulator.getPacketsInFlight().length
            };
        } finally {
            runtime.running = false;
        }
    }
    
    async stop(simId: string) {
        const runtime = this.active.get(simId);
        if (!runtime) throw new AppError(StatusCodes.NOT_FOUND, "sim not loaded");

        runtime.running = false;
        await prisma.simulationSession.update({ where: { id: simId }, data: { status: "IDLE" } });
    }

    // deletes from memory
    async unload(simId: string) {
        const runtime = this.active.get(simId);
        if (!runtime) throw new AppError(StatusCodes.NOT_FOUND, "sim not loaded");

        runtime.running = false;
        this.active.delete(simId);
    }

    async delete(topologyId: string, simId: string) {
        const sim = await prisma.simulationSession.findUnique({ where: { id: simId } });
        if (!sim || sim.topologyId !== topologyId) throw new AppError(StatusCodes.NOT_FOUND, "sim not found");

        // clean up runtime
        const runtime = this.active.get(simId);
        if (runtime) {
            runtime.running = false;
            this.active.delete(simId);
        }

        await prisma.simulationSession.delete({ where: { id: simId } });
        return { id: sim.id, name: sim.name };
    }
}

export default new SimulationService();