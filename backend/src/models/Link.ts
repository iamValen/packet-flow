import { NetworkInterface } from "./NetworkInterface.js";

/**
 * connection between two interfaces
 * like a cable between two NICs
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

    // check if link has this interface
    hasInterface(iface: NetworkInterface): boolean {
        return this.ifaceA.id === iface.id || this.ifaceB.id === iface.id;
    }

    // given one interface, get the other end of the link
    getOtherEnd(iface: NetworkInterface): NetworkInterface | null {
        if (iface.id === this.ifaceA.id) return this.ifaceB;
        if (iface.id === this.ifaceB.id) return this.ifaceA;
        return null;
    }
}