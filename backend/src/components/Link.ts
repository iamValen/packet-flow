import { NetworkInterface } from './NetworkInterface.js';

/**
 * Represents a connection between two network interfaces
 */
export class Link {
    readonly id: string;
    readonly interfaceA: NetworkInterface;
    readonly interfaceB: NetworkInterface;

    constructor(interfaceA: NetworkInterface, interfaceB: NetworkInterface) {
        this.id = crypto.randomUUID();
        this.interfaceA = interfaceA;
        this.interfaceB = interfaceB;
    }

    /**
     * Check if a given Interface makes part of the connection
     * @param intf - Interface to check
     * @returns true if intf makes part of the connection, flase if not
     */
    involvesInterface(intf: NetworkInterface): boolean {
        return this.interfaceA.id === intf.id || this.interfaceB.id === intf.id;
    }

    /**
     * Given a Network Interface that makes part of the connection it returns the interface on the other end of the link
     * @param intf 
     * @returns interfaceB if intf = interfaceA, interfaceA if intf = interfaceB, null if intf is neither
     */
    getOtherEnd(intf: NetworkInterface): NetworkInterface | null {
        if (intf.id === this.interfaceA.id) return this.interfaceB;
        if (intf.id === this.interfaceB.id) return this.interfaceA;
        return null;
    }

    /**
     * Serialize to JSON
     */
    toJSON() {
        return {
            id: this.id,
            interfaceA: this.interfaceA.id,
            interfaceB: this.interfaceB.id
        };
    }
}
