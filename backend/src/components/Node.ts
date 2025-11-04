import {NetworkInterface} from "./NetworkInterface.js"
import { Packet } from "./Packet.js"

/**
 * Enum for the different types of Nodes
 */
export const NodeType = {
    ROUTER: "ROUTER",
    HOST: "HOST",
    FIREWALL: "FIREWALL",
    SWITCH: "SWITCH",
} as const

export type NodeType = (typeof NodeType) [keyof typeof NodeType]   


/**
 * Abstract class of a network node that is a device that is in the network
 */
export abstract class Node {
    readonly id: string;
    name: string;
    abstract readonly type: NodeType;
    position: { x: number; y: number };

    /**
     * 
     * @param name 
     * @param position 
     */
    constructor(name: string, position: {x: number, y: number}){
        this.id = crypto.randomUUID();
        this.name = name;
        this.position = position;
    }

    /**
     * Returns all the interfaces of a node - used in Topology to remove and get Nodes Interfaces
     */
    abstract getInterfaces(): NetworkInterface[];

    /**
    * Each node type implements its own packet forwarding logic
    */
    abstract canForwardPacket(): boolean;

    /**
     * Forward a packet through this node (Router, Switch or Firewall)
     * @param packet - Packet with the {@link Packet} structure
     */
    abstract forwardPacket?(packet: Packet): void;

    /**
     * Serialize to JSON
     */
    toJSON() {
        return {
            id: this.id,
            name: this.name,
            type: this.type,
            position: this.position
        };
    }
}