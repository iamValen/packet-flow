// menu for sending packets
import { useState } from "react";
import { X, Send } from "lucide-react";
import type { NetworkNode } from "../types";

interface Props {
    isOpen: boolean;
    sourceNode: NetworkNode | null;
    allNodes: NetworkNode[];
    onClose: () => void;
    onSend: (dstIp: string, protocol: string, payload?: string) => void;
}

export default function SendPacketMenu({ isOpen, sourceNode, allNodes, onClose, onSend }: Props) {
    const [protocol, setProtocol] = useState("ICMP");
    const [dstIp, setDstIp] = useState("");
    const [payload, setPayload] = useState("");
    const [error, setError] = useState("");

    if (!isOpen || !sourceNode) return null;

    // get destination options
    const dstOptions: { ip: string; name: string }[] = [];
    for (const node of allNodes) {
        if (node.id === sourceNode.id) continue;
        for (const iface of node.interfaces) {
            dstOptions.push({ ip: iface.ip, name: node.name });
        }
    }

    const handleSend = () => {
        if (!dstIp.trim()) { setError("Destination required"); return; }
        onSend(dstIp, protocol, payload || undefined);
        setProtocol("ICMP");
        setDstIp("");
        setPayload("");
        setError("");
    };

    const handleClose = () => {
        setProtocol("ICMP");
        setDstIp("");
        setPayload("");
        setError("");
        onClose();
    };

    return (
        <div className="menu-overlay" onClick={handleClose}>
            <div className="menu" onClick={e => e.stopPropagation()}>
                <div className="menu-header">
                    <h2><Send size={18} /> Send Packet</h2>
                    <button className="btn-icon" onClick={handleClose}><X size={20} /></button>
                </div>

                <div className="menu-body">
                    {error && <div className="error">{error}</div>}

                    <div className="info-box">
                        <label>From</label>
                        <span>{sourceNode.name} ({sourceNode.interfaces[0]?.ip || "no IP"})</span>
                    </div>

                    <label>Protocol</label>
                    <div className="protocol-buttons">
                        {["ICMP", "UDP"].map(p => (
                            <button
                                key={p}
                                className={`btn btn-small ${protocol === p ? "btn-primary" : ""}`}
                                onClick={() => setProtocol(p)}
                            >
                                {p}
                            </button>
                        ))}
                    </div>

                    <label>Destination IP</label>
                    <select value={dstIp} onChange={e => setDstIp(e.target.value)}>
                        <option value="">Select...</option>
                        {dstOptions.map(({ ip, name }) => (
                            <option key={ip} value={ip}>{ip} ({name})</option>
                        ))}
                    </select>
                    <input
                        value={dstIp}
                        onChange={e => setDstIp(e.target.value)}
                        placeholder="Or type manually"
                    />

                    <label>Payload (optional)</label>
                    <input value={payload} onChange={e => setPayload(e.target.value)} placeholder="Hello" />
                </div>

                <div className="menu-footer">
                    <div className="spacer" />
                    <button className="btn" onClick={handleClose}>Cancel</button>
                    <button className="btn btn-primary" onClick={handleSend}><Send size={14} /> Send</button>
                </div>
            </div>
        </div>
    );
}