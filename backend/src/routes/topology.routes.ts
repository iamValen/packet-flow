import { Router } from "express";
import TopologyController from "../controllers/TopologyController.js";

const router = Router();

router.get("/", TopologyController.getAll);
router.get("/:id", TopologyController.getById);
router.post("/", TopologyController.create);
router.put("/:id", TopologyController.update);
router.delete("/:id", TopologyController.delete);
router.get("/:id/nodes", TopologyController.getNodes);

export default router;