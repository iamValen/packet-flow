import { StatusCodes } from "http-status-codes";
import { prisma } from "../prisma.js";
import { AppError } from "../middleware/errorHandler.js";
import { buildFromDB } from "../middleware/SimulationBuilder.js";
import { Protocol } from "../models/Packet.js";
import { Host } from "../models/Host.js";
import type { Node } from "../models/Node.js";
import type { Simulator } from "../models/Simulator.js";

/** An active simulation session held in memory. */
type SimRuntime = {
    simulator: Simulator;
    nodeMap: Map<string, Node>;
    running: boolean;
    lastUsed: number;
};

/**
 * Manages the full simulation lifecycle:
 * - Creating and loading simulations into memory
 * - Sending packets and stepping the simulation forward
 * - Tracking packet state for the frontend
 * - Cleaning up idle sessions
 */
class SimulationService {
    private active = new Map<string, SimRuntime>();
    private readonly TIMEOUT = 30 * 60 * 1000;  // 30 min

    constructor() {
        // clean up idle sessions every 5 minutes
        setInterval(() => this.cleanup(), 5 * 60 * 1000);
    }

    /** Removes sessions that have been idle longer than TIMEOUT. */
    private cleanup() {
        const now = Date.now();
        for (const [id, sim] of this.active) {
            if (!sim.running && now - sim.lastUsed > this.TIMEOUT) {
                this.active.delete(id);
                console.log(`cleaned up sim ${id}`);
            }
        }
    }

    /** Updates the last-used timestamp for a session. */
    private touch(id: string) {
        const sim = this.active.get(id);
        if (sim) sim.lastUsed = Date.now();
    }

    /**
     * Returns all simulation sessions for a topology, annotated with their in-memory status.
     * @throws if the topology is not found
     */
    async getAll(topologyId: string) {
        const topo = await prisma.topology.findUnique({ where: { id: topologyId } });
        if (!topo) throw new AppError(StatusCodes.NOT_FOUND, "topology not found");

        const sims = await prisma.simulationSession.findMany({
            where: { topologyId },
            orderBy: { createdAt: "desc" }
        });

        return sims.map(s => ({ ...s, isActive: this.active.has(s.id) }));
    }

    /**
     * Creates a new simulation session, persists it to the database,
     * and loads the topology into memory for packet processing.
     * @param topologyId - ID of the topology to simulate
     * @param name - optional session name
     * @param autoPopulateARP - if true, pre-fills ARP caches
     * @throws if the topology is not found
     */
    async create(topologyId: string, name?: string, autoPopulateARP?: boolean) {
        const topo = await prisma.topology.findUnique({ where: { id: topologyId } });
        if (!topo) throw new AppError(StatusCodes.NOT_FOUND, "topology not found");

        const sim = await prisma.simulationSession.create({
            data: {
                name: name || `Sim-${Date.now()}`,
                autoPopulateARP: autoPopulateARP ?? true,
                stepDelay: 1000,
                status: "IDLE",
                topologyId
            }
        });

        const { simulator, nodeMap } = await buildFromDB(topologyId, autoPopulateARP ?? true);

        this.active.set(sim.id, { simulator, nodeMap, running: false, lastUsed: Date.now() });

        return { simulation: sim, info: { nodes: nodeMap.size } };
    }

    /**
     * Returns a simulation session by id, including whether it is currently loaded in memory.
     * @throws if the session is not found
     */
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

    /**
     * Loads an existing simulation session into memory for packet processing.
     * @throws if the session is not found or is already loaded
     */
    async load(topologyId: string, simId: string, autoARP = true) {
        const sim = await prisma.simulationSession.findUnique({ where: { id: simId } });
        if (!sim || sim.topologyId !== topologyId) throw new AppError(StatusCodes.NOT_FOUND, "sim not found");
        if (this.active.has(simId)) throw new AppError(StatusCodes.CONFLICT, "already loaded");

        const { simulator, nodeMap } = await buildFromDB(topologyId, autoARP);

        this.active.set(simId, { simulator, nodeMap, running: false, lastUsed: Date.now() });

        return { loaded: true, nodes: nodeMap.size };
    }

    /**
     * Injects a new packet into a loaded simulation from a HOST node.
     * @param simId - ID of the active simulation session
     * @param sourceNodeId - ID of the source HOST node
     * @param dstIp - destination IP address
     * @param protocol - ICMP or UDP
     * @param payload - optional packet payload
     * @throws if the session is not loaded, the source node is not a HOST, or the protocol is invalid
     */
    async sendPacket(simId: string, sourceNodeId: string, dstIp: string, protocol: Protocol, payload?: string) {
        const runtime = this.active.get(simId);
        if (!runtime) throw new AppError(StatusCodes.NOT_FOUND, "sim not loaded");

        this.touch(simId);

        const source = runtime.nodeMap.get(sourceNodeId);
        if (!source || !(source instanceof Host))
            throw new AppError(StatusCodes.BAD_REQUEST, "source must be a host");

        if (protocol !== Protocol.ICMP && protocol !== Protocol.UDP)
            throw new AppError(StatusCodes.BAD_REQUEST, "protocol must be ICMP or UDP");

        const pkt = runtime.simulator.sendPacket(source, dstIp, protocol, payload);

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

    /**
     * Advances a loaded simulation by one tick.
     * Returns the current packet positions and any packets delivered this step.
     * @throws if the session is not loaded
     */
    async step(simId: string) {
        const runtime = this.active.get(simId);
        if (!runtime) throw new AppError(StatusCodes.NOT_FOUND, "sim not loaded");

        this.touch(simId);

        const stepResult = runtime.simulator.step();
        const packets = runtime.simulator.getPacketsInFlight();

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

    /**
     * Runs a simulation continuously until all packets are delivered,
     * `maxSteps` is reached, or `stop()` is called.
     * @param simId - ID of the active simulation session
     * @param delay - milliseconds between steps (default 100)
     * @param maxSteps - step cap to prevent infinite loops (default 100)
     * @throws if the session is not loaded or is already running
     */
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

            return { steps, duration: Date.now() - start, remaining: runtime.simulator.getPacketsInFlight().length };
        } finally {
            runtime.running = false;
        }
    }

    /**
     * Stops a running simulation and sets its status back to IDLE.
     * @throws if the session is not loaded
     */
    async stop(simId: string) {
        const runtime = this.active.get(simId);
        if (!runtime) throw new AppError(StatusCodes.NOT_FOUND, "sim not loaded");

        runtime.running = false;
        await prisma.simulationSession.update({ where: { id: simId }, data: { status: "IDLE" } });
    }

    /**
     * Removes a simulation from memory while keeping the database record.
     * @throws if the session is not loaded
     */
    async unload(simId: string) {
        const runtime = this.active.get(simId);
        if (!runtime) throw new AppError(StatusCodes.NOT_FOUND, "sim not loaded");

        runtime.running = false;
        this.active.delete(simId);
    }

    /**
     * Removes a simulation from memory and deletes its database record.
     * @throws if the session is not found
     */
    async delete(topologyId: string, simId: string) {
        const sim = await prisma.simulationSession.findUnique({ where: { id: simId } });
        if (!sim || sim.topologyId !== topologyId) throw new AppError(StatusCodes.NOT_FOUND, "sim not found");

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