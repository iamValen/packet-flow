import { Router } from "express";
import NodeController from "../controllers/NodeController.js";

const nodeRouter = Router({ mergeParams: true });

nodeRouter.get("/", NodeController.getAllNodes);
nodeRouter.post("/", NodeController.createNode);
nodeRouter.get("/:nodeId", NodeController.getNodeById);
nodeRouter.put("/:nodeId", NodeController.updateNode);
nodeRouter.put("/:nodeId/position", NodeController.updateNodePosition);
nodeRouter.delete("/:nodeId", NodeController.deleteNode);

export default nodeRouter;