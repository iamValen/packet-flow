import { Router } from "express";
import { getAllFirewallRules, createFirewallRule, updateFirewallRule, deleteFirewallRule } from "../controllers/FirewallController.js";

const firewallRouter = Router({ mergeParams: true });

firewallRouter.get("/rules", getAllFirewallRules);
firewallRouter.post("/rules", createFirewallRule);
firewallRouter.put("/rules/:ruleId", updateFirewallRule);
firewallRouter.delete("/rules/:ruleId", deleteFirewallRule);

export default firewallRouter;
