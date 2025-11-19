import { Router } from "express";
import { getAllInterfaces, getInterfaceById, createInterface, updateInterface, deleteInterface } from "../controllers/InterfaceController.js";

const interfaceRouter = Router({ mergeParams: true });

interfaceRouter.get("/", getAllInterfaces);
interfaceRouter.post("/", createInterface);
interfaceRouter.get("/:interfaceId", getInterfaceById);
interfaceRouter.put("/:interfaceId", updateInterface);
interfaceRouter.delete("/:interfaceId", deleteInterface);

export default interfaceRouter;
