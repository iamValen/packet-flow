import { Router } from "express";
import TopologyController from "../controllers/TopologyController.js";

const router = Router();

router.get("/", TopologyController.getAllTopologies);
router.get("/:id", TopologyController.getTopologyById);
router.post("/", TopologyController.createTopology);
router.put("/:id", TopologyController.updateTopology);
router.delete("/:id", TopologyController.deleteTopology);
router.get("/:id/nodes", TopologyController.getTopologyNodes);

export default router;