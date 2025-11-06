import { Node, NodeType } from './Node.js';
import { NetworkInterface } from './NetworkInterface.js';
import { Packet } from './Packet.js';


/**
 * Represents a single route entry in a router's routing table
 */
export type RouteEntry = {
    destination: string;
    mask: string;
    cidr: number;
    nextHopInterface: NetworkInterface; // interface to forward to
    isDefault: boolean;   // true if this is the default route (0.0.0.0/0)
}

/**
 * Represents a Router node capable of forwarding packets based on a routing table
 * A Router extends the {@link Node} class and manages multiple network interfaces
 */
export class Router extends Node {
    readonly type: NodeType = NodeType.ROUTER;
    routingTable: RouteEntry[];

    /**
     * Create a new Router instance
     * @param name - Name of the router
     * @param position - Coordinates of the router in a visualization or simulation environment
     * @param interfaces - Optional list of pre-attached network interfaces
     */
    constructor(name: string, position: { x: number; y: number }, interfaces: NetworkInterface[] = []) {
        super(name, position, interfaces);
        this.routingTable = [];
    }
    
    override canForwardPacket(): boolean { return true; }
    override getInterfaces(): NetworkInterface[] { return this.interfaces; }

    /**
     * Add a route to the Router
     * A route tells a router to send packets based on their destination IP address
     * @param destination - the destination network address (the prefix) that this route applies to
     * @param mask - the mask of the network interface
     * @param nextHopInterface 
     */
    addRoute(destination: string, mask: string, nextHopInterface: NetworkInterface): void {
        if (!NetworkInterface.isValidIP(destination) || !NetworkInterface.isValidSubnetMask(mask))
            throw new Error(`Invalid network or mask: ${destination}/${mask}`);
        if (!this.interfaces.includes(nextHopInterface))
            throw new Error(`Next-hop interface does not belong to router ${this.name}`);

        if (this.routingTable.some(r => r.destination === destination && r.mask === mask))
            throw new Error(`Route ${destination}/${mask} already exists`);

        const cidr = NetworkInterface.maskToCidr(mask);
        const route: RouteEntry = {
            destination: destination,
            mask,
            cidr,
            nextHopInterface,
            isDefault: destination === '0.0.0.0' && mask === '0.0.0.0'
        };

        if (this.routingTable.some(r => r.destination === destination && r.mask === mask))
            throw new Error(`Route ${destination}/${mask} already exists`);

        this.routingTable.push(route);
        // Sort by CIDR (longest prefix first for proper matching)
        this.routingTable.sort((a, b) => b.cidr - a.cidr);
    }

    /**
     * Sets the default route that is the rule a router uses when it doesn’t know any better
     * @param gatewayInterface - Assigns the default route to this network interface
     */
    setDefaultRoute(gatewayInterface: NetworkInterface): void {
        this.addRoute('0.0.0.0', '0.0.0.0', gatewayInterface);
    }

    /**
     * Searches the routing table to decide which interface a packet should go out of, based on its destination IP
     * @param dstIp - Destination IPv4 that will lead to the Network Interface 
     * @returns the Network Interface for the Destination IP or null if there's no route for that IP
     */
    lookupRoute(dstIp: string): NetworkInterface | null {
        for (const route of this.routingTable) {
            if (this.ipMatchesRoute(dstIp, route.destination, route.mask))
                return route.nextHopInterface;
        }
        return null;
    }

    /**
     * This method checks if a given IP address belongs to a given network
     * @param ip - Destination IP address of the packet trying to route
     * @param network - Network prefix of a route entry (the subnet address)
     * @param mask - The subnet mask for that route
     * @returns 
     */
    private ipMatchesRoute(ip: string, network: string, mask: string): boolean {
        const ipParts: number[] = ip.split('.').map(Number);
        const netParts: number[] = network.split('.').map(Number);
        const maskParts: number[] = mask.split('.').map(Number);

        for (let i = 0; i < 4; i++) {
            if ((ipParts[i]! & maskParts[i]!) !== (netParts[i]! & maskParts[i]!))
                return false;
        }
        return true;
    }

    /** 
     * Router packet forwarding:
     *      - check if the packet is still valid (TTL not expired)
     *      - record that it passed through this router
     *      - look up the best route for the destination IP
     *      - decide which interface to send it out of
     *      - return that interface so the packet can be delivered to the next node
     */
    override forwardPacket(packet: Packet, incomingInterface?: NetworkInterface): NetworkInterface[] {
        packet.decrementTTL();
        if (packet.isExpired()) return [];

        packet.logHop(this);

        const outInterface = this.lookupRoute(packet.dstIp);
        
        if (!outInterface) {
            console.log(`Router ${this.name}: No route to ${packet.dstIp}, dropping packet ${packet.id}`);
            return [];
        }

        return [outInterface]; // Return single interface in array
    }   
}