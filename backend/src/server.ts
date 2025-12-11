import express from "express";
import cors from "cors";
import { config } from "dotenv";
import api from "./routes/index.js";
import { errorHandler } from "./middleware/errorHandler.js";

config();

const app = express();
const PORT = process.env.PORT || 3000;

// middleware
app.use(cors());
app.use(express.json());

// routes
app.use("/api", api);

// health check
app.get("/", (req, res) => {
    res.json({ ok: true, message: "PacketFlow API" });
});

// 404
app.use((req, res) => {
    res.status(404).json({ success: false, error: "not found" });
});

// error handler (last)
app.use(errorHandler);

app.listen(PORT, () => {
    console.log(`server running on http://localhost:${PORT}`);
});