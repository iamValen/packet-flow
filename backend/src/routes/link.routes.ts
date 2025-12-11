import { Router } from "express";
import LinkController from "../controllers/LinkController.js";

const linkRouter = Router({ mergeParams: true });

linkRouter.get("/", LinkController.getAll);
linkRouter.post("/", LinkController.create);
linkRouter.get("/:linkId", LinkController.getById);
linkRouter.delete("/:linkId", LinkController.delete);

export default linkRouter;

export const nodeLinkRouter = Router({ mergeParams: true });
nodeLinkRouter.get("/", LinkController.getForNode);