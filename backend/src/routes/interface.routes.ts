import { Router } from "express";
import InterfaceController from "../controllers/InterfaceController.js";

const interfaceRouter = Router({ mergeParams: true });

interfaceRouter.get("/", InterfaceController.getAll);
interfaceRouter.post("/", InterfaceController.create);
interfaceRouter.get("/:interfaceId", InterfaceController.getById);
interfaceRouter.put("/:interfaceId", InterfaceController.update);
interfaceRouter.delete("/:interfaceId", InterfaceController.delete);

export default interfaceRouter;