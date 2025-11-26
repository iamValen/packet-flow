import express, { type Application, type Request, type Response } from "express";
import cors from "cors";
import { config } from "dotenv";
import api from "./routes/index.js";
import { StatusCodes } from "http-status-codes";

import { errorHandler } from "./middleware/errorHandler.js";

config();

const app: Application = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// use routes inside /routes/index.ts
app.use("/api", api);

app.get("/", (req: Request, res: Response) => {
    res.json({ success: true, message: "PacketFlow API server running" });
});

// Not found route
app.use((req: Request, res: Response) => {
    res.status(StatusCodes.NOT_FOUND).json({ success: false, error: "Route not found", path: req.path });
});

app.use(errorHandler);

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
