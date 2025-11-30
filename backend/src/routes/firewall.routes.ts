import { Router } from "express";
import FirewallController from "../controllers/FirewallController.js";

const firewallRouter = Router({ mergeParams: true });

firewallRouter.get("/rules", FirewallController.getAllFirewallRules);
firewallRouter.post("/rules", FirewallController.createFirewallRule);
firewallRouter.put("/rules/:ruleId", FirewallController.updateFirewallRule);
firewallRouter.delete("/rules/:ruleId", FirewallController.deleteFirewallRule);

export default firewallRouter;
