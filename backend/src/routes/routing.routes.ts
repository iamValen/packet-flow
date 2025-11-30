import { Router } from "express";
import RoutingController from "../controllers/RoutingController.js";

const routingRouter = Router({ mergeParams: true });

routingRouter.get("/", RoutingController.getAllRoutes);
routingRouter.post("/", RoutingController.createRoute);
routingRouter.delete("/:routeId", RoutingController.deleteRoute);

export default routingRouter;