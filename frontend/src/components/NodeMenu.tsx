// menu for creating/editing nodes
import { useState, useEffect } from "react";
import { X, Plus, Trash2 } from "lucide-react";
import { NodeType, type NetworkNode } from "../types";

interface Props {
    isOpen: boolean;
    nodeType: NodeType;
    existingNode?: NetworkNode | null;
    onClose: () => void;
    onSubmit: (data: { name: string; gateway?: string; interfaces: { ip: string; cidr: string }[] }) => void;
    onDelete?: () => void;
}

export default function NodeMenu({ isOpen, nodeType, existingNode, onClose, onSubmit, onDelete }: Props) {
    const [name, setName] = useState("");
    const [gateway, setGateway] = useState("");
    const [interfaces, setInterfaces] = useState([{ ip: "", cidr: "24" }]);
    const [error, setError] = useState("");

    // reset when opened
    useEffect(() => {
        if (existingNode) {
            setName(existingNode.name);
            setGateway(existingNode.defaultGateway || "");
            setInterfaces(
                existingNode.interfaces.length > 0
                    ? existingNode.interfaces.map(i => ({ ip: i.ip, cidr: String(i.cidr) }))
                    : [{ ip: "", cidr: "24" }]
            );
        } else {
            setName("");
            setGateway("");
            setInterfaces([{ ip: "", cidr: "24" }]);
        }
        setError("");
    }, [existingNode, isOpen]);

    if (!isOpen) return null;

    const handleSubmit = () => {
        if (!name.trim()) { setError("Name required"); return; }
        for (const iface of interfaces) {
            if (!iface.ip.trim()) { setError("IP required"); return; }
        }
        onSubmit({ name, gateway: gateway || undefined, interfaces });
    };

    return (
        <div className="menu-overlay" onClick={onClose}>
            <div className="menu" onClick={e => e.stopPropagation()}>
                <div className="menu-header">
                    <h2>{existingNode ? "Edit" : "Create"} {nodeType}</h2>
                    <button className="btn-icon" onClick={onClose}><X size={20} /></button>
                </div>

                <div className="menu-body">
                    {error && <div className="error">{error}</div>}

                    <label>Name</label>
                    <input value={name} onChange={e => setName(e.target.value)} placeholder="My Node" />

                    {nodeType === NodeType.HOST && (
                        <>
                            <label>Default Gateway</label>
                            <input value={gateway} onChange={e => setGateway(e.target.value)} placeholder="192.168.1.1" />
                        </>
                    )}

                    <label>Interfaces</label>
                    {interfaces.map((iface, i) => (
                        <div key={i} className="interface-row">
                            <input
                                value={iface.ip}
                                onChange={e => {
                                    const copy = [...interfaces];
                                    copy[i].ip = e.target.value;
                                    setInterfaces(copy);
                                }}
                                placeholder={nodeType === NodeType.SWITCH ? "0.0.0.1" : "192.168.1.10"} // switches can have non-routable IPs so they are not used internally
                            />
                            <span>/</span>
                            <input
                                className="input-small"
                                value={iface.cidr}
                                onChange={e => {
                                    const copy = [...interfaces];
                                    copy[i].cidr = e.target.value;
                                    setInterfaces(copy);
                                }}
                            />
                            {interfaces.length > 1 && (
                                <button
                                    className="btn-icon btn-danger"
                                    onClick={() => setInterfaces(interfaces.filter((_, j) => j !== i))}
                                >
                                    <Trash2 size={16} />
                                </button>
                            )}
                        </div>
                    ))}
                    <button className="btn btn-small" onClick={() => setInterfaces([...interfaces, { ip: "", cidr: "24" }])}>
                        <Plus size={14} /> Add Interface
                    </button>
                </div>

                <div className="menu-footer">
                    {existingNode && onDelete && (
                        <button className="btn btn-danger" onClick={onDelete}><Trash2 size={16} /> Delete</button>
                    )}
                    <div className="spacer" />
                    <button className="btn" onClick={onClose}>Cancel</button>
                    <button className="btn btn-primary" onClick={handleSubmit}>{existingNode ? "Save" : "Create"}</button>
                </div>
            </div>
        </div>
    );
}