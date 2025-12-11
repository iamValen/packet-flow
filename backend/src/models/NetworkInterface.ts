import type { Node } from "./Node.js";

/**
 * network interface card (NIC) for nodes
 * handles IP/MAC addressing and subnet calculations
 */
export class NetworkInterface {
    readonly id: string;
    private _ip: string;
    private _mask: string;
    private _cidr: number;
    private readonly _mac: string;
    parentNode?: Node;

    constructor(ip: string, mask: string, mac?: string) {
        this.id = crypto.randomUUID();

        if (!NetworkInterface.isValidIP(ip)) throw new Error(`bad ip: ${ip}`);
        if (!NetworkInterface.isValidSubnetMask(mask)) throw new Error(`bad mask: ${mask}`);

        this._ip = ip;
        this._mask = mask;
        this._cidr = NetworkInterface.maskToCidr(mask);

        // generate mac if not provided
        if (mac && !NetworkInterface.isValidMAC(mac)) throw new Error(`bad mac: ${mac}`);
        this._mac = mac || NetworkInterface.generateMAC();
    }

    get ip(): string { return this._ip; }
    get mask(): string { return this._mask; }
    get cidr(): number { return this._cidr; }
    get mac(): string { return this._mac; }

    setParentNode(node: Node): void {
        this.parentNode = node;
    }

    // random mac address generator
    static generateMAC(): string {
        const hex = "0123456789ABCDEF";
        let mac = "";
        for (let i = 0; i < 6; i++) {
            if (i > 0) mac += ":";
            mac += hex[Math.floor(Math.random() * 16)];
            mac += hex[Math.floor(Math.random() * 16)];
        }
        return mac;
    }

    // create from "192.168.1.10/24" format
    static fromCIDR(notation: string, mac?: string): NetworkInterface {
        const [ip, prefix] = notation.split("/");
        if (!ip || !prefix) throw new Error(`bad cidr: ${notation}`);
        const mask = this.cidrToMask(parseInt(prefix, 10));
        return new NetworkInterface(ip, mask, mac);
    }

    // check if string is valid ipv4
    static isValidIP(ip: string): boolean {
        const parts = ip.split(".");
        if (parts.length !== 4) return false;
        return parts.every(p => {
            const n = parseInt(p.trim(), 10);
            return !isNaN(n) && n >= 0 && n <= 255;
        });
    }

    // check if mask is valid (contiguous 1s then 0s)
    static isValidSubnetMask(mask: string): boolean {
        if (!this.isValidIP(mask)) return false;
        const binary = mask.split(".")
            .map(p => Number(p).toString(2).padStart(8, "0"))
            .join("");
        // should be all 1s followed by all 0s
        let foundZero = false;
        for (const bit of binary) {
            if (bit === "0") foundZero = true;
            else if (foundZero) return false;
        }
        return true;
    }

    static isValidMAC(mac: string): boolean {
        return /^([0-9A-F]{2}:){5}[0-9A-F]{2}$/i.test(mac);
    }

    // get network address (ip AND mask)
    getNetworkAddress(): string {
        const ipParts = this._ip.split(".").map(Number);
        const maskParts = this._mask.split(".").map(Number);
        return ipParts.map((p, i) => p & (maskParts[i] ?? 0)).join(".");
    }

    // get broadcast address (ip OR inverted mask)
    getBroadcastAddress(): string {
        const ipParts = this._ip.split(".").map(Number);
        const maskParts = this._mask.split(".").map(Number);
        return ipParts.map((p, i) => p | (~(maskParts[i] ?? 0) & 255)).join(".");
    }

    // check if given ip is in same subnet
    isInSubnet(ip: string): boolean {
        if (!NetworkInterface.isValidIP(ip)) throw new Error(`bad ip: ${ip}`);
        const ipParts = ip.split(".").map(Number);
        const netParts = this.getNetworkAddress().split(".").map(Number);
        const maskParts = this._mask.split(".").map(Number);
        for (let i = 0; i < 4; i++) {
            if (((ipParts[i] ?? 0) & (maskParts[i] ?? 0)) !== netParts[i]) return false;
        }
        return true;
    }

    // convert mask to cidr (255.255.255.0 -> 24)
    static maskToCidr(mask: string): number {
        if (!this.isValidSubnetMask(mask)) throw new Error(`bad mask: ${mask}`);
        const binary = mask.split(".").map(p => Number(p).toString(2).padStart(8, "0")).join("");
        return binary.split("1").length - 1;
    }

    // convert cidr to mask (24 -> 255.255.255.0)
    static cidrToMask(cidr: number): string {
        if (cidr < 0 || cidr > 32) throw new Error(`bad cidr: ${cidr}`);
        const binary = "1".repeat(cidr) + "0".repeat(32 - cidr);
        const octets = [];
        for (let i = 0; i < 32; i += 8) {
            octets.push(parseInt(binary.slice(i, i + 8), 2).toString());
        }
        return octets.join(".");
    }
}