import { Router } from "express";
import SimulationController from "../controllers/SimulationController.js";

const simulationRouter = Router({ mergeParams: true });

simulationRouter.get("/", SimulationController.getAllSimulations);
simulationRouter.post("/", SimulationController.createSimulation);
simulationRouter.get("/:simulationId", SimulationController.getSimulationById);

// load existing simulation
simulationRouter.post("/:simulationId/load", SimulationController.loadSimulation);
simulationRouter.post("/:simulationId/unload", SimulationController.unloadSimulation);

// packet controls
simulationRouter.post("/:simulationId/send-packet", SimulationController.sendPacket);
simulationRouter.post("/:simulationId/step", SimulationController.simulationStep);

simulationRouter.post("/:simulationId/run", SimulationController.runSimulation);
simulationRouter.post("/:simulationId/stop", SimulationController.stopSimulation);

simulationRouter.delete("/:simulationId", SimulationController.deleteSimulation);

export default simulationRouter;