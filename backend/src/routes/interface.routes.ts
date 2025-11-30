import { Router } from "express";
import InterfaceController from "../controllers/InterfaceController.js";

const interfaceRouter = Router({ mergeParams: true });

interfaceRouter.get("/", InterfaceController.getAllInterfaces);
interfaceRouter.post("/", InterfaceController.createInterface);
interfaceRouter.get("/:interfaceId", InterfaceController.getInterfaceById);
interfaceRouter.put("/:interfaceId", InterfaceController.updateInterface);
interfaceRouter.delete("/:interfaceId", InterfaceController.deleteInterface);

export default interfaceRouter;