import { Router } from "express";
import { getAllRoutes, createRoute, deleteRoute } from "../controllers/RoutingController.js";

const routingRouter = Router({ mergeParams: true });

routingRouter.get("/", getAllRoutes);
routingRouter.post("/", createRoute);
routingRouter.delete("/:routeId", deleteRoute);

export default routingRouter;
