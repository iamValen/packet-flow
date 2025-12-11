// menu for creating links - simple wizard
import { useState } from "react";
import { X, ArrowLeft } from "lucide-react";
import type { NetworkNode, Link } from "../types";

interface Props {
    isOpen: boolean;
    nodes: NetworkNode[];
    links: Link[];
    onClose: () => void;
    onCreateLink: (ifaceA: string, ifaceB: string) => void;
}

type Step = "node1" | "iface1" | "node2" | "iface2";

export default function LinkMenu({ isOpen, nodes, links, onClose, onCreateLink }: Props) {
    const [step, setStep] = useState<Step>("node1");
    const [node1, setNode1] = useState<NetworkNode | null>(null);
    const [iface1, setIface1] = useState<string | null>(null);
    const [node2, setNode2] = useState<NetworkNode | null>(null);

    if (!isOpen) return null;

    // find used interfaces
    const usedIfaces = new Set<string>();
    links.forEach(l => { usedIfaces.add(l.interfaceAId); usedIfaces.add(l.interfaceBId); });

    const reset = () => { setStep("node1"); setNode1(null); setIface1(null); setNode2(null); };
    const handleClose = () => { reset(); onClose(); };

    const goBack = () => {
        if (step === "iface1") { setNode1(null); setStep("node1"); }
        else if (step === "node2") { setIface1(null); setStep("iface1"); }
        else if (step === "iface2") { setNode2(null); setStep("node2"); }
    };

    const selectNode = (node: NetworkNode) => {
        if (step === "node1") { setNode1(node); setStep("iface1"); }
        else if (step === "node2") { setNode2(node); setStep("iface2"); }
    };

    const selectIface = (ifaceId: string) => {
        if (step === "iface1") { setIface1(ifaceId); setStep("node2"); }
        else if (step === "iface2" && iface1) { onCreateLink(iface1, ifaceId); handleClose(); }
    };

    const titles: Record<Step, string> = {
        node1: "Select first node",
        iface1: `Select interface from ${node1?.name}`,
        node2: "Select second node",
        iface2: `Select interface from ${node2?.name}`
    };

    const showNodes = step === "node1" || step === "node2";
    const currentNode = step === "iface1" ? node1 : node2;
    const availableNodes = step === "node2" ? nodes.filter(n => n.id !== node1?.id) : nodes;

    return (
        <div className="menu-overlay" onClick={handleClose}>
            <div className="menu" onClick={e => e.stopPropagation()}>
                <div className="menu-header">
                    <h2>Create Link</h2>
                    <button className="btn-icon" onClick={handleClose}><X size={20} /></button>
                </div>

                <div className="menu-body">
                    <p className="step-title">{titles[step]}</p>

                    {showNodes && (
                        <div className="list">
                            {availableNodes.map(node => (
                                <button key={node.id} className="list-item" onClick={() => selectNode(node)}>
                                    <span>{node.name}</span>
                                    <span className="meta">{node.type} • {node.interfaces.length} iface(s)</span>
                                </button>
                            ))}
                        </div>
                    )}

                    {!showNodes && currentNode && (
                        <div className="list">
                            {currentNode.interfaces.map(iface => {
                                const used = usedIfaces.has(iface.id);
                                return (
                                    <button
                                        key={iface.id}
                                        className={`list-item ${used ? "disabled" : ""}`}
                                        onClick={() => !used && selectIface(iface.id)}
                                        disabled={used}
                                    >
                                        <span>{iface.ip}/{iface.cidr}</span>
                                        <span className="meta">{iface.mac} {used && "(connected)"}</span>
                                    </button>
                                );
                            })}
                        </div>
                    )}
                </div>

                <div className="menu-footer">
                    {step !== "node1" && (
                        <button className="btn" onClick={goBack}><ArrowLeft size={16} /> Back</button>
                    )}
                    <div className="spacer" />
                    <button className="btn" onClick={handleClose}>Cancel</button>
                </div>
            </div>
        </div>
    );
}