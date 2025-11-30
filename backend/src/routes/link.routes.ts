import { Router } from "express";
import LinkController from "../controllers/LinkController.js";

const linkRouter = Router({ mergeParams: true });

linkRouter.get("/", LinkController.getAllLinks);
linkRouter.post("/", LinkController.createLink);
linkRouter.get("/:linkId", LinkController.getLinkById);
linkRouter.delete("/:linkId", LinkController.deleteLink);

export default linkRouter;

export const nodeLinkRouter = Router({ mergeParams: true });
nodeLinkRouter.get("/", LinkController.getLinksForNode);