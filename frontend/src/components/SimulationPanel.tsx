/**
 * SimulationPanel.tsx
 * 
 * Handles packet simulation lifecycle:
 * - Creating/loading simulations
 * - Sending packets and running steps
 * - Logging all packet movements with type distinction
 * - Tracking ARP, ICMP requests/replies, UDP
 */
import { useState, useCallback, useRef } from "react";
import { api } from "../api";
import type { NetworkNode, Protocol } from "../types";

interface LogEntry {
    time: string;
    type: "info" | "send" | "hop" | "arp" | "icmp" | "udp" | "delivered" | "error";
    message: string;
    packetId?: string;
}

interface Props {
    topologyId: string | null;
    onSimulationChange?: (running: boolean) => void;
}

const STEP_DELAY = 600;  // ms between simulation steps
const MAX_STEPS = 50;    // max steps to prevent infinite loops

export function useSimulation({ topologyId, onSimulationChange }: Props) {
    const [simId, setSimId] = useState<string | null>(null);
    const [simulating, setSimulating] = useState(false);
    const [log, setLog] = useState<LogEntry[]>([]);
    const abortRef = useRef(false);

    const addLog = useCallback((type: LogEntry["type"], message: string, packetId?: string) => {
        const time = new Date().toLocaleTimeString();
        setLog(prev => [{ time, type, message, packetId }, ...prev]);
    }, []);

    const clearLog = useCallback(() => setLog([]), []);

    // ensure simulation is created/loaded
    const ensureSimulation = useCallback(async (): Promise<string | null> => {
        if (!topologyId) return null;
        
        if (simId) return simId;
        
        try {
            const res = await api.createSim(topologyId, `Sim-${Date.now()}`);
            const newSimId = res.simulation.id;
            setSimId(newSimId);
            addLog("info", "Simulation created");
            return newSimId;
        } catch (err: any) {
            addLog("error", `Failed to create simulation: ${err.message}`);
            return null;
        }
    }, [topologyId, simId, addLog]);

    // reset simulation when topology changes
    const resetSimulation = useCallback(() => {
        setSimId(null);
        abortRef.current = true;
        setSimulating(false);
    }, []);

    // send packet and run simulation
    const sendPacket = useCallback(async (
        sourceNode: NetworkNode,
        dstIp: string,
        protocol: Protocol,
        payload?: string
    ) => {
        if (!topologyId) return;

        let sid = await ensureSimulation();
        if (!sid) return;

        abortRef.current = false;
        setSimulating(true);
        onSimulationChange?.(true);

        try {
            // for ICMP, set the proper request payload to trigger reply
            let finalPayload: string | undefined;
            if(protocol === "ICMP") {
                finalPayload = "ICMP Echo Request";
            } else {
                finalPayload = payload || undefined;
            }

            // log initial send
            const srcIp = sourceNode.interfaces[0]?.ip || "unknown";
            addLog("send", `${protocol} from ${sourceNode.name} (${srcIp}) => ${dstIp}`);

            // inject packet
            let sendRes = await api.sendPacket(topologyId, sid, sourceNode.id, dstIp, protocol, finalPayload);
            
            // if sim not loaded, create new one and retry
            if (!sendRes.success && sendRes.error?.includes("not loaded")) {
                addLog("info", "Reloading simulation...");
                setSimId(null);
                const newRes = await api.createSim(topologyId, `Sim-${Date.now()}`);
                sid = newRes.simulation.id;
                if(!sid) throw new Error("failed to recreate simulation");
                setSimId(sid);
                sendRes = await api.sendPacket(topologyId, sid, sourceNode.id, dstIp, protocol, finalPayload);
            }
            
            if (!sendRes.success) {
                addLog("error", sendRes.error || "Failed to send packet");
                setSimulating(false);
                onSimulationChange?.(false);
                return;
            }

            // track packets: id -> { lastNode, protocol, srcIp, dstIp, logged }
            const packetTracker = new Map<string, {
                lastNode: string;
                protocol: string;
                srcIp: string;
                dstIp: string;
                firstHopLogged: boolean;
            }>();

            // run simulation steps
            let stuckCount = 0;
            
            for (let step = 0; step < MAX_STEPS && !abortRef.current; step++) {
                await new Promise(r => setTimeout(r, STEP_DELAY));
                
                const res = await api.simStep(topologyId, sid);
                
                if (!res.success) {
                    addLog("error", res.error || "Step failed");
                    break;
                }

                const packets = res.packets || [];
                const delivered = res.delivered || [];
                
                // log any deliveries this step
                for (const d of delivered) {
                    const pktType = getPacketLogType(d.protocol, d.srcIp, d.dstIp);
                    addLog("delivered", `${d.protocol} delivered to ${d.deliveredTo}`, d.packetId);
                }
                
                // no packets in flight
                if (packets.length === 0) {
                    if (res.packetsInFlight === 0) {
                        // simulation complete
                        if (packetTracker.size > 0 || delivered.length > 0) {
                            addLog("info", "Simulation complete");
                        }
                        break;
                    }
                    // packets exist but not returned
                    if (++stuckCount > 5) {
                        addLog("info", "Simulation stalled");
                        break;
                    }
                    continue;
                }
                
                stuckCount = 0;

                // process each packet
                for (const pkt of packets) {
                    const tracker = packetTracker.get(pkt.id);
                    
                    if (!tracker) {
                        // new packet - track it
                        packetTracker.set(pkt.id, {
                            lastNode: pkt.currentNode,
                            protocol: pkt.protocol,
                            srcIp: pkt.srcIp,
                            dstIp: pkt.dstIp,
                            firstHopLogged: false
                        });

                        // determine packet type for logging
                        const pktType = getPacketLogType(pkt.protocol, pkt.srcIp, pkt.dstIp);
                        
                        // log first hop from history if available
                        if (pkt.history && pkt.history.length >= 1) {
                            const firstNode = pkt.history[0];
                            if (firstNode !== pkt.currentNode) {
                                addLog(pktType, `${pkt.protocol}: ${firstNode} => ${pkt.currentNode}`, pkt.id);
                                packetTracker.get(pkt.id)!.firstHopLogged = true;
                            } else {
                                // packet still at first node
                                addLog(pktType, `${pkt.protocol}: at ${pkt.currentNode}`, pkt.id);
                                packetTracker.get(pkt.id)!.firstHopLogged = true;
                            }
                        }
                        continue;
                    }

                    // existing packet - check if moved
                    if (tracker.lastNode !== pkt.currentNode) {
                        const pktType = getPacketLogType(pkt.protocol, pkt.srcIp, pkt.dstIp);
                        addLog(pktType, `${pkt.protocol}: ${tracker.lastNode} => ${pkt.currentNode}`, pkt.id);
                        tracker.lastNode = pkt.currentNode;
                    }
                }

                // check if done
                if (res.packetsInFlight === 0) {
                    break;
                }
            }

        } catch (err: any) {
            addLog("error", `Error: ${err.message || "unknown"}`);
        } finally {
            setSimulating(false);
            onSimulationChange?.(false);
        }
    }, [topologyId, ensureSimulation, addLog, onSimulationChange]);

    const stopSimulation = useCallback(() => {
        abortRef.current = true;
        setSimulating(false);
        onSimulationChange?.(false);
        addLog("info", "Simulation stopped");
    }, [addLog, onSimulationChange]);

    return {
        simulating,
        log,
        sendPacket,
        stopSimulation,
        clearLog,
        resetSimulation
    };
}

// helper to determine log type based on protocol
function getPacketLogType(protocol: string, srcIp: string, dstIp: string): LogEntry["type"] {
    switch (protocol) {
        case "ARP": return "arp";
        case "ICMP": return "icmp";
        case "UDP": return "udp";
        default: return "hop";
    }
}

// log panel component
interface LogPanelProps {
    log: LogEntry[];
    onClear: () => void;
}

export function LogPanel({ log, onClear }: LogPanelProps) {
    if (log.length === 0) return null;

    const getLogColor = (type: LogEntry["type"]): string => {
        switch (type) {
            case "send": return "var(--accent)";
            case "arp": return "#ffa500";  // orange
            case "icmp": return "#0f0";    // green
            case "udp": return "#87ceeb";  // light blue
            case "delivered": return "#0f0";
            case "error": return "var(--red)";
            default: return "var(--dim)";
        }
    };

    const getLogPrefix = (type: LogEntry["type"]): string => {
        switch (type) {
            case "send": return "➤";
            case "arp": return "◈";
            case "icmp": return "●";
            case "udp": return "○";
            case "delivered": return "✓";
            case "error": return "X";
            case "info": return "!";
            default: return "=>";
        }
    };

    return (
        <div className="log-panel">
            <div className="log-header">
                <span>Packet Log</span>
                <button onClick={onClear}>×</button>
            </div>
            <div className="log-content">
                {log.map((entry, i) => (
                    <div 
                        key={i} 
                        className="log-entry"
                        style={{ color: getLogColor(entry.type) }}
                    >
                        <span className="log-prefix">{getLogPrefix(entry.type)}</span>
                        <span className="log-time">[{entry.time}]</span>
                        <span className="log-msg">{entry.message}</span>
                    </div>
                ))}
            </div>
        </div>
    );
}