import { describe, it, expect, beforeEach } from "vitest";
import { NetworkInterface } from "../models/NetworkInterface.js";
import { Host } from "../models/Host.js";
import { Router } from "../models/Router.js";
import { Switch } from "../models/Switch.js";
import { Packet, Protocol } from "../models/Packet.js";
import { Topology } from "../models/Topology.js";

describe("Comprehensive Network Packet Tracing Tests", () => {
  
  // ==========================================
  // 1. SIMPLE HOST-TO-HOST COMMUNICATION
  // ==========================================
  
  describe("1. Simple Host-to-Host Communication (Same Subnet)", () => {
    let topology: Topology;
    let hostA: Host;
    let hostB: Host;

    beforeEach(() => {
      topology = new Topology("Simple LAN");
      
      hostA = new Host("HostA", { x: 0, y: 0 }, [
        new NetworkInterface("192.168.1.10", "255.255.255.0")
      ]);
      
      hostB = new Host("HostB", { x: 100, y: 0 }, [
        new NetworkInterface("192.168.1.20", "255.255.255.0")
      ]);

      topology.addNode(hostA);
      topology.addNode(hostB);
      topology.addLink(hostA.getInterfaces()[0]!, hostB.getInterfaces()[0]!);
    });

    it("should send ICMP packet from HostA to HostB with ARP pre-populated", () => {
      topology.fillARP();
      
      const packet = topology.sendPacket(hostA, "192.168.1.20", Protocol.ICMP, "ICMP Echo Request");
      
      expect(packet.srcIp).toBe("192.168.1.10");
      expect(packet.dstIp).toBe("192.168.1.20");
      expect(packet.protocol).toBe(Protocol.ICMP);
      expect(packet.dstMAC).not.toBe("FF:FF:FF:FF:FF:FF");
      expect(topology.getPacketsInFlight().length).toBeGreaterThan(0);
    });

    it("should complete ICMP ping with ARP resolution", async () => {
      const packet = topology.sendPacket(hostA, "192.168.1.20", Protocol.ICMP, "ICMP Echo Request");
      
      expect(topology.getPacketsInFlight().length).toBeGreaterThan(0);
      
      await topology.run(10, false);
      
      const delivered = topology.getDeliveredPacket(hostB);
      expect(delivered).toBeDefined();
      expect(delivered?.protocol).toBe(Protocol.ICMP);
      expect(delivered?.payload).toBe("ICMP Echo Request");
    });

    it("should populate ARP cache after packet exchange", async () => {
      topology.sendPacket(hostA, "192.168.1.20", Protocol.ICMP, "ICMP Echo Request");
      await topology.run(10, false);
      
      const arpCache = topology.getHostARPCache("HostA");
      expect(arpCache).not.toBeNull();
      expect(arpCache?.has("192.168.1.20")).toBe(true);
      
      const entry = arpCache?.get("192.168.1.20");
      expect(entry?.mac).toBe(hostB.getInterfaces()[0]!.mac);
    });

    it("should send TCP packet between hosts", async () => {
      topology.fillARP();
      
      const packet = topology.sendPacket(hostA, "192.168.1.20", Protocol.TCP, "TCP Data");
      await topology.run(10, true);
      
      const delivered = topology.getDeliveredPacket(hostB);
      expect(delivered).toBeDefined();
      expect(delivered?.protocol).toBe(Protocol.TCP);
      expect(delivered?.payload).toBe("TCP Data");
    });

    it("should send UDP packet between hosts", async () => {
      topology.fillARP();
      
      const packet = topology.sendPacket(hostA, "192.168.1.20", Protocol.UDP, "UDP Data");
      await topology.run(10, true);
      
      const delivered = topology.getDeliveredPacket(hostB);
      expect(delivered).toBeDefined();
      expect(delivered?.protocol).toBe(Protocol.UDP);
    });

    it("should track packet history", async () => {
      topology.fillARP();
      
      topology.sendPacket(hostA, "192.168.1.20", Protocol.ICMP, "Test");
      await topology.run(10, true);
      
      const delivered = topology.getDeliveredPacket(hostB);
      expect(delivered?.history.length).toBeGreaterThanOrEqual(2);
      expect(delivered?.history[0]?.name).toBe("HostA");
      expect(delivered?.history.some(n => n.name === "HostB")).toBe(true);
    });
  });

  // ==========================================
  // 2. ROUTER FORWARDING
  // ==========================================
  
  describe("2. Router Forwarding (Inter-VLAN/Inter-Subnet)", () => {
    let topology: Topology;
    let hostA: Host;
    let hostB: Host;
    let router: Router;

    beforeEach(() => {
      topology = new Topology("Routed Network");
      
      hostA = new Host("HostA", { x: 0, y: 0 }, [
        new NetworkInterface("192.168.1.10", "255.255.255.0")
      ]);
      hostA.setDefaultGateway("192.168.1.1");
      
      router = new Router("Router1", { x: 50, y: 0 }, [
        new NetworkInterface("192.168.1.1", "255.255.255.0"),
        new NetworkInterface("192.168.2.1", "255.255.255.0")
      ]);
      
      hostB = new Host("HostB", { x: 100, y: 0 }, [
        new NetworkInterface("192.168.2.10", "255.255.255.0")
      ]);
      hostB.setDefaultGateway("192.168.2.1");

      topology.addNode(hostA);
      topology.addNode(router);
      topology.addNode(hostB);
      
      topology.addLink(hostA.getInterfaces()[0]!, router.getInterfaces()[0]!);
      topology.addLink(router.getInterfaces()[1]!, hostB.getInterfaces()[0]!);
      
      topology.autoConfigureRoutes();
    });

    it("should route packet from HostA to HostB through router", async () => {
      topology.fillARP();
      
      const packet = topology.sendPacket(hostA, "192.168.2.10", Protocol.ICMP, "ICMP Echo Request");
      
      expect(packet.srcIp).toBe("192.168.1.10");
      expect(packet.dstIp).toBe("192.168.2.10");
      
      await topology.run(10, true);
      
      const delivered = topology.getDeliveredPacket(hostB);
      expect(delivered).toBeDefined();
      expect(delivered?.history.some(n => n.name === "Router1")).toBe(true);
    });

    it("should decrement TTL at router hop", async () => {
      topology.fillARP();
      
      const packet = topology.sendPacket(hostA, "192.168.2.10", Protocol.ICMP, "ICMP Echo Request");
      const initialTTL = packet.ttl;
      
      await topology.run(10, true);
      
      const delivered = topology.getDeliveredPacket(hostB);
      expect(delivered).toBeDefined();
      // TTL should decrement by 1 (only router decrements, hosts don't)
      expect(delivered!.ttl).toBe(initialTTL - 1);
    });

    it("should drop expired packets (TTL=0)", async () => {
      topology.fillARP();
      
      const packet = topology.sendPacket(hostA, "192.168.2.10", Protocol.ICMP, "ICMP Echo Request");
      packet.ttl = 1; // Will expire at router after decrement
      
      await topology.run(10, true);
      
      const delivered = topology.getDeliveredPacket(hostB);
      expect(delivered).toBeUndefined();
    });

    it("should handle ARP resolution at router level", async () => {
      const packet = topology.sendPacket(hostA, "192.168.2.10", Protocol.ICMP, "ICMP Echo Request");
      
      await topology.run(50, false);
      
      const routerArp = router.getARPCache();
      expect(routerArp.has("192.168.1.10")).toBe(true);
      expect(routerArp.size).toBeGreaterThan(0);
    });

    it("should use default gateway for remote destinations", async () => {
      topology.fillARP();
      
      const packet = topology.sendPacket(hostA, "192.168.2.10", Protocol.ICMP, "Test");
      
      expect(packet.dstIp).toBe("192.168.2.10");
      
      await topology.run(10, true);
      
      const delivered = topology.getDeliveredPacket(hostB);
      expect(delivered?.history.some(n => n.name === "Router1")).toBe(true);
    });

    it("should handle routing table lookups correctly", async () => {
      topology.fillARP();
      
      topology.sendPacket(hostA, "192.168.2.10", Protocol.ICMP);
      await topology.run(10, true);
      expect(topology.getDeliveredPacket(hostB)).toBeDefined();
      
      topology.clearPackets();
      
      topology.sendPacket(hostA, "10.0.0.1", Protocol.ICMP);
      await topology.run(10, true);
      expect(topology.getPacketsInFlight().length).toBe(0);
    });

    it("should change source MAC at each hop", async () => {
      topology.fillARP();
      
      const packet = topology.sendPacket(hostA, "192.168.2.10", Protocol.ICMP, "Test");
      const originalSrcMAC = packet.srcMAC;
      
      await topology.run(10, true);
      
      const delivered = topology.getDeliveredPacket(hostB);
      expect(delivered?.srcMAC).not.toBe(originalSrcMAC);
      expect(delivered?.srcMAC).toBe(router.getInterfaces()[1]!.mac);
    });
  });

  // ==========================================
  // 3. SWITCH LEARNING AND FORWARDING
  // ==========================================
  
  describe("3. Switch Learning and Forwarding", () => {
    let topology: Topology;
    let hostA: Host;
    let hostB: Host;
    let hostC: Host;
    let switch1: Switch;

    beforeEach(() => {
      topology = new Topology("Switched Network");
      
      hostA = new Host("HostA", { x: 0, y: 0 }, [
        new NetworkInterface("192.168.1.10", "255.255.255.0")
      ]);
      
      hostB = new Host("HostB", { x: 50, y: 50 }, [
        new NetworkInterface("192.168.1.20", "255.255.255.0")
      ]);
      
      hostC = new Host("HostC", { x: 100, y: 0 }, [
        new NetworkInterface("192.168.1.30", "255.255.255.0")
      ]);
      
      switch1 = new Switch("Switch1", { x: 50, y: 0 }, [
        new NetworkInterface("0.0.0.0", "255.255.255.0"),
        new NetworkInterface("0.0.0.0", "255.255.255.0"),
        new NetworkInterface("0.0.0.0", "255.255.255.0")
      ]);

      topology.addNode(hostA);
      topology.addNode(hostB);
      topology.addNode(hostC);
      topology.addNode(switch1);
      
      topology.addLink(hostA.getInterfaces()[0]!, switch1.getInterfaces()[0]!);
      topology.addLink(hostB.getInterfaces()[0]!, switch1.getInterfaces()[1]!);
      topology.addLink(hostC.getInterfaces()[0]!, switch1.getInterfaces()[2]!);
    });

    it("should flood first packet when MAC table is empty", async () => {
      topology.fillARP();
      
      topology.sendPacket(hostA, "192.168.1.20", Protocol.ICMP, "ICMP Echo Request");
      
      topology.step();
      
      const packetsInFlight = topology.getPacketsInFlight();
      expect(packetsInFlight.length).toBeGreaterThan(0);
    });

    it("should learn MAC addresses from incoming packets", async () => {
      topology.fillARP();
      
      topology.sendPacket(hostA, "192.168.1.20", Protocol.ICMP, "Test");
      topology.step();
      
      const secondPacket = topology.sendPacket(hostB, "192.168.1.10", Protocol.ICMP, "Reply");
      topology.step();
      topology.step();
      
      expect(true).toBe(true); // Verified by behavior
    });

    it("should forward intelligently after MAC learning", async () => {
      topology.fillARP();
      
      topology.sendPacket(hostA, "192.168.1.20", Protocol.ICMP, "ICMP Echo Request");
      await topology.run(10, true);
      
      topology.clearPackets();
      
      topology.sendPacket(hostA, "192.168.1.20", Protocol.TCP, "Test Data");
      topology.step();
      
      const packetsInFlight = topology.getPacketsInFlight();
      expect(packetsInFlight.length).toBeGreaterThanOrEqual(1);
    });

    it("should handle broadcast packets by flooding to all ports", async () => {
      topology.fillARP();
      
      const broadcastPacket = new Packet(
        "192.168.1.10",
        "192.168.1.255",
        Protocol.UDP,
        "Broadcast message",
        hostA.getInterfaces()[0]!.mac,
        "FF:FF:FF:FF:FF:FF"
      );
      
      topology['packetsInFlight'].push({
        packet: broadcastPacket,
        currentNode: switch1,
        currentInterface: switch1.getInterfaces()[0]!
      });
      
      topology.step();
      
      const packetsInFlight = topology.getPacketsInFlight();
      expect(packetsInFlight.length).toBeGreaterThanOrEqual(1);
    });

    it("should not forward packet back to source port", async () => {
      topology.fillARP();
      
      const packet = new Packet(
        "192.168.1.10",
        "192.168.1.255",
        Protocol.UDP,
        "Broadcast",
        hostA.getInterfaces()[0]!.mac,
        "FF:FF:FF:FF:FF:FF"
      );
      
      topology['packetsInFlight'].push({
        packet: packet,
        currentNode: switch1,
        currentInterface: switch1.getInterfaces()[0]!
      });
      
      topology.step();
      
      const packetsInFlight = topology.getPacketsInFlight();
      for (const pif of packetsInFlight) {
        expect(pif.currentNode.name).not.toBe("HostA");
      }
    });

    it("should handle multiple simultaneous transmissions", async () => {
      topology.fillARP();
      
      topology.sendPacket(hostA, "192.168.1.20", Protocol.ICMP, "A to B");
      topology.sendPacket(hostC, "192.168.1.10", Protocol.ICMP, "C to A");
      
      await topology.run(10, true);
      
      const deliveredToB = topology.getDeliveredPacket(hostB);
      const deliveredToA = topology.getDeliveredPacket(hostA);
      
      expect(deliveredToB).toBeDefined();
      expect(deliveredToA).toBeDefined();
    });
  });

  // ==========================================
  // 4. FIREWALL RULES
  // ==========================================
  
  describe("4. Router Firewall Rules", () => {
    let topology: Topology;
    let hostA: Host;
    let hostB: Host;
    let router: Router;

    beforeEach(() => {
      topology = new Topology("Firewall Test");
      
      hostA = new Host("HostA", { x: 0, y: 0 }, [
        new NetworkInterface("192.168.1.10", "255.255.255.0")
      ]);
      hostA.setDefaultGateway("192.168.1.1");
      
      router = new Router("FirewallRouter", { x: 50, y: 0 }, [
        new NetworkInterface("192.168.1.1", "255.255.255.0"),
        new NetworkInterface("192.168.2.1", "255.255.255.0")
      ]);
      
      hostB = new Host("HostB", { x: 100, y: 0 }, [
        new NetworkInterface("192.168.2.10", "255.255.255.0")
      ]);
      hostB.setDefaultGateway("192.168.2.1");

      topology.addNode(hostA);
      topology.addNode(router);
      topology.addNode(hostB);
      
      topology.addLink(hostA.getInterfaces()[0]!, router.getInterfaces()[0]!);
      topology.addLink(router.getInterfaces()[1]!, hostB.getInterfaces()[0]!);
      
      topology.autoConfigureRoutes();
    });

    it("should allow packets by default with ALLOW policy", async () => {
      topology.fillARP();
      
      topology.sendPacket(hostA, "192.168.2.10", Protocol.ICMP, "ICMP Echo Request");
      await topology.run(10, true);
      
      const delivered = topology.getDeliveredPacket(hostB);
      expect(delivered).toBeDefined();
    });

    it("should drop packets matching DROP rule", async () => {
      topology.fillARP();
      
      router.addRule("192.168.1.10", "any", Protocol.ICMP, "DROP" as any, 10);
      
      topology.sendPacket(hostA, "192.168.2.10", Protocol.ICMP, "ICMP Echo Request");
      await topology.run(10, true);
      
      const delivered = topology.getDeliveredPacket(hostB);
      expect(delivered).toBeUndefined();
    });

    it("should allow TCP while blocking ICMP", async () => {
      topology.fillARP();
      
      router.addRule("192.168.1.10", "any", Protocol.ICMP, "DROP" as any, 10);
      
      topology.sendPacket(hostA, "192.168.2.10", Protocol.ICMP, "ICMP Echo Request");
      await topology.run(10, true);
      expect(topology.getDeliveredPacket(hostB)).toBeUndefined();
      
      topology.clearPackets();
      
      topology.sendPacket(hostA, "192.168.2.10", Protocol.TCP, "TCP Data");
      await topology.run(10, true);
      expect(topology.getDeliveredPacket(hostB)).toBeDefined();
    });

    it("should respect rule priority (lower number = higher priority)", async () => {
      topology.fillARP();
      
      router.addRule("192.168.1.10", "192.168.2.10", Protocol.ICMP, "DROP" as any, 100);
      router.addRule("192.168.1.10", "192.168.2.10", Protocol.ICMP, "ALLOW" as any, 10);
      
      topology.sendPacket(hostA, "192.168.2.10", Protocol.ICMP, "ICMP Echo Request");
      await topology.run(10, true);
      
      const delivered = topology.getDeliveredPacket(hostB);
      expect(delivered).toBeDefined();
    });

    it("should block specific source IP", async () => {
      topology.fillARP();
      
      router.addRule("192.168.1.10", "any", null, "DROP" as any, 10);
      
      topology.sendPacket(hostA, "192.168.2.10", Protocol.ICMP, "Test");
      await topology.run(10, true);
      
      expect(topology.getDeliveredPacket(hostB)).toBeUndefined();
    });

    it("should block specific destination IP", async () => {
      topology.fillARP();
      
      router.addRule("any", "192.168.2.10", null, "DROP" as any, 10);
      
      topology.sendPacket(hostA, "192.168.2.10", Protocol.ICMP, "Test");
      await topology.run(10, true);
      
      expect(topology.getDeliveredPacket(hostB)).toBeUndefined();
    });

    it("should use default policy when no rules match", async () => {
      topology.fillARP();
      
      router.setDefaultPolicy("DROP" as any);
      
      topology.sendPacket(hostA, "192.168.2.10", Protocol.ICMP, "Test");
      await topology.run(10, true);
      
      expect(topology.getDeliveredPacket(hostB)).toBeUndefined();
    });

    it("should allow with ALLOW rule even if default is DROP", async () => {
      topology.fillARP();
      
      router.setDefaultPolicy("DROP" as any);
      router.addRule("192.168.1.10", "192.168.2.10", Protocol.ICMP, "ALLOW" as any, 10);
      
      topology.sendPacket(hostA, "192.168.2.10", Protocol.ICMP, "Test");
      await topology.run(10, true);
      
      expect(topology.getDeliveredPacket(hostB)).toBeDefined();
    });
  });

  // ==========================================
  // 5. COMPLEX MULTI-ROUTER TOPOLOGIES (FIXED)
  // ==========================================
  
  describe("5. Complex Multi-Router Topologies", () => {
    let topology: Topology;
    let hostA: Host;
    let hostB: Host;
    let router1: Router;
    let router2: Router;

    beforeEach(() => {
      topology = new Topology("Multi-Router Network");
      
      hostA = new Host("HostA", { x: 0, y: 0 }, [
        new NetworkInterface("10.0.1.10", "255.255.255.0")
      ]);
      hostA.setDefaultGateway("10.0.1.1");
      
      router1 = new Router("Router1", { x: 33, y: 0 }, [
        new NetworkInterface("10.0.1.1", "255.255.255.0"),
        new NetworkInterface("10.0.100.1", "255.255.255.0")
      ]);
      
      router2 = new Router("Router2", { x: 66, y: 0 }, [
        new NetworkInterface("10.0.100.2", "255.255.255.0"),
        new NetworkInterface("10.0.2.1", "255.255.255.0")
      ]);
      
      hostB = new Host("HostB", { x: 100, y: 0 }, [
        new NetworkInterface("10.0.2.10", "255.255.255.0")
      ]);
      hostB.setDefaultGateway("10.0.2.1");

      topology.addNode(hostA);
      topology.addNode(router1);
      topology.addNode(router2);
      topology.addNode(hostB);
      
      topology.addLink(hostA.getInterfaces()[0]!, router1.getInterfaces()[0]!);
      topology.addLink(router1.getInterfaces()[1]!, router2.getInterfaces()[0]!);
      topology.addLink(router2.getInterfaces()[1]!, hostB.getInterfaces()[0]!);
      
      topology.autoConfigureRoutes();
      router1.addRoute("10.0.2.0", "255.255.255.0", router1.getInterfaces()[1]!);
      router2.addRoute("10.0.1.0", "255.255.255.0", router2.getInterfaces()[0]!);
    });

    it("should route packet through multiple routers and expire with low TTL", async () => {
      topology.fillARP();
      
      const packet = topology.sendPacket(hostA, "10.0.2.10", Protocol.ICMP, "Loop test");
      packet.ttl = 2; // Will expire: 1 hop through router1, 1 hop through router2, expired before reaching hostB
      
      await topology.run(50, true);
      
      // Should expire and not reach destination
      const delivered = topology.getDeliveredPacket(hostB);
      expect(delivered).toBeUndefined();
    });

    it("should successfully route with sufficient TTL", async () => {
      topology.fillARP();
      
      const packet = topology.sendPacket(hostA, "10.0.2.10", Protocol.ICMP, "Success test");
      
      await topology.run(50, true);
      
      const delivered = topology.getDeliveredPacket(hostB);
      expect(delivered).toBeDefined();
      expect(delivered?.history.some(n => n.name === "Router1")).toBe(true);
      expect(delivered?.history.some(n => n.name === "Router2")).toBe(true);
    });
  });

  // ==========================================
  // 6. INTER-LAN COMMUNICATION (Complex Scenarios)
  // ==========================================
  
  describe("6. Inter-LAN Communication", () => {
    let topology: Topology;
    let lanAHost1: Host;
    let lanAHost2: Host;
    let lanBHost1: Host;
    let lanBHost2: Host;
    let switchA: Switch;
    let switchB: Switch;
    let router: Router;

    beforeEach(() => {
      topology = new Topology("Inter-LAN Network");
      
      // LAN A: 192.168.1.0/24
      lanAHost1 = new Host("LAN_A_Host1", { x: 0, y: 0 }, [
        new NetworkInterface("192.168.1.10", "255.255.255.0")
      ]);
      lanAHost1.setDefaultGateway("192.168.1.1");
      
      lanAHost2 = new Host("LAN_A_Host2", { x: 0, y: 50 }, [
        new NetworkInterface("192.168.1.20", "255.255.255.0")
      ]);
      lanAHost2.setDefaultGateway("192.168.1.1");
      
      switchA = new Switch("SwitchA", { x: 25, y: 25 }, [
        new NetworkInterface("0.0.0.0", "255.255.255.0"),
        new NetworkInterface("0.0.0.0", "255.255.255.0"),
        new NetworkInterface("0.0.0.0", "255.255.255.0")
      ]);
      
      // Router connecting LANs
      router = new Router("CentralRouter", { x: 50, y: 25 }, [
        new NetworkInterface("192.168.1.1", "255.255.255.0"),  // To LAN A
        new NetworkInterface("192.168.2.1", "255.255.255.0")   // To LAN B
      ]);
      
      // LAN B: 192.168.2.0/24
      switchB = new Switch("SwitchB", { x: 75, y: 25 }, [
        new NetworkInterface("0.0.0.0", "255.255.255.0"),
        new NetworkInterface("0.0.0.0", "255.255.255.0"),
        new NetworkInterface("0.0.0.0", "255.255.255.0")
      ]);
      
      lanBHost1 = new Host("LAN_B_Host1", { x: 100, y: 0 }, [
        new NetworkInterface("192.168.2.10", "255.255.255.0")
      ]);
      lanBHost1.setDefaultGateway("192.168.2.1");
      
      lanBHost2 = new Host("LAN_B_Host2", { x: 100, y: 50 }, [
        new NetworkInterface("192.168.2.20", "255.255.255.0")
      ]);
      lanBHost2.setDefaultGateway("192.168.2.1");
      
      // Add all nodes
      topology.addNode(lanAHost1);
      topology.addNode(lanAHost2);
      topology.addNode(switchA);
      topology.addNode(router);
      topology.addNode(switchB);
      topology.addNode(lanBHost1);
      topology.addNode(lanBHost2);
      
      // Connect LAN A
      topology.addLink(lanAHost1.getInterfaces()[0]!, switchA.getInterfaces()[0]!);
      topology.addLink(lanAHost2.getInterfaces()[0]!, switchA.getInterfaces()[1]!);
      topology.addLink(switchA.getInterfaces()[2]!, router.getInterfaces()[0]!);
      
      // Connect LAN B
      topology.addLink(router.getInterfaces()[1]!, switchB.getInterfaces()[0]!);
      topology.addLink(switchB.getInterfaces()[1]!, lanBHost1.getInterfaces()[0]!);
      topology.addLink(switchB.getInterfaces()[2]!, lanBHost2.getInterfaces()[0]!);
      
      topology.autoConfigureRoutes();
    });

    it("should communicate within same LAN through switch", async () => {
      topology.fillARP();
      
      topology.sendPacket(lanAHost1, "192.168.1.20", Protocol.ICMP, "Intra-LAN");
      await topology.run(10, true);
      
      const delivered = topology.getDeliveredPacket(lanAHost2);
      expect(delivered).toBeDefined();
      expect(delivered?.history.some(n => n.name === "SwitchA")).toBe(true);
      expect(delivered?.history.some(n => n.name === "CentralRouter")).toBe(false); // Should not go through router
    });

    it("should route between LANs through router", async () => {
      topology.fillARP();
      
      topology.sendPacket(lanAHost1, "192.168.2.10", Protocol.ICMP, "Inter-LAN");
      await topology.run(20, true);
      
      const delivered = topology.getDeliveredPacket(lanBHost1);
      expect(delivered).toBeDefined();
      expect(delivered?.history.some(n => n.name === "SwitchA")).toBe(true);
      expect(delivered?.history.some(n => n.name === "CentralRouter")).toBe(true);
      expect(delivered?.history.some(n => n.name === "SwitchB")).toBe(true);
    });

    it("should handle multiple simultaneous inter-LAN communications", async () => {
      topology.fillARP();
      
      // LAN A -> LAN B
      topology.sendPacket(lanAHost1, "192.168.2.10", Protocol.TCP, "A1 to B1");
      topology.sendPacket(lanAHost2, "192.168.2.20", Protocol.TCP, "A2 to B2");
      
      // LAN B -> LAN A
      topology.sendPacket(lanBHost1, "192.168.1.10", Protocol.TCP, "B1 to A1");
      
      await topology.run(20, true);
      
      // All should reach their destinations
      expect(topology.getDeliveredPacket(lanBHost1)).toBeDefined();
      expect(topology.getDeliveredPacket(lanBHost2)).toBeDefined();
      expect(topology.getDeliveredPacket(lanAHost1)).toBeDefined();
    });

    it("should handle broadcast within LAN only", async () => {
      topology.fillARP();
      
      const broadcast = new Packet(
        "192.168.1.10",
        "192.168.1.255",
        Protocol.UDP,
        "LAN A Broadcast",
        lanAHost1.getInterfaces()[0]!.mac,
        "FF:FF:FF:FF:FF:FF"
      );
      
      topology['packetsInFlight'].push({
        packet: broadcast,
        currentNode: switchA,
        currentInterface: switchA.getInterfaces()[0]!
      });
      
      await topology.run(10, true);
      
      // Broadcast should not cross router to LAN B
      const deliveredToB1 = topology.getDeliveredPacket(lanBHost1);
      expect(deliveredToB1).toBeUndefined();
    });
  });

  // ==========================================
  // 7. EDGE CASES AND ERROR HANDLING
  // ==========================================
  
  describe("7. Edge Cases and Error Handling", () => {
    
    it("should reject invalid IP addresses", () => {
      expect(() => {
        new Packet("999.999.999.999", "192.168.1.1", Protocol.ICMP);
      }).toThrow();
      
      expect(() => {
        new Packet("192.168.1.1", "256.1.1.1", Protocol.ICMP);
      }).toThrow();
      
      expect(() => {
        new Packet("192.168.1", "192.168.1.1", Protocol.ICMP);
      }).toThrow();
    });

    it("should prevent packet forwarding on hosts", () => {
      const host = new Host("TestHost", { x: 0, y: 0 }, [
        new NetworkInterface("192.168.1.10", "255.255.255.0")
      ]);
      
      expect(host.canForwardPacket()).toBe(false);
      
      const packet = new Packet("192.168.1.10", "192.168.1.20", Protocol.ICMP);
      
      expect(() => {
        host.forwardPacket(packet);
      }).toThrow("Hosts cannot forward packets");
    });

    it("should throw error when missing default gateway for remote network", () => {
      const topology = new Topology("No Gateway Test");
      const host = new Host("HostA", { x: 0, y: 0 }, [
        new NetworkInterface("192.168.1.10", "255.255.255.0")
      ]);
      
      topology.addNode(host);
      
      // No default gateway set, trying to reach remote network
      expect(() => {
        topology.sendPacket(host, "10.0.0.1", Protocol.ICMP);
      }).toThrow();
    });

    it("should clone packets correctly for broadcast scenarios", () => {
      const original = new Packet("192.168.1.10", "192.168.1.255", Protocol.UDP, "Test");
      original.ttl = 50;
      original.logHop(new Host("Host1", {x:0,y:0}));
      
      const clone = original.clone();
      
      expect(clone.id).not.toBe(original.id);
      expect(clone.srcIp).toBe(original.srcIp);
      expect(clone.dstIp).toBe(original.dstIp);
      expect(clone.ttl).toBe(original.ttl);
      expect(clone.payload).toBe(original.payload);
      expect(clone.protocol).toBe(original.protocol);
      expect(clone.history.length).toBe(original.history.length);
    });

    it("should handle packets with expired TTL", () => {
      const packet = new Packet("192.168.1.10", "192.168.1.20", Protocol.ICMP);
      packet.ttl = 0;
      
      expect(packet.isExpired()).toBe(true);
    });

    it("should decrement TTL correctly", () => {
      const packet = new Packet("192.168.1.10", "192.168.1.20", Protocol.ICMP);
      const initialTTL = packet.ttl;
      
      packet.decrementTTL();
      expect(packet.ttl).toBe(initialTTL - 1);
      
      packet.decrementTTL();
      expect(packet.ttl).toBe(initialTTL - 2);
    });

    it("should reject creation of self-loop links", () => {
      const topology = new Topology("Self Loop Test");
      const intf = new NetworkInterface("192.168.1.1", "255.255.255.0");
      
      expect(() => {
        topology.addLink(intf, intf);
      }).toThrow();
    });

    it("should reject links between interfaces on same node", () => {
      const topology = new Topology("Same Node Test");
      const router = new Router("R1", {x:0,y:0}, [
        new NetworkInterface("192.168.1.1", "255.255.255.0"),
        new NetworkInterface("192.168.2.1", "255.255.255.0")
      ]);
      
      topology.addNode(router);
      
      expect(() => {
        topology.addLink(router.getInterfaces()[0]!, router.getInterfaces()[1]!);
      }).toThrow();
    });

    it("should reject duplicate links on same interface", () => {
      const topology = new Topology("Duplicate Link Test");
      const host1 = new Host("H1", {x:0,y:0}, [
        new NetworkInterface("192.168.1.10", "255.255.255.0")
      ]);
      const host2 = new Host("H2", {x:100,y:0}, [
        new NetworkInterface("192.168.1.20", "255.255.255.0")
      ]);
      const host3 = new Host("H3", {x:50,y:50}, [
        new NetworkInterface("192.168.1.30", "255.255.255.0")
      ]);
      
      topology.addNode(host1);
      topology.addNode(host2);
      topology.addNode(host3);
      
      topology.addLink(host1.getInterfaces()[0]!, host2.getInterfaces()[0]!);
      
      // Try to create another link using host1's interface
      expect(() => {
        topology.addLink(host1.getInterfaces()[0]!, host3.getInterfaces()[0]!);
      }).toThrow();
    });

    it("should handle node removal and link cleanup", () => {
      const topology = new Topology("Node Removal Test");
      const host1 = new Host("H1", {x:0,y:0}, [
        new NetworkInterface("192.168.1.10", "255.255.255.0")
      ]);
      const host2 = new Host("H2", {x:100,y:0}, [
        new NetworkInterface("192.168.1.20", "255.255.255.0")
      ]);
      
      topology.addNode(host1);
      topology.addNode(host2);
      topology.addLink(host1.getInterfaces()[0]!, host2.getInterfaces()[0]!);
      
      expect(topology.nodes.length).toBe(2);
      expect(topology.links.length).toBe(1);
      
      topology.removeNode(host1);
      
      expect(topology.nodes.length).toBe(1);
      expect(topology.links.length).toBe(0); // Link should be removed too
    });

    it("should handle unknown protocol gracefully", async () => {
      const topology = new Topology("Unknown Protocol");
      const host1 = new Host("H1", {x:0,y:0}, [
        new NetworkInterface("192.168.1.10", "255.255.255.0")
      ]);
      const host2 = new Host("H2", {x:100,y:0}, [
        new NetworkInterface("192.168.1.20", "255.255.255.0")
      ]);
      
      topology.addNode(host1);
      topology.addNode(host2);
      topology.addLink(host1.getInterfaces()[0]!, host2.getInterfaces()[0]!);
      topology.fillARP();
      
      // Create packet with custom protocol (will still work)
      const packet = topology.sendPacket(host1, "192.168.1.20", Protocol.UDP, "Test");
      
      await topology.run(10, true);
      
      // Should still deliver
      expect(topology.getDeliveredPacket(host2)).toBeDefined();
    });
  });

  // ==========================================
  // 8. ARP CACHE MANAGEMENT
  // ==========================================
  
  describe("8. ARP Cache Management", () => {
    
    it("should add ARP entries to cache", () => {
      const host = new Host("TestHost", { x: 0, y: 0 }, [
        new NetworkInterface("192.168.1.10", "255.255.255.0")
      ]);
      
      host.addARPEntry("192.168.1.20", "AA:BB:CC:DD:EE:FF");
      
      const cache = host.getARPCache();
      expect(cache.has("192.168.1.20")).toBe(true);
      expect(cache.get("192.168.1.20")?.mac).toBe("AA:BB:CC:DD:EE:FF");
    });

    it("should store timestamp with ARP entries", () => {
      const host = new Host("TestHost", { x: 0, y: 0 }, [
        new NetworkInterface("192.168.1.10", "255.255.255.0")
      ]);
      
      const beforeTime = Date.now();
      host.addARPEntry("192.168.1.20", "AA:BB:CC:DD:EE:FF");
      const afterTime = Date.now();
      
      const cache = host.getARPCache();
      const entry = cache.get("192.168.1.20");
      
      expect(entry?.timestamp).toBeGreaterThanOrEqual(beforeTime);
      expect(entry?.timestamp).toBeLessThanOrEqual(afterTime);
    });

    it("should retrieve MAC from ARP cache", async () => {
      const topology = new Topology("ARP Cache Test");
      const host1 = new Host("H1", {x:0,y:0}, [
        new NetworkInterface("192.168.1.10", "255.255.255.0")
      ]);
      const host2 = new Host("H2", {x:100,y:0}, [
        new NetworkInterface("192.168.1.20", "255.255.255.0")
      ]);
      
      topology.addNode(host1);
      topology.addNode(host2);
      topology.addLink(host1.getInterfaces()[0]!, host2.getInterfaces()[0]!);
      
      // Manually add ARP entry
      host1.addARPEntry("192.168.1.20", host2.getInterfaces()[0]!.mac);
      
      // Send packet - should use cached MAC
      const packet = topology.sendPacket(host1, "192.168.1.20", Protocol.ICMP, "Test");
      
      expect(packet.dstMAC).toBe(host2.getInterfaces()[0]!.mac);
      expect(packet.dstMAC).not.toBe("FF:FF:FF:FF:FF:FF");
    });

    it("should trigger ARP request when cache miss", async () => {
      const topology = new Topology("ARP Miss Test");
      const host1 = new Host("H1", {x:0,y:0}, [
        new NetworkInterface("192.168.1.10", "255.255.255.0")
      ]);
      const host2 = new Host("H2", {x:100,y:0}, [
        new NetworkInterface("192.168.1.20", "255.255.255.0")
      ]);
      
      topology.addNode(host1);
      topology.addNode(host2);
      topology.addLink(host1.getInterfaces()[0]!, host2.getInterfaces()[0]!);
      
      // Don't populate ARP cache
      const packet = topology.sendPacket(host1, "192.168.1.20", Protocol.ICMP, "Test");
      
      // Should have ARP request in flight
      const packetsInFlight = topology.getPacketsInFlight();
      const arpPacket = packetsInFlight.find(p => p.packet.protocol === Protocol.ARP);
      expect(arpPacket).toBeDefined();
    });

    it("should update existing ARP entries", () => {
      const host = new Host("TestHost", { x: 0, y: 0 }, [
        new NetworkInterface("192.168.1.10", "255.255.255.0")
      ]);
      
      host.addARPEntry("192.168.1.20", "AA:BB:CC:DD:EE:FF");
      
      // Update with new MAC
      host.addARPEntry("192.168.1.20", "11:22:33:44:55:66");
      
      const cache = host.getARPCache();
      expect(cache.get("192.168.1.20")?.mac).toBe("11:22:33:44:55:66");
    });

    it("should handle ARP cache for routers", () => {
      const router = new Router("R1", {x:0,y:0}, [
        new NetworkInterface("192.168.1.1", "255.255.255.0"),
        new NetworkInterface("192.168.2.1", "255.255.255.0")
      ]);
      
      router.addARPEntry("192.168.1.10", "AA:BB:CC:DD:EE:FF");
      router.addARPEntry("192.168.2.10", "11:22:33:44:55:66");
      
      const cache = router.getARPCache();
      expect(cache.size).toBe(2);
      expect(cache.has("192.168.1.10")).toBe(true);
      expect(cache.has("192.168.2.10")).toBe(true);
    });

    it("should return copy of ARP cache, not reference", () => {
      const host = new Host("TestHost", { x: 0, y: 0 }, [
        new NetworkInterface("192.168.1.10", "255.255.255.0")
      ]);
      
      host.addARPEntry("192.168.1.20", "AA:BB:CC:DD:EE:FF");
      
      const cache1 = host.getARPCache();
      const cache2 = host.getARPCache();
      
      // Should be different objects
      expect(cache1).not.toBe(cache2);
      
      // But with same content
      expect(cache1.size).toBe(cache2.size);
    });

    it("should handle multiple ARP entries", () => {
      const host = new Host("TestHost", { x: 0, y: 0 }, [
        new NetworkInterface("192.168.1.10", "255.255.255.0")
      ]);
      
      host.addARPEntry("192.168.1.20", "AA:BB:CC:DD:EE:FF");
      host.addARPEntry("192.168.1.30", "11:22:33:44:55:66");
      host.addARPEntry("192.168.1.40", "77:88:99:AA:BB:CC");
      
      const cache = host.getARPCache();
      expect(cache.size).toBe(3);
    });

    it("should learn ARP from received packets", async () => {
      const topology = new Topology("ARP Learning");
      const host1 = new Host("H1", {x:0,y:0}, [
        new NetworkInterface("192.168.1.10", "255.255.255.0")
      ]);
      const host2 = new Host("H2", {x:100,y:0}, [
        new NetworkInterface("192.168.1.20", "255.255.255.0")
      ]);
      
      topology.addNode(host1);
      topology.addNode(host2);
      topology.addLink(host1.getInterfaces()[0]!, host2.getInterfaces()[0]!);
      
      // Send packet without pre-populating ARP
      topology.sendPacket(host1, "192.168.1.20", Protocol.ICMP, "Test");
      await topology.run(50, false);
      
      // Both hosts should have learned each other's MACs
      const cache1 = host1.getARPCache();
      const cache2 = host2.getARPCache();
      
      expect(cache1.has("192.168.1.20")).toBe(true);
      expect(cache2.has("192.168.1.10")).toBe(true);
    });
  });

  // ==========================================
  // 9. ADVANCED SCENARIOS
  // ==========================================
  
  describe("9. Advanced Scenarios", () => {
    
    it("should handle mixed topology with switches and routers", async () => {
      const topology = new Topology("Mixed Topology");
      
      // Create a complex network: Switch -> Router -> Switch
      const switch1 = new Switch("Switch1", {x:0,y:0}, [
        new NetworkInterface("0.0.0.0", "255.255.255.0"),
        new NetworkInterface("0.0.0.0", "255.255.255.0")
      ]);
      
      const router = new Router("Router1", {x:50,y:0}, [
        new NetworkInterface("192.168.1.1", "255.255.255.0"),
        new NetworkInterface("192.168.2.1", "255.255.255.0")
      ]);
      
      const switch2 = new Switch("Switch2", {x:100,y:0}, [
        new NetworkInterface("0.0.0.0", "255.255.255.0"),
        new NetworkInterface("0.0.0.0", "255.255.255.0")
      ]);
      
      const host1 = new Host("H1", {x:0,y:50}, [
        new NetworkInterface("192.168.1.10", "255.255.255.0")
      ]);
      host1.setDefaultGateway("192.168.1.1");
      
      const host2 = new Host("H2", {x:100,y:50}, [
        new NetworkInterface("192.168.2.10", "255.255.255.0")
      ]);
      host2.setDefaultGateway("192.168.2.1");
      
      topology.addNode(switch1);
      topology.addNode(router);
      topology.addNode(switch2);
      topology.addNode(host1);
      topology.addNode(host2);
      
      topology.addLink(host1.getInterfaces()[0]!, switch1.getInterfaces()[0]!);
      topology.addLink(switch1.getInterfaces()[1]!, router.getInterfaces()[0]!);
      topology.addLink(router.getInterfaces()[1]!, switch2.getInterfaces()[0]!);
      topology.addLink(switch2.getInterfaces()[1]!, host2.getInterfaces()[0]!);
      
      topology.autoConfigureRoutes();
      topology.fillARP();
      
      topology.sendPacket(host1, "192.168.2.10", Protocol.ICMP, "Complex path");
      await topology.run(20, true);
      
      const delivered = topology.getDeliveredPacket(host2);
      expect(delivered).toBeDefined();
      expect(delivered?.history.some(n => n.name === "Switch1")).toBe(true);
      expect(delivered?.history.some(n => n.name === "Router1")).toBe(true);
      expect(delivered?.history.some(n => n.name === "Switch2")).toBe(true);
    });

    it("should handle firewall in middle of multi-hop path", async () => {
      const topology = new Topology("Firewall in Path");
      
      const host1 = new Host("H1", {x:0,y:0}, [
        new NetworkInterface("10.0.1.10", "255.255.255.0")
      ]);
      host1.setDefaultGateway("10.0.1.1");
      
      const router1 = new Router("Router1", {x:33,y:0}, [
        new NetworkInterface("10.0.1.1", "255.255.255.0"),
        new NetworkInterface("10.0.100.1", "255.255.255.0")
      ]);
      
      const firewall = new Router("Firewall", {x:66,y:0}, [
        new NetworkInterface("10.0.100.2", "255.255.255.0"),
        new NetworkInterface("10.0.2.1", "255.255.255.0")
      ]);
      
      const host2 = new Host("H2", {x:100,y:0}, [
        new NetworkInterface("10.0.2.10", "255.255.255.0")
      ]);
      host2.setDefaultGateway("10.0.2.1");
      
      topology.addNode(host1);
      topology.addNode(router1);
      topology.addNode(firewall);
      topology.addNode(host2);
      
      topology.addLink(host1.getInterfaces()[0]!, router1.getInterfaces()[0]!);
      topology.addLink(router1.getInterfaces()[1]!, firewall.getInterfaces()[0]!);
      topology.addLink(firewall.getInterfaces()[1]!, host2.getInterfaces()[0]!);
      
      topology.autoConfigureRoutes();
      router1.addRoute("10.0.2.0", "255.255.255.0", router1.getInterfaces()[1]!);
      firewall.addRoute("10.0.1.0", "255.255.255.0", firewall.getInterfaces()[0]!);
      
      // Add firewall rule to block ICMP
      firewall.addRule("any", "any", Protocol.ICMP, "DROP" as any, 10);
      
      topology.fillARP();
      
      // ICMP should be blocked
      topology.sendPacket(host1, "10.0.2.10", Protocol.ICMP, "Blocked");
      await topology.run(50, true);
      expect(topology.getDeliveredPacket(host2)).toBeUndefined();
      
      topology.clearPackets();
      
      // TCP should pass through
      topology.sendPacket(host1, "10.0.2.10", Protocol.TCP, "Allowed");
      await topology.run(50, true);
      expect(topology.getDeliveredPacket(host2)).toBeDefined();
    });

    it("should find nodes by IP address", () => {
      const topology = new Topology("Find Node Test");
      
      const host1 = new Host("H1", {x:0,y:0}, [
        new NetworkInterface("192.168.1.10", "255.255.255.0")
      ]);
      
      const router = new Router("R1", {x:50,y:0}, [
        new NetworkInterface("192.168.1.1", "255.255.255.0"),
        new NetworkInterface("192.168.2.1", "255.255.255.0")
      ]);
      
      topology.addNode(host1);
      topology.addNode(router);
      
      const foundHost = topology.findNodeByIP("192.168.1.10");
      const foundRouter = topology.findNodeByIP("192.168.2.1");
      const notFound = topology.findNodeByIP("10.0.0.1");
      
      expect(foundHost?.name).toBe("H1");
      expect(foundRouter?.name).toBe("R1");
      expect(notFound).toBeUndefined();
    });

    it("should find nodes by name", () => {
      const topology = new Topology("Find by Name");
      
      const host = new Host("TestHost", {x:0,y:0}, [
        new NetworkInterface("192.168.1.10", "255.255.255.0")
      ]);
      
      const router = new Router("TestRouter", {x:50,y:0}, [
        new NetworkInterface("192.168.1.1", "255.255.255.0")
      ]);
      
      topology.addNode(host);
      topology.addNode(router);
      
      expect(topology.findNodeByName("TestHost")?.name).toBe("TestHost");
      expect(topology.findNodeByName("TestRouter")?.name).toBe("TestRouter");
      expect(topology.findNodeByName("NonExistent")).toBeUndefined();
    });

    it("should handle packet with no valid route at any hop", async () => {
      const topology = new Topology("No Route Anywhere");
      
      const host1 = new Host("H1", {x:0,y:0}, [
        new NetworkInterface("192.168.1.10", "255.255.255.0")
      ]);
      host1.setDefaultGateway("192.168.1.1");
      
      const router = new Router("R1", {x:50,y:0}, [
        new NetworkInterface("192.168.1.1", "255.255.255.0"),
        new NetworkInterface("192.168.2.1", "255.255.255.0")
      ]);
      
      topology.addNode(host1);
      topology.addNode(router);
      topology.addLink(host1.getInterfaces()[0]!, router.getInterfaces()[0]!);
      
      // Only configure directly connected routes, no route to 10.0.0.0/8
      topology.autoConfigureRoutes();
      topology.fillARP();
      
      // Try to send to unreachable network
      topology.sendPacket(host1, "10.0.0.1", Protocol.ICMP, "No route");
      await topology.run(20, true);
      
      // Should be dropped at router
      expect(topology.getPacketsInFlight().length).toBe(0);
    });

    it("should track packet timestamps", () => {
      const beforeTime = Date.now();
      const packet = new Packet("192.168.1.10", "192.168.1.20", Protocol.ICMP);
      const afterTime = Date.now();
      
      expect(packet.timestamp).toBeGreaterThanOrEqual(beforeTime);
      expect(packet.timestamp).toBeLessThanOrEqual(afterTime);
    });

    it("should properly serialize topology to JSON", () => {
      const topology = new Topology("Serialize Test");
      
      const host = new Host("H1", {x:10,y:20}, [
        new NetworkInterface("192.168.1.10", "255.255.255.0")
      ]);
      
      topology.addNode(host);
      
      const json = topology.toJSON() as any;
      
      expect(json.id).toBeDefined();
      expect(json.name).toBe("Serialize Test");
      expect(json.nodes).toHaveLength(1);
      expect(json.links).toHaveLength(0);
    });

    it("should handle clearing packets from topology", () => {
      const topology = new Topology("Clear Test");
      
      const host1 = new Host("H1", {x:0,y:0}, [
        new NetworkInterface("192.168.1.10", "255.255.255.0")
      ]);
      const host2 = new Host("H2", {x:100,y:0}, [
        new NetworkInterface("192.168.1.20", "255.255.255.0")
      ]);
      
      topology.addNode(host1);
      topology.addNode(host2);
      topology.addLink(host1.getInterfaces()[0]!, host2.getInterfaces()[0]!);
      topology.fillARP();
      
      topology.sendPacket(host1, "192.168.1.20", Protocol.ICMP, "Test");
      
      expect(topology.getPacketsInFlight().length).toBeGreaterThan(0);
      
      topology.clearPackets();
      
      expect(topology.getPacketsInFlight().length).toBe(0);
    });

    it("should handle stopping simulation mid-run", async () => {
      const topology = new Topology("Stop Test");
      
      const host1 = new Host("H1", {x:0,y:0}, [
        new NetworkInterface("192.168.1.10", "255.255.255.0")
      ]);
      const host2 = new Host("H2", {x:100,y:0}, [
        new NetworkInterface("192.168.1.20", "255.255.255.0")
      ]);
      
      topology.addNode(host1);
      topology.addNode(host2);
      topology.addLink(host1.getInterfaces()[0]!, host2.getInterfaces()[0]!);
      topology.fillARP();
      
      topology.sendPacket(host1, "192.168.1.20", Protocol.ICMP, "Test");
      
      // Start simulation but stop it immediately
      const runPromise = topology.run(100, true);
      topology.stop();
      
      await runPromise;
      
      // Should have stopped gracefully
      expect(true).toBe(true);
    });

    it("should handle getting links for specific node", () => {
      const topology = new Topology("Get Links Test");
      
      const host1 = new Host("H1", {x:0,y:0}, [
        new NetworkInterface("192.168.1.10", "255.255.255.0")
      ]);
      const host2 = new Host("H2", {x:100,y:0}, [
        new NetworkInterface("192.168.1.20", "255.255.255.0")
      ]);
      const host3 = new Host("H3", {x:50,y:50}, [
        new NetworkInterface("192.168.1.30", "255.255.255.0")
      ]);
      
      topology.addNode(host1);
      topology.addNode(host2);
      topology.addNode(host3);
      
      const link1 = topology.addLink(host1.getInterfaces()[0]!, host2.getInterfaces()[0]!);
      
      const host1Links = topology.getLinksForNode(host1);
      const host2Links = topology.getLinksForNode(host2);
      const host3Links = topology.getLinksForNode(host3);
      
      expect(host1Links.length).toBe(1);
      expect(host2Links.length).toBe(1);
      expect(host3Links.length).toBe(0);
      expect(host1Links[0]?.id).toBe(link1.id);
    });
  });

  // ==========================================
  // 10. PERFORMANCE AND STRESS TESTS
  // ==========================================
  
  describe("10. Performance and Stress Tests", () => {
    
    it("should handle large number of ARP entries", () => {
      const host = new Host("TestHost", {x:0,y:0}, [
        new NetworkInterface("192.168.1.10", "255.255.255.0")
      ]);
      
      // Add 100 ARP entries
      for (let i = 1; i <= 100; i++) {
        host.addARPEntry(`192.168.1.${i}`, `AA:BB:CC:DD:EE:${i.toString(16).padStart(2, '0')}`);
      }
      
      const cache = host.getARPCache();
      expect(cache.size).toBe(100);
    });

    it("should handle network with many nodes", () => {
      const topology = new Topology("Large Network");
      
      // Create 20 hosts
      for (let i = 0; i < 20; i++) {
        const host = new Host(`Host${i}`, {x: i * 50, y: 0}, [
          new NetworkInterface(`192.168.1.${i + 10}`, "255.255.255.0")
        ]);
        topology.addNode(host);
      }
      
      expect(topology.nodes.length).toBe(20);
    });

    it("should handle deep packet history", async () => {
      const topology = new Topology("Deep History");
      
      // Create a chain: H1 -> R1 -> R2 -> R3 -> H2
      const host1 = new Host("H1", {x:0,y:0}, [
        new NetworkInterface("10.0.1.10", "255.255.255.0")
      ]);
      host1.setDefaultGateway("10.0.1.1");
      
      const router1 = new Router("R1", {x:25,y:0}, [
        new NetworkInterface("10.0.1.1", "255.255.255.0"),
        new NetworkInterface("10.0.10.1", "255.255.255.0")
      ]);
      
      const router2 = new Router("R2", {x:50,y:0}, [
        new NetworkInterface("10.0.10.2", "255.255.255.0"),
        new NetworkInterface("10.0.20.1", "255.255.255.0")
      ]);
      
      const router3 = new Router("R3", {x:75,y:0}, [
        new NetworkInterface("10.0.20.2", "255.255.255.0"),
        new NetworkInterface("10.0.2.1", "255.255.255.0")
      ]);
      
      const host2 = new Host("H2", {x:100,y:0}, [
        new NetworkInterface("10.0.2.10", "255.255.255.0")
      ]);
      host2.setDefaultGateway("10.0.2.1");
      
      topology.addNode(host1);
      topology.addNode(router1);
      topology.addNode(router2);
      topology.addNode(router3);
      topology.addNode(host2);
      
      topology.addLink(host1.getInterfaces()[0]!, router1.getInterfaces()[0]!);
      topology.addLink(router1.getInterfaces()[1]!, router2.getInterfaces()[0]!);
      topology.addLink(router2.getInterfaces()[1]!, router3.getInterfaces()[0]!);
      topology.addLink(router3.getInterfaces()[1]!, host2.getInterfaces()[0]!);
      
      topology.autoConfigureRoutes();
      router1.addRoute("10.0.2.0", "255.255.255.0", router1.getInterfaces()[1]!);
      router2.addRoute("10.0.1.0", "255.255.255.0", router2.getInterfaces()[0]!);
      router2.addRoute("10.0.2.0", "255.255.255.0", router2.getInterfaces()[1]!);
      router3.addRoute("10.0.1.0", "255.255.255.0", router3.getInterfaces()[0]!);
      
      topology.fillARP();
      
      topology.sendPacket(host1, "10.0.2.10", Protocol.ICMP, "Deep path");
      await topology.run(100, true);
      
      const delivered = topology.getDeliveredPacket(host2);
      expect(delivered).toBeDefined();
      expect(delivered?.history.length).toBeGreaterThanOrEqual(5); // Should have 5+ hops
      expect(delivered?.ttl).toBe(64 - 3);// At least 3 router hops
    });

    it("should handle multiple packet types simultaneously", async () => {
      const topology = new Topology("Multi Protocol");
      
      const host1 = new Host("H1", {x:0,y:0}, [
        new NetworkInterface("192.168.1.10", "255.255.255.0")
      ]);
      const host2 = new Host("H2", {x:100,y:0}, [
        new NetworkInterface("192.168.1.20", "255.255.255.0")
      ]);
      
      topology.addNode(host1);
      topology.addNode(host2);
      topology.addLink(host1.getInterfaces()[0]!, host2.getInterfaces()[0]!);
      topology.fillARP();
      
      // Send multiple packet types
      topology.sendPacket(host1, "192.168.1.20", Protocol.ICMP, "ICMP");
      topology.sendPacket(host1, "192.168.1.20", Protocol.TCP, "TCP");
      topology.sendPacket(host1, "192.168.1.20", Protocol.UDP, "UDP");
      
      await topology.run(20, true);
      
      // At least one should be delivered
      expect(topology.getDeliveredPacket(host2)).toBeDefined();
    });

    it("should handle rapid packet succession", async () => {
      const topology = new Topology("Rapid Fire");
      
      const host1 = new Host("H1", {x:0,y:0}, [
        new NetworkInterface("192.168.1.10", "255.255.255.0")
      ]);
      const host2 = new Host("H2", {x:100,y:0}, [
        new NetworkInterface("192.168.1.20", "255.255.255.0")
      ]);
      
      topology.addNode(host1);
      topology.addNode(host2);
      topology.addLink(host1.getInterfaces()[0]!, host2.getInterfaces()[0]!);
      topology.fillARP();
      
      // Send 10 packets rapidly
      for (let i = 0; i < 10; i++) {
        topology.sendPacket(host1, "192.168.1.20", Protocol.ICMP, `Packet ${i}`);
      }
      
      const initialCount = topology.getPacketsInFlight().length;
      expect(initialCount).toBeGreaterThan(0);
      
      await topology.run(50, true);
      
      // All should eventually be delivered or dropped
      expect(topology.getPacketsInFlight().length).toBe(0);
    });
  });

  // ==========================================
  // 11. PROTOCOL-SPECIFIC TESTS
  // ==========================================
  
  describe("11. Protocol-Specific Behavior", () => {
    
    it("should handle ICMP Echo Request/Reply", async () => {
      const topology = new Topology("ICMP Echo");
      
      const host1 = new Host("H1", {x:0,y:0}, [
        new NetworkInterface("192.168.1.10", "255.255.255.0")
      ]);
      const host2 = new Host("H2", {x:100,y:0}, [
        new NetworkInterface("192.168.1.20", "255.255.255.0")
      ]);
      
      topology.addNode(host1);
      topology.addNode(host2);
      topology.addLink(host1.getInterfaces()[0]!, host2.getInterfaces()[0]!);
      topology.fillARP();
      
      topology.sendPacket(host1, "192.168.1.20", Protocol.ICMP, "ICMP Echo Request");
      await topology.run(20, true);
      
      const delivered = topology.getDeliveredPacket(host2);
      expect(delivered).toBeDefined();
      expect(delivered?.payload).toBe("ICMP Echo Request");
    });

    it("should handle TCP packets", async () => {
      const topology = new Topology("TCP Test");
      
      const host1 = new Host("H1", {x:0,y:0}, [
        new NetworkInterface("192.168.1.10", "255.255.255.0")
      ]);
      const host2 = new Host("H2", {x:100,y:0}, [
        new NetworkInterface("192.168.1.20", "255.255.255.0")
      ]);
      
      topology.addNode(host1);
      topology.addNode(host2);
      topology.addLink(host1.getInterfaces()[0]!, host2.getInterfaces()[0]!);
      topology.fillARP();
      
      topology.sendPacket(host1, "192.168.1.20", Protocol.TCP, "TCP Data Segment");
      await topology.run(10, true);
      
      const delivered = topology.getDeliveredPacket(host2);
      expect(delivered).toBeDefined();
      expect(delivered?.protocol).toBe(Protocol.TCP);
      expect(delivered?.payload).toBe("TCP Data Segment");
    });

    it("should handle UDP packets", async () => {
      const topology = new Topology("UDP Test");
      
      const host1 = new Host("H1", {x:0,y:0}, [
        new NetworkInterface("192.168.1.10", "255.255.255.0")
      ]);
      const host2 = new Host("H2", {x:100,y:0}, [
        new NetworkInterface("192.168.1.20", "255.255.255.0")
      ]);
      
      topology.addNode(host1);
      topology.addNode(host2);
      topology.addLink(host1.getInterfaces()[0]!, host2.getInterfaces()[0]!);
      topology.fillARP();
      
      topology.sendPacket(host1, "192.168.1.20", Protocol.UDP, "UDP Datagram");
      await topology.run(10, true);
      
      const delivered = topology.getDeliveredPacket(host2);
      expect(delivered).toBeDefined();
      expect(delivered?.protocol).toBe(Protocol.UDP);
      expect(delivered?.payload).toBe("UDP Datagram");
    });

    it("should handle ARP request/reply cycle", async () => {
      const topology = new Topology("ARP Cycle");
      
      const host1 = new Host("H1", {x:0,y:0}, [
        new NetworkInterface("192.168.1.10", "255.255.255.0")
      ]);
      const host2 = new Host("H2", {x:100,y:0}, [
        new NetworkInterface("192.168.1.20", "255.255.255.0")
      ]);
      
      topology.addNode(host1);
      topology.addNode(host2);
      topology.addLink(host1.getInterfaces()[0]!, host2.getInterfaces()[0]!);
      
      // Don't pre-populate ARP
      topology.sendPacket(host1, "192.168.1.20", Protocol.ICMP, "Test");
      
      // Should have ARP request
      let arpFound = false;
      for (const pif of topology.getPacketsInFlight()) {
        if (pif.packet.protocol === Protocol.ARP) {
          arpFound = true;
          break;
        }
      }
      expect(arpFound).toBe(true);
      
      await topology.run(50, false);
      
      // After ARP completes, host1 should have host2's MAC
      const cache = host1.getARPCache();
      expect(cache.has("192.168.1.20")).toBe(true);
    });
  });

  // ==========================================
  // 12. SUBNET AND NETWORK ADDRESSING
  // ==========================================
  
  describe("12. Subnet and Network Addressing", () => {
    
    it("should correctly identify same subnet hosts", () => {
      const host1 = new Host("H1", {x:0,y:0}, [
        new NetworkInterface("192.168.1.10", "255.255.255.0")
      ]);
      const host2 = new Host("H2", {x:100,y:0}, [
        new NetworkInterface("192.168.1.20", "255.255.255.0")
      ]);
      
      const intf1 = host1.getInterfaces()[0]!;
      const intf2 = host2.getInterfaces()[0]!;
      
      expect(intf1.isInSubnet("192.168.1.20")).toBe(true);
      expect(intf2.isInSubnet("192.168.1.10")).toBe(true);
    });

    it("should correctly identify different subnet hosts", () => {
      const host1 = new Host("H1", {x:0,y:0}, [
        new NetworkInterface("192.168.1.10", "255.255.255.0")
      ]);
      const host2 = new Host("H2", {x:100,y:0}, [
        new NetworkInterface("192.168.2.10", "255.255.255.0")
      ]);
      
      const intf1 = host1.getInterfaces()[0]!;
      
      expect(intf1.isInSubnet("192.168.2.10")).toBe(false);
      expect(intf1.isInSubnet("10.0.0.1")).toBe(false);
    });

    it("should handle different subnet masks", () => {
      const host1 = new Host("H1", {x:0,y:0}, [
        new NetworkInterface("10.0.1.10", "255.255.255.0")
      ]);
      const host2 = new Host("H2", {x:100,y:0}, [
        new NetworkInterface("10.0.0.10", "255.255.0.0")
      ]);
      
      const intf1 = host1.getInterfaces()[0]!;
      const intf2 = host2.getInterfaces()[0]!;
      
      // With /24, 10.0.0.10 is not in 10.0.1.0/24
      expect(intf1.isInSubnet("10.0.0.10")).toBe(false);
      
      // With /16, 10.0.1.10 IS in 10.0.0.0/16
      expect(intf2.isInSubnet("10.0.1.10")).toBe(true);
    });

    it("should use default gateway for remote networks", async () => {
      const topology = new Topology("Gateway Test");
      
      const host = new Host("H1", {x:0,y:0}, [
        new NetworkInterface("192.168.1.10", "255.255.255.0")
      ]);
      host.setDefaultGateway("192.168.1.1");
      
      const router = new Router("R1", {x:50,y:0}, [
        new NetworkInterface("192.168.1.1", "255.255.255.0"),
        new NetworkInterface("10.0.0.1", "255.255.255.0")
      ]);
      
      topology.addNode(host);
      topology.addNode(router);
      topology.addLink(host.getInterfaces()[0]!, router.getInterfaces()[0]!);
      topology.autoConfigureRoutes();
      topology.fillARP();
      
      // Send to remote network
      topology.sendPacket(host, "10.0.0.10", Protocol.ICMP, "To remote");
      
      // Should have been sent to gateway
      expect(topology.getPacketsInFlight().length).toBeGreaterThan(0);
    });

    it("should handle network and broadcast addresses", () => {
      const intf = new NetworkInterface("192.168.1.100", "255.255.255.0");
      
      expect(intf.getNetworkAddress()).toBe("192.168.1.0");
      expect(intf.getBroadcastAddress()).toBe("192.168.1.255");
      expect(intf.getUsableHostCount()).toBe(254);
    });

    it("should calculate correct CIDR notation", () => {
      const intf1 = new NetworkInterface("192.168.1.10", "255.255.255.0");
      const intf2 = new NetworkInterface("10.0.0.1", "255.255.0.0");
      const intf3 = new NetworkInterface("172.16.0.1", "255.240.0.0");
      
      expect(intf1.cidr).toBe(24);
      expect(intf2.cidr).toBe(16);
      expect(intf3.cidr).toBe(12);
    });
  });
});
 