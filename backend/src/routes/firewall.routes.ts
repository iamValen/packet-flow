import { Router } from "express";
import FirewallController from "../controllers/FirewallController.js";

const firewallRouter = Router({ mergeParams: true });

firewallRouter.get("/", FirewallController.getAll);
firewallRouter.post("/", FirewallController.create);
firewallRouter.put("/:ruleId", FirewallController.update);
firewallRouter.delete("/:ruleId", FirewallController.delete);

export default firewallRouter;