import { describe, it, expect } from "vitest";
import { NetworkInterface } from "../models/NetworkInterface.js";
import { Link } from "../models/Link.js";
import { Host } from "../models/Host.js";
import { Router } from "../models/Router.js";
import { Switch } from "../models/Switch.js";
import { Packet, Protocol } from "../models/Packet.js";
import { Topology } from "../models/Topology.js";

describe("NetworkInterface", () => {
  it("should correctly compute network, broadcast, and CIDR", () => {
    const ni: NetworkInterface = new NetworkInterface("192.168.1.10", "255.255.255.0");
    expect(ni.getNetworkAddress()).toBe("192.168.1.0");
    expect(ni.getBroadcastAddress()).toBe("192.168.1.255");
    expect(ni.getUsableHostCount()).toBe(254);
    expect(ni.cidr).toBe(24);
  });

  it("should validate IPs and masks", () => {
    expect(NetworkInterface.isValidIP("192.168.0.1")).toBe(true);
    expect(NetworkInterface.isValidIP("999.999.1.1")).toBe(false);
    expect(NetworkInterface.isValidSubnetMask("255.255.255.0")).toBe(true);
    expect(NetworkInterface.isValidSubnetMask("255.0.255.0")).toBe(false);
  });

  it("should convert mask <-> CIDR", () => {
    expect(NetworkInterface.maskToCidr("255.255.255.0")).toBe(24);
    expect(NetworkInterface.cidrToMask(24)).toBe("255.255.255.0");
    expect((): string => NetworkInterface.cidrToMask(33)).toThrow();
  });

  it("should detect subnet membership", () => {
    const ni: NetworkInterface = new NetworkInterface("192.168.1.10", "255.255.255.0");
    expect(ni.isInSubnet("192.168.1.20")).toBe(true);
    expect(ni.isInSubnet("192.168.2.1")).toBe(false);
  });

  it("should throw error for invalid constructor args", () => {
    expect((): NetworkInterface => new NetworkInterface("300.1.1.1", "255.255.255.0")).toThrow();
    expect((): NetworkInterface => new NetworkInterface("192.168.1.1", "255.0.255.0")).toThrow();
  });
});

describe("Link", () => {
  const intfA: NetworkInterface = new NetworkInterface("10.0.0.1", "255.255.255.0");
  const intfB: NetworkInterface = new NetworkInterface("10.0.0.2", "255.255.255.0");
  const link: Link = new Link(intfA, intfB);

  it("should link two interfaces", () => {
    const otherIntf: NetworkInterface = new NetworkInterface("192.168.1.1", "255.255.255.0");
    expect(link.involvesInterface(intfA)).toBe(true);
    expect(link.involvesInterface(otherIntf)).toBe(false);
    expect(link.getOtherEnd(intfA)).toBe(intfB);
    expect(link.getOtherEnd(intfB)).toBe(intfA);
    expect(link.getOtherEnd(otherIntf)).toBeNull();
  });
});

describe("Packet", () => {
  it("should clone correctly and decrement TTL", () => {
    const pkt: Packet = new Packet("10.0.0.1", "10.0.0.2", Protocol.ICMP, "Ping");
    expect(pkt.ttl).toBe(64);
    pkt.decrementTTL();
    expect(pkt.ttl).toBe(63);
    expect(pkt.isExpired()).toBe(false);
    const clone: Packet = pkt.clone();
    expect(clone.id).not.toBe(pkt.id);
    expect(clone.ttl).toBe(pkt.ttl);
  });
});

describe("Host", () => {
  const hInt: NetworkInterface = new NetworkInterface("192.168.1.2", "255.255.255.0");
  const host: Host = new Host("HostA", { x: 0, y: 0 }, [hInt]);

  it("should send a packet and select correct interface", () => {
    const { packet }: { packet: Packet; sourceInterface: NetworkInterface } = host.sendPacket(
      "192.168.1.3",
      Protocol.ICMP,
      "Echo"
    );
    expect(packet.srcIp).toBe("192.168.1.2");
    expect(packet.dstIp).toBe("192.168.1.3");
    expect(packet.history[0]!.name).toBe("HostA");
  });

  it("should throw error if no route to destination", () => {
    const isolated: Host = new Host("Isolated", { x: 0, y: 0 }, [
      new NetworkInterface("10.0.0.1", "255.255.255.0"),
    ]);
    expect((): { packet: Packet; sourceInterface: NetworkInterface;} => isolated.sendPacket("192.168.1.10", Protocol.ICMP)).toThrow();
  });

  it("should generate ICMP reply on receive", () => {
    const hInt: NetworkInterface = new NetworkInterface("192.168.1.2", "255.255.255.0");
    const host: Host = new Host("HostA", { x: 0, y: 0 }, [hInt]);
    
    const req: Packet = new Packet(
        "192.168.1.3",                    
        "192.168.1.2",
        Protocol.ICMP, 
        "ICMP Echo Request",
        "AA:BB:CC:DD:EE:FF", // srcMAC
        hInt.mac // dstMAC (host's MAC)
    );
    
    const reply: Packet | null = host.receivePacket(req);
    expect(reply).not.toBeNull();
    expect(reply?.payload).toBe("ICMP Echo Reply");
});
});

describe("Router", () => {
  const rInt1: NetworkInterface = new NetworkInterface("10.0.0.1", "255.255.255.0");
  const rInt2: NetworkInterface = new NetworkInterface("192.168.1.1", "255.255.255.0");
  const router: Router = new Router("R1", { x: 1, y: 1 }, [rInt1, rInt2]);

  it("should add routes and perform lookup", () => {
    router.addRoute("192.168.1.0", "255.255.255.0", rInt2);
    router.setDefaultRoute(rInt1);
    expect(router.lookupRoute("192.168.1.10")).toBe(rInt2);
    expect(router.lookupRoute("8.8.8.8")).toBe(rInt1);
  });

  it("should throw on invalid route or duplicate", () => {
    expect((): void => router.addRoute("300.0.0.0", "255.255.255.0", rInt1)).toThrow();
    expect((): void => router.addRoute("192.168.1.0", "255.255.255.0", rInt2)).toThrow();
  });

  it("should forward packets correctly", () => {
    const pkt: Packet = new Packet("10.0.0.2", "192.168.1.5", Protocol.ICMP);
    const outIfaces: NetworkInterface[] = router.forwardPacket(pkt, rInt1);
    expect(outIfaces).toContain(rInt2);
  });
});

describe("Switch", () => {
  const sInt1: NetworkInterface = new NetworkInterface("0.0.0.0", "255.255.255.0");
  const sInt2: NetworkInterface = new NetworkInterface("0.0.0.0", "255.255.255.0");
  const sw: Switch = new Switch("SW1", { x: 0, y: 0 }, [sInt1, sInt2]);

  it("should flood when destination unknown", () => {
    const pkt: Packet = new Packet(
      "192.168.1.2",
      "192.168.1.3",
      Protocol.ICMP,
      undefined,
      "AA:BB:CC:DD:EE:FF",
      "FF:EE:DD:CC:BB:AA"
    );
    const out: NetworkInterface[] = sw.forwardPacket(pkt, sInt1);
    expect(out).toHaveLength(1);
    expect(out[0]).toBe(sInt2);
  });

  it("should learn MAC and forward directly on second packet", () => {
    const pkt2: Packet = new Packet(
      "192.168.1.2",
      "192.168.1.3",
      Protocol.ICMP,
      undefined,
      "AA:BB:CC:DD:EE:FF",
      "FF:EE:DD:CC:BB:AA"
    );
    sw.forwardPacket(pkt2, sInt2);
    
    // Second packet: switch should know where AA:BB:CC:DD:EE:FF is
    const pkt3: Packet = new Packet(
      "192.168.1.3",           // srcIp
      "192.168.1.2",           // dstIp
      Protocol.ICMP,
      undefined,
      "FF:EE:DD:CC:BB:AA",     // srcMAC
      "AA:BB:CC:DD:EE:FF"      // dstMAC (now known to be on sInt2)
    );
    const out: NetworkInterface[] = sw.forwardPacket(pkt3, sInt2);
    expect(out).toEqual([sInt1]);
  });
});

describe("Router Firewall (integrated)", () => {
  it("should block ICMP packet according to rule", () => {
    const fw = new Router("R1", { x: 0, y: 0 }, [
      new NetworkInterface("192.168.1.1", "255.255.255.0"),
    ]);

    fw.addRule("192.168.1.2", "192.168.1.3", Protocol.ICMP, "DROP", 10);

    const pkt = new Packet("192.168.1.2", "192.168.1.3", Protocol.ICMP, "ICMP Echo Request", "AA:AA:AA:AA:AA:AA", "BB:BB:BB:BB:BB:BB");
    const output = fw.forwardPacket(pkt, fw.getInterfaces()[0]);
    expect(output.length).toBe(0);
  });

  it("should allow TCP packet when default policy = ALLOW", () => {
    const fw = new Router("R1", { x: 0, y: 0 }, [
      new NetworkInterface("10.0.0.1", "255.255.255.0"),
    ]);
    fw.setDefaultPolicy("ALLOW");

    const pkt = new Packet("10.0.0.2", "10.0.0.3", Protocol.TCP, "Data", "AA:AA:AA:AA:AA:AA", "BB:BB:BB:BB:BB:BB");
    const output = fw.forwardPacket(pkt, fw.getInterfaces()[0]);
    expect(output.length).toBe(1);
  });
});


describe("Topology", () => {
  it("should send and step packets in a simple LAN", () => {
    const topo: Topology = new Topology("MiniTopo");
    const h1: Host = new Host("H1", { x: 0, y: 0 }, [
      new NetworkInterface("192.168.1.2", "255.255.255.0"),
    ]);
    const h2: Host = new Host("H2", { x: 1, y: 0 }, [
      new NetworkInterface("192.168.1.3", "255.255.255.0"),
    ]);
    const s1: Switch = new Switch("SW", { x: 0.5, y: 0 }, [
      new NetworkInterface("0.0.0.0", "255.255.255.0"),
      new NetworkInterface("0.0.0.0", "255.255.255.0"),
    ]);

    topo.addNode(h1);
    topo.addNode(h2);
    topo.addNode(s1);
    topo.addLink(h1.interfaces[0]!, s1.interfaces[0]!);
    topo.addLink(h2.interfaces[0]!, s1.interfaces[1]!);

    const pkt: Packet = topo.sendPacket(h1, "192.168.1.3", Protocol.ICMP, "ICMP Echo Request");
    expect(pkt.dstIp).toBe("192.168.1.3");

    topo.step();
    const packetsInFlight = topo.getPacketsInFlight();
    expect(packetsInFlight.length).toBeGreaterThanOrEqual(0);
  });

  it("should throw when linking invalid interfaces", () => {
    const topo: Topology = new Topology("Invalid");
    const ni1: NetworkInterface = new NetworkInterface("10.0.0.1", "255.255.255.0");
    expect((): Link => topo.addLink(ni1, ni1)).toThrow();
  });
});

describe("🌐 ARP Cache Integration Tests", () => {
    it("should populate ARP caches for hosts in same subnet", () => {
        const topo = new Topology("ARPTest");
        
        const h1 = new Host("H1", { x: 0, y: 0 }, [
            new NetworkInterface("192.168.1.2", "255.255.255.0"),
        ]);
        
        const h2 = new Host("H2", { x: 1, y: 0 }, [
            new NetworkInterface("192.168.1.3", "255.255.255.0"),
        ]);
        
        const sw = new Switch("SW", { x: 0.5, y: 0 }, [
            new NetworkInterface("0.0.0.0", "255.255.255.0"),
            new NetworkInterface("0.0.0.0", "255.255.255.0"),
        ]);

        topo.addNode(h1);
        topo.addNode(h2);
        topo.addNode(sw);
        topo.addLink(h1.interfaces[0]!, sw.interfaces[0]!);
        topo.addLink(h2.interfaces[0]!, sw.interfaces[1]!);
        
        // Populate ARP caches
        topo.fillARP();
        
        // Verify H1 knows H2's MAC
        const { packet } = h1.sendPacket("192.168.1.3", Protocol.ICMP, "Ping");
        expect(packet.dstMAC).toBe(h2.interfaces[0]!.mac);
        expect(packet.dstMAC).not.toBe("FF:FF:FF:FF:FF:FF");
    });

    it("should learn MAC addresses from received packets", () => {
        const h1 = new Host("H1", { x: 0, y: 0 }, [
            new NetworkInterface("192.168.1.2", "255.255.255.0"),
        ]);
        
        const h2 = new Host("H2", { x: 1, y: 0 }, [
            new NetworkInterface("192.168.1.3", "255.255.255.0"),
        ]);
        
        // H1 doesn't know H2's MAC initially
        const { packet: req } = h1.sendPacket("192.168.1.3", Protocol.ICMP, "ICMP Echo Request");
        expect(req.dstMAC).toBe("FF:FF:FF:FF:FF:FF"); // Broadcast
        
        // H2 receives the packet and learns H1's MAC
        const reply = h2.receivePacket(req);
        expect(reply).not.toBeNull();
        
        // Check that H2 learned H1's MAC
        const h2Cache = h2.getARPCache();
        expect(h2Cache.has("192.168.1.2")).toBe(true);
        expect(h2Cache.get("192.168.1.2")?.mac).toBe(h1.interfaces[0]!.mac);
        
        // H2's reply should have correct destination MAC
        expect(reply?.dstMAC).toBe(h1.interfaces[0]!.mac);
    });

    it("should use broadcast when ARP cache misses", () => {
        const h1 = new Host("H1", { x: 0, y: 0 }, [
            new NetworkInterface("192.168.1.2", "255.255.255.0"),
        ]);
        
        // Send without ARP entry
        const { packet } = h1.sendPacket("192.168.1.99", Protocol.ICMP, "Test");
        expect(packet.dstMAC).toBe("FF:FF:FF:FF:FF:FF");
    });

    it("should handle complete ping scenario with ARP learning", () => {
        const topo = new Topology("PingTest");
        
        const h1 = new Host("H1", { x: 0, y: 0 }, [
            new NetworkInterface("192.168.1.2", "255.255.255.0"),
        ]);
        
        const h2 = new Host("H2", { x: 1, y: 0 }, [
            new NetworkInterface("192.168.1.3", "255.255.255.0"),
        ]);
        
        const sw = new Switch("SW", { x: 0.5, y: 0 }, [
            new NetworkInterface("0.0.0.0", "255.255.255.0"),
            new NetworkInterface("0.0.0.0", "255.255.255.0"),
        ]);

        topo.addNode(h1);
        topo.addNode(h2);
        topo.addNode(sw);
        topo.addLink(h1.interfaces[0]!, sw.interfaces[0]!);
        topo.addLink(h2.interfaces[0]!, sw.interfaces[1]!);
        
        topo.fillARP();
        
        const { packet } = h1.sendPacket("192.168.1.3", Protocol.ICMP, "ICMP Echo Request");
        
        expect(packet.srcMAC).toBe(h1.interfaces[0]!.mac);
        expect(packet.dstMAC).toBe(h2.interfaces[0]!.mac);
        
        const h1Cache = topo.getHostARPCache("H1");
        const h2Cache = topo.getHostARPCache("H2");
        
        expect(h1Cache?.has("192.168.1.3")).toBe(true);
        expect(h2Cache?.has("192.168.1.2")).toBe(true);
    });
});
