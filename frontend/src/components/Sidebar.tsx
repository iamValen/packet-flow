// sidebar - retro terminal style
import { useState } from "react";
import { Monitor, Router, Network, Plus, Link2 } from "lucide-react";
import { type Topology, NodeType } from "../types";
import { nodeColors } from "./CustomNode"

interface Props {
    topologies: Topology[];
    currentId: string | null;
    onSelect: (id: string) => void;
    onCreate: (name: string) => void;
    onDragStart: (e: React.DragEvent, type: NodeType) => void;
    onLinkMode: () => void;
}

const devices: { type: NodeType; icon: typeof Monitor; color: string }[] = [
    { type: NodeType.HOST, icon: Monitor,  color: nodeColors.HOST },
    { type: NodeType.ROUTER, icon: Router, color: nodeColors.ROUTER },
    { type: NodeType.SWITCH, icon: Network, color: nodeColors.SWITCH },
];

export default function Sidebar({ topologies, currentId, onSelect, onCreate, onDragStart, onLinkMode }: Props) {
    const [showForm, setShowForm] = useState(false);
    const [name, setName] = useState("");

    const handleCreate = () => {
        if (name.trim()) {
            onCreate(name.trim());
            setName("");
            setShowForm(false);
        }
    };

    return (
        <div className="sidebar">
            <h1 className="sidebar-title">PacketFlow</h1>

            <div className="sidebar-section">
                <h3>Topology</h3>
                <select value={currentId || ""} onChange={e => onSelect(e.target.value)}>
                    <option value="">[ select ]</option>
                    {topologies.map(t => (
                        <option key={t.id} value={t.id}>{t.name}</option>
                    ))}
                </select>

                {!showForm ? (
                    <button className="btn" onClick={() => setShowForm(true)}>
                        <Plus size={16}/> New
                    </button>) : (
                    <div className="form">
                        <input
                            placeholder="topology name"
                            value={name}
                            onChange={e => setName(e.target.value)}
                            onKeyDown={e => e.key === "Enter" && handleCreate()}
                            autoFocus
                        />
                        <div className="btn-row">
                            <button className="btn btn-primary" onClick={handleCreate}>Create</button>
                            <button className="btn" onClick={() => setShowForm(false)}>Cancel</button>
                        </div>
                    </div>
                )}
            </div>

            {currentId && (
                <div className="sidebar-section">
                    <h3>Devices</h3>
                    <p className="hint">drag to canvas</p>
                    <div className="device-list">
                        {devices.map(({ type, icon: Icon, color }) => (
                            <div
                                key={type}
                                className="device"
                                draggable
                                onDragStart={e => onDragStart(e, type)}
                                style={{ borderColor: color, color }}
                            >
                                <Icon size={18} />
                                <span>{type}</span>
                            </div>
                        ))}
                    </div>
                    <button className="btn btn-success" onClick={onLinkMode}>
                        <Link2 size={16} /> Create Link
                    </button>
                </div>
            )}
        </div>
    );
}