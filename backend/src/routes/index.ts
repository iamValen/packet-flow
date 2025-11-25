import { Router } from "express";
import topologyRoutes from "./topology.routes.js";
import nodeRoutes from "./node.routes.js";
import interfaceRoutes from "./interface.routes.js";
import linkRoutes, { nodeLinkRouter } from "./link.routes.js";
import routingRoutes from "./routing.routes.js";
import firewallRoutes from "./firewall.routes.js";
import simulationRoutes from "./simulation.routes.js";

const api = Router();

api.use("/topologies", topologyRoutes);

// under topologies
api.use("/topologies/:topologyId/nodes", nodeRoutes);
api.use("/topologies/:topologyId/links", linkRoutes);
api.use("/topologies/:topologyId/simulations", simulationRoutes);

// under nodes
api.use("/nodes/:nodeId/interfaces", interfaceRoutes);
api.use("/nodes/:nodeId/routes", routingRoutes);
api.use("/nodes/:nodeId/firewall", firewallRoutes);
api.use("/nodes/:nodeId/links", nodeLinkRouter);

export default api;