import { Router } from "express";
import { getAllSimulations, createSimulation, getSimulationById, loadSimulation, sendPacket, simulationStep, runSimulation, stopSimulation, unloadSimulation, deleteSimulation } from "../controllers/SimulationController.js";

const simulationRouter = Router({ mergeParams: true });

simulationRouter.get("/", getAllSimulations);
simulationRouter.post("/", createSimulation);
simulationRouter.get("/:simulationId", getSimulationById);

// Load existing simulation into runtime
simulationRouter.post("/:simulationId/load", loadSimulation);

// Controls
simulationRouter.post("/:simulationId/send-packet", sendPacket);
simulationRouter.post("/:simulationId/step", simulationStep);
simulationRouter.post("/:simulationId/run", runSimulation);
simulationRouter.post("/:simulationId/stop", stopSimulation);

// Free memory
simulationRouter.post("/:simulationId/unload", unloadSimulation);

simulationRouter.delete("/:simulationId", deleteSimulation);

export default simulationRouter;