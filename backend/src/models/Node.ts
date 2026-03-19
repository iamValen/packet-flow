import { NetworkInterface } from "./NetworkInterface.js";
import type { Packet } from "./Packet.js";

export const NodeType = {
    ROUTER: "ROUTER",
    HOST: "HOST",
    SWITCH: "SWITCH",
} as const;

export type NodeType = (typeof NodeType)[keyof typeof NodeType];

/**
 * Abstract base class for all network devices (routers, hosts, switches).
 * Subclasses implement forwarding behaviour via `forward()`.
 */
export abstract class Node {
    readonly id: string;
    name: string;
    abstract readonly type: NodeType;
    interfaces: NetworkInterface[];
    position: { x: number; y: number };

    constructor(name: string, position: { x: number; y: number }, interfaces: NetworkInterface[] = []) {
        this.id = crypto.randomUUID();
        this.name = name;
        this.interfaces = interfaces;
        this.position = position;

        for (const iface of this.interfaces)
            iface.setParentNode(this);
    }

    abstract getInterfaces(): NetworkInterface[];
    abstract canForward(): boolean;
    abstract forward(packet: Packet, incomingIface?: NetworkInterface): NetworkInterface[];
}