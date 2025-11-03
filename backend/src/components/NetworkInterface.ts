import type { Node } from './Node.js';

/**
 * Represents a single Network Interface of a device (Node)
 */
export class NetworkInterface {
    readonly id: string;
    private _ip: string;
    private _mask: string;
    private _cidr: number;
    private _mac: string;
    parentNode?: Node;

    /**
     * Create a Network Interface
     * @param ip IPv4 Address, for example: "192.168.1.100"
     * @param mask IPv4 format Address of the mask, for example: "255.255.255.0", "255.255.0.0"...
     * @param mac Mac of the Network Interface
     */
    constructor(ip: string, mask: string, mac?: string) {
        this.id = crypto.randomUUID();
        if (!NetworkInterface.isValidIP(ip)) throw new Error(`Invalid IP: ${ip}`);
        if (!NetworkInterface.isValidSubnetMask(mask)) throw new Error(`Invalid subnet mask: ${mask}`);
        
        this._ip = ip;
        this._mask = mask;
        this._cidr = NetworkInterface.maskToCidr(mask);
        this._mac = mac || NetworkInterface.generateMAC();
    }

    // Getters
    get ip(): string { return this._ip; }
    get mask(): string { return this._mask; }
    get cidr(): number { return this._cidr; }
    get mac(): string { return this._mac; }

    setParentNode(node: Node): void {
        this.parentNode = node;
    }

    /**
     * Generates a valid Mac address 
     * It chooses 2 random hexadecimal digits from the "hexDigits" string and repeats it twice
     * @returns Mac address
     */
    static generateMAC(): string {
        const hexDigits = '0123456789ABCDEF';
        let mac = '';
        for (let i = 0; i < 6; i++) {
            if (i > 0) mac += ':';
            mac += hexDigits[Math.floor(Math.random() * 16)];
            mac += hexDigits[Math.floor(Math.random() * 16)];
        }
        return mac;
    }

    /**
     * Creates a NetworkInterface object from CIDR notation
     * @param cidrNotation CIDR notation like: "192.168.1.10/24"
     * @returns NetworkInterface created
     */
    static fromCIDR(cidrNotation: string, mac?: string): NetworkInterface {
        const [ip, prefix] = cidrNotation.split('/');
        if(ip == undefined || prefix == undefined) 
            throw new Error(`Invalid CIDR notation IP: ${cidrNotation}`);
        const cidr = parseInt(prefix, 10);
        const mask = this.cidrToMask(cidr);
        
        return new NetworkInterface(ip, mask, mac);
    }

    /**
     * Check if certain string input is a valid IPv4 adrress, needs to be 4 octets of 3 numbers from 0 to 255
     * @param ip e.g. "192.168.1.1", "255.255.255.255", "0.0.0.0"
     * @returns true if valid, false if not
     */
    static isValidIP(ip: string): boolean {
        const parts: string[] = ip.split(".");

        if(parts.length !== 4) 
            return false;
        
        return parts.every((part: string): boolean => {
            const num: number = parseInt(part.trim(), 10);
            return !isNaN(num) && num >= 0 && num <= 255;
        });
    }

    /**
     * Validate subnet mask: must be valid IPv4 address and contiguous 1s followed by 0s
     * @param mask e.g. "255.255.255.0"
     * @returns true if valid, false if not
     */
    static isValidSubnetMask(mask: string): boolean {
        if(!this.isValidIP(mask)) 
            return false;
        
        const parts: string[] = mask.split(".");
        const binaryParts: string[] = parts.map((part : String): string => {
            const num: number = Number(part);
            const bin: string = num.toString(2).padStart(8,"0");
            return bin;
        });

        const binary: string = binaryParts.join("");
        let foundZero: boolean = false;
        for (const bit of binary){
            if(bit === "0") foundZero = true;
            else if(foundZero && bit === "1") 
                return false;
        }

        return true;
    }

    /**
     * Calculates the network address of the Network Interface
     * Takes the IPv4 address and the SubnetMask and makes the bitwise operation AND ("&")
     * @returns the network address for this interface
     */
    getNetworkAddress(): string {
        const ipParts: number[] = this._ip.split('.').map((n: string): number => parseInt(n, 10));
        const maskParts: number[] = this._mask.split('.').map((n: string): number => parseInt(n, 10));
        const network: number[] = ipParts.map((part: number, i: number) => part & maskParts[i]!); // bitwise AND
        return network.join('.');
    }

    /**
     * Calculates the broadcast address of the Network Interface
     * Takes the IPv4 address and the SubnetMask with inverted bits and makes the bitwise operation OR ("|")
     * @returns the broadcast address for the interface
     */
    getBroadcastAddress(): string {
        const ipParts: number[] = this._ip.split('.').map((n: string): number => parseInt(n, 10));
        const maskParts: number[] = this._mask.split('.').map((n: string): number => parseInt(n, 10));
        const broadcastParts: number[] = ipParts.map(
            (ip: number, i: number): number => ip | (~maskParts[i]! & 255)
        ); // flip bits, limit to 8 
        const broadcast: string = broadcastParts.join(".");
        return broadcast;
    }

    /**
     * Calculates the number of hosts that the Network (not including network and broadcast addresses)
     * @returns number of possible hosts (except network and broadcast)
     */
    getUsableHostCount(): number {
        return Math.pow(2, (32 - this._cidr)) - 2;
    }

    isInSubnet(ip: string): boolean {
        const ipParts: number[] = ip.split('.').map((n: string): number => parseInt(n, 10));
        const networkParts: number[] = this.getNetworkAddress().split('.').map((n: string): number => parseInt(n, 10));
        const maskParts: number[] = this._mask.split('.').map((n: string): number => parseInt(n, 10));
        
        for (let i = 0; i < 4; i++) {
            if ((ipParts[i]! & maskParts[i]!) !== networkParts[i])
                return false;
        }
        return true;
    }

    /**
     * Convert mask IP notation to CIDR
     * Take something for example "255.255.255.0" to "24"
     * @param mask ipv4 notation of mask
     * @returns Convert subnet mask to CIDR prefix length
     */
    static maskToCidr(mask: string): number {
        const maskParts = mask.split('.').map(Number);
        const binaryMask: string = maskParts.map(part => part.toString(2).padStart(8, '0')).join('');

        let count: number = 0;
        for (const bit of binaryMask)
            if (bit === "1") count++;

        return count;
    }

    /**
     * Convert CIDR to mask IP notation
     * Take something for example "24" and convert to "255.255.255.0"
     * @param cidr integer (0–32)
     * @returns subnet mask in dotted decimal notation
     */
    static cidrToMask(cidr: number): string {
        if (cidr < 0 || cidr > 32 || !Number.isInteger(cidr)) throw new Error(`Invalid CIDR: ${cidr}`);
        const binaryMask: string = "1".repeat(cidr) + "0".repeat(32 - cidr);
        const octets: string[] = [];

        for (let i: number = 0; i < 32; i += 8) {
            const byteString: string = binaryMask.slice(i, i + 8);
            const octetValue: number = parseInt(byteString, 2);
            octets.push(octetValue.toString());
        }

        const mask: string = octets.join(".");
        return mask;
    }
}