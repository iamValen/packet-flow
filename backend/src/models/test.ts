import { Topology } from './Topology.js';
import { Host } from './Host.js';
import { Router } from './Router.js';
import { Switch } from './Switch.js';
import { NetworkInterface } from './NetworkInterface.js';

const topology = new Topology("Broadcast Test");

// Create nodes
const host1 = new Host("PC1", {x: 100, y: 100}, [
    NetworkInterface.fromCIDR("192.168.1.10/24")
]);
const switch1 = new Switch("Switch1", {x: 200, y: 100}, [
    NetworkInterface.fromCIDR("192.168.1.1/24"),
    NetworkInterface.fromCIDR("192.168.1.2/24"),
    NetworkInterface.fromCIDR("192.168.1.3/24")
]);
const host2 = new Host("PC2", {x: 300, y: 100}, [
    NetworkInterface.fromCIDR("192.168.1.20/24")
]);
const host3 = new Host("PC3", {x: 300, y: 200}, [
    NetworkInterface.fromCIDR("192.168.1.30/24")
]);

// Add to topology
topology.addNode(host1);
topology.addNode(switch1);
topology.addNode(host2);
topology.addNode(host3);

// Connect them
topology.addLink(host1.interfaces[0]!, switch1.interfaces[0]!);
topology.addLink(switch1.interfaces[1]!, host2.interfaces[0]!);
topology.addLink(switch1.interfaces[2]!, host3.interfaces[0]!);

// Send broadcast packet
topology.sendPacket(host1, "192.168.1.20", "ICMP", "Hello");
topology.step(); // Watch it flood to all ports!
topology.step(); // Watch it flood to all ports!

/*You should see output like:
📡 Packet 12345678 flooding from Switch1 to 2 ports
  ↳ Clone abcd1234: Switch1 → PC2 (TTL: 63)
  ↳ Clone efgh5678: Switch1 → PC3 (TTL: 63)*/