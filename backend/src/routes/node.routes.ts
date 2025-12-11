import { Router } from "express";
import NodeController from "../controllers/NodeController.js";

const nodeRouter = Router({ mergeParams: true });

nodeRouter.get("/", NodeController.getAll);
nodeRouter.post("/", NodeController.create);
nodeRouter.get("/:nodeId", NodeController.getById);
nodeRouter.put("/:nodeId", NodeController.update);
nodeRouter.put("/:nodeId/position", NodeController.updatePosition);
nodeRouter.delete("/:nodeId", NodeController.delete);

export default nodeRouter;