export const NodeType = {
    ROUTER: "ROUTER",
    HOST: "HOST",
    SWITCH: "SWITCH",
} as const;
export type NodeType = (typeof NodeType)[keyof typeof NodeType];


export type Protocol = "ICMP" | "UDP" | "ARP";

export interface NetworkInterface {
    id: string;
    ip: string;
    mask: string;
    cidr: number;
    mac: string;
    nodeId: string;
}

export interface NetworkNode {
    id: string;
    name: string;
    type: NodeType;
    positionX: number;
    positionY: number;
    defaultGateway: string | null;
    interfaces: NetworkInterface[];
}

export interface Link {
    id: string;
    interfaceAId: string;
    interfaceBId: string;
    nodeAId: string;
    nodeBId: string;
}

export interface Topology {
    id: string;
    name: string;
    nodes: NetworkNode[];
    links: Link[];
}

// packet state from backend simulation step
export interface PacketState {
    id: string;
    srcIp: string;
    dstIp: string;
    protocol: Protocol;
    ttl: number;
    currentNode: string;
    history: string[];
}

// delivered packet info from backend
export interface DeliveredPacket {
    packetId: string;
    protocol: Protocol;
    srcIp: string;
    dstIp: string;
    deliveredTo: string;
}

// simulation step response
export interface SimStepResponse {
    success: boolean;
    packetsInFlight: number;
    packets: PacketState[];
    delivered: DeliveredPacket[];
    error?: string;
}