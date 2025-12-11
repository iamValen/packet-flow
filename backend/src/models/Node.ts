import { NetworkInterface } from "./NetworkInterface.js";
import type { Packet } from "./Packet.js";

export const NodeType = {
    ROUTER: "ROUTER",
    HOST: "HOST",
    SWITCH: "SWITCH",
} as const;

export type NodeType = (typeof NodeType)[keyof typeof NodeType];

/**
 * base class for all network devices
 * routers, hosts, and switches extend this
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

        // link interfaces back to this node
        for (const iface of this.interfaces) {
            iface.setParentNode(this);
        }
    }

    abstract getInterfaces(): NetworkInterface[];
    abstract canForward(): boolean;
    abstract forward(packet: Packet, incomingIface?: NetworkInterface): NetworkInterface[];
}