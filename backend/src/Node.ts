import { NetworkInterface } from './NetworkInterface.js';


export type NodeType = 'ROUTER' | 'HOST' | 'FIREWALL';

/**
 * Represents a network node
 */
export interface Node {
  id: string;
  name: string;
  type: NodeType;
  next: Node | null;
  position: { x: number; y: number };
  
  // for HOST/FIREWALL
  interface?: NetworkInterface;
  // for ROUTER
  interfaces?: NetworkInterface[];
}