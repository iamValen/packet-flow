import { NetworkInterface } from "./components/NetworkInterface.js";

console.log("--- Manual Tests for IPUtils.isValidIP ---");

const ipTests: string[] = [
  "192.168.0.1",    // valid
  "192.168.1.1",    // valid
  "0.0.0.0",        // valid
  "255.255.255.255",// valid
  "256.0.0.1",      // invalid
  "10.0.0",         // invalid
  "192.168.1.256",  // invalid
  "abc.def.ghi.jkl" // invalid
];

for (const ip of ipTests) {
  const isValidIP: boolean = NetworkInterface.isValidIP(ip);
  const isValidSubnetMask: boolean = NetworkInterface.isValidSubnetMask(ip);
  console.log(`${ip} => IP: ${isValidIP ? "valid" : "invalid"}, Mask: ${isValidSubnetMask ? "valid" : "invalid"}`);
  console.log("=".repeat(60));
}

console.log("\n--- Manual Tests for NetworkInterface.cidrToMask ---");

const cidrTests: number[] = [0, 8, 16, 24, 30, 32, -1, 33, 15.5];
for (const cidr of cidrTests) {
  try {
    const mask: string = NetworkInterface.cidrToMask(cidr);
    console.log(`/${cidr} => ${mask}`);
  } catch (error: unknown) {
    const err: Error = error as Error;
    console.log(`/${cidr} => ERROR: ${err.message}`);
  }
}
