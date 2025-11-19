import { Router } from "express";
import { getAllNodes, getNodeById, createNode, updateNode, updateNodePosition, deleteNode } from "../controllers/NodeController.js";

const nodeRouter = Router({ mergeParams: true });

nodeRouter.get("/", getAllNodes);
nodeRouter.post("/", createNode);
nodeRouter.get("/:nodeId", getNodeById);
nodeRouter.put("/:nodeId", updateNode);
nodeRouter.put("/:nodeId/position", updateNodePosition);
nodeRouter.delete("/:nodeId", deleteNode);

export default nodeRouter;