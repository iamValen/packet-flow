import express from "express"
import type { Request, Response } from "express"
import { dirname, join } from "path"

const app = express();

const port = process.env.PORT || 3000;

app.get("/", (req: Request, res: Response) => {
    res.json({ message: "Welcome to the Express + TypeScript Server!" });
});

app.listen(port, () => {
    console.log(`The server is running at http://localhost:${port}`);
});