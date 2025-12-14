import { X, Settings, Send } from "lucide-react";
import { NodeType, type NetworkNode } from "../types";

interface Props {
    node: NetworkNode;
    onClose: () => void;
    onEdit: () => void;
    onSendPacket: () => void;
}

export default function ActionPanel({ node, onClose, onEdit, onSendPacket }: Props) {
    // only hosts can originate packets - routers and switches just forward
    const canSend = node.type === NodeType.HOST;

    return (
        <div className="action-panel">
            <div className="action-panel-header">
                <span>{node.name}</span>
                <button className="btn-icon" onClick={onClose}><X size={16} /></button>
            </div>

            <div className="action-panel-info">
                <span className="meta">{node.type}</span>
                {node.interfaces[0] && <span className="meta">{node.interfaces[0].ip}</span>}
            </div>

            <div className="action-panel-buttons">
                <button className="btn" onClick={onEdit}><Settings size={16} /> Edit</button>
                {canSend && (
                    <button className="btn btn-primary" onClick={onSendPacket}>
                        <Send size={16} /> Send Packet
                    </button>
                )}
            </div>
        </div>
    );
}