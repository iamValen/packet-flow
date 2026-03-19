import { NetworkInterface } from "./NetworkInterface.js";

/**
 * Represents a physical connection between two network interfaces.
 * Analogous to a cable between two NICs.
 */
export class Link {
    readonly id: string;
    readonly ifaceA: NetworkInterface;
    readonly ifaceB: NetworkInterface;

    constructor(ifaceA: NetworkInterface, ifaceB: NetworkInterface) {
        this.id = crypto.randomUUID();
        this.ifaceA = ifaceA;
        this.ifaceB = ifaceB;
    }

    /** Returns true if this link involves the given interface. */
    hasInterface(iface: NetworkInterface): boolean {
        return this.ifaceA.id === iface.id || this.ifaceB.id === iface.id;
    }

    /**
     * Returns the interface at the other end of the link.
     * @returns the opposite interface, or null if the given interface is not on this link
     */
    getOtherEnd(iface: NetworkInterface): NetworkInterface | null {
        if (iface.id === this.ifaceA.id) return this.ifaceB;
        if (iface.id === this.ifaceB.id) return this.ifaceA;
        return null;
    }
}