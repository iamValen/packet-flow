import { NetworkInterface } from './NetworkInterface.js';


export type NodeType = "ROUTER" | "HOST" | "FIREWALL" | "SWITCH";

/**
 * Abstract class of a network node
 */
export abstract class Node {
    readonly id: string;
    name: string;
    abstract readonly type: NodeType;
    position: { x: number; y: number };

    constructor(name: string, position: {x: number, y: number}){
        this.id = crypto.randomUUID();
        this.name = name;
        this.position = position;
    }

    /**
     * Get all interfaces on this node
    */
   abstract getInterfaces(): NetworkInterface[];

    /**
    * Each node type implements its own packet forwarding logic
    */
    abstract canForwardPacket(): boolean;

    /**
     * Forward a packet through this node (Router, Switch or Firewall)
     */
    abstract forwardPacket?(packet: any): void;

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