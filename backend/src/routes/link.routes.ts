import { Router } from "express";
import { getAllLinks, getLinkById, createLink, deleteLink, getLinksForNode } from "../controllers/LinkController.js";

const linkRouter = Router({ mergeParams: true });

linkRouter.get("/", getAllLinks);
linkRouter.post("/", createLink);
linkRouter.get("/:linkId", getLinkById);
linkRouter.delete("/:linkId", deleteLink);

export default linkRouter;

export const nodeLinkRouter = Router({ mergeParams: true });
nodeLinkRouter.get("/", getLinksForNode);