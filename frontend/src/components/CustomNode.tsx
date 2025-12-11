import { memo } from "react";
import { Handle, Position } from "reactflow";
import { Monitor, Router, Network } from "lucide-react";
import type { NodeType } from "../types";

const icons = { HOST: Monitor, ROUTER: Router, SWITCH: Network };
export const nodeColors = {
    HOST: "rgba(105, 150, 240, 1)",
    ROUTER: "rgba(168, 96, 255, 1)",
    SWITCH: "rgba(255, 162, 0, 1)",
} as const;


interface Props {
    data: {
        name: string;
        type: NodeType;
        ip?: string;
        selected?: boolean;
    };
    selected: boolean;
}

function CustomNode({ data, selected }: Props) {
    const Icon = icons[data.type];
    const color = nodeColors[data.type];
    const isActive = selected || data.selected;

    const handleStyle = { background: "transparent", border: "none", width: 1, height: 1 };

    return (
        <div
            className="custom-node"
            style={{
                borderColor: isActive ? color : "#444",
                boxShadow: isActive ? `0 0 0 1px ${color}` : "none",
                color: isActive ? color : "#fff"
            }}
        >
            <Handle type="target" position={Position.Top} style={handleStyle} />
            <div className="node-icon" style={{ borderColor: color, color }}>
                <Icon size={18} />
            </div>
            <div className="node-label">{data.name}</div>
            <div className="node-type">{data.type}</div>
            {data.ip && <div className="node-ip">{data.ip}</div>}
            <Handle type="source" position={Position.Bottom} style={handleStyle} />
        </div>
    );
}

export default memo(CustomNode);