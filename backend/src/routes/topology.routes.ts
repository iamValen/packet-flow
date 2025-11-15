import { Router } from "express";
import { getAllTopologies, getTopologyById, createTopology, updateTopology, deleteTopology, getTopologyNodes } from "../controllers/TopologyController.js";

const router = Router();

router.get("/", getAllTopologies);
router.get("/:id", getTopologyById);
router.post("/", createTopology);
router.put("/:id", updateTopology);
router.delete("/:id", deleteTopology);
router.get("/:id/nodes", getTopologyNodes);

export default router;