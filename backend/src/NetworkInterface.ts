/**
 * Represents a network interface with IP address and subnet mask.
 * Provides helpers for subnet calculations.
 */
export class NetworkInterface {
    private _ip: string;
    private _mask: string;
    private _cidr: number;

    constructor(ip: string, mask: string) {
        if (!NetworkInterface.isValidIP(ip)) throw new Error(`Invalid IP: ${ip}`);
        if (!NetworkInterface.isValidSubnetMask(mask)) throw new Error(`Invalid subnet mask: ${mask}`);
        this._ip = ip;
        this._mask = mask;
        this._cidr = NetworkInterface.maskToCidr(mask);
    }

    /**
     * Create from CIDR notation ("192.168.1.10/24")
     * @param cidrNotation 
     * @returns 
     */
    static fromCIDR(cidrNotation: string): NetworkInterface {
        const [ip, prefix] = cidrNotation.split('/');

        if(ip == undefined || prefix == undefined)
            throw new Error(`Invalid CIDR notation IP: ${cidrNotation}`);

        const cidr = parseInt(prefix, 10);
        const mask = this.cidrToMask(cidr);
        return new NetworkInterface(ip, mask);
    }

    /**
     * 
     * @returns the network address for this interface
     */
    getNetworkAddress(): string {
        const ipParts = this._ip.split('.').map(n => parseInt(n, 10));
        const maskParts = this._mask.split('.').map(n => parseInt(n, 10));
        const network = ipParts.map((part, i) => part & maskParts[i]!);
        return network.join('.');
    }

    /**
     * 
     * @returns the broadcast address for the interface
     */
    getBroadcastAddress(): string {
        const ipParts = this._ip.split('.').map(n => parseInt(n, 10));
        const maskParts = this._mask.split('.').map(n => parseInt(n, 10));
        const broadcast = ipParts.map((part, i) => part | (~maskParts[i]! & 255));
        return broadcast.join('.');
    }

    /**
     * 
     * @returns number of possible hosts (except network and broadcast)
     */
    getUsableHostCount(): number {
    }

    /**
     * 
     * @param mask ipv4 notation of mask
     * @returns Convert subnet mask to CIDR prefix length
     */
    static maskToCidr(mask: string): number {
      
    }

    /**
     * 
     * @param cidr integer
     * @returns CIDR prefix length to subnet mask
     */
    static cidrToMask(cidr: number): string {
       
    }

    /**
     * Validate if a certain IP is valid
     * @param ip e.g. "192.168.1.1"
     * @returns true if valid, false if not
     */
    static isValidIP(ip: string): boolean {
    }

    /**
     * Validate subnet mask: must be valid and contiguous 1s followed by 0s
     * @param mask e.g. "255.255.255.0"
     * @returns true if valid, false if not
     */
    static isValidSubnetMask(mask: string): boolean {
    }
}
