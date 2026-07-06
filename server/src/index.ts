import "dotenv/config";
import express from "express";
import cors from "cors";
import { initDb } from "./db/index.js";
import { authRouter } from "./routes/auth.js";
import { familyRouter } from "./routes/family.js";
import { eventsRouter } from "./routes/events.js";
import { swapRequestsRouter } from "./routes/swapRequests.js";

const app = express();
const PORT = Number(process.env.PORT) || 4000;
const corsOrigin = process.env.CORS_ORIGIN;

app.use(cors({ origin: corsOrigin ? corsOrigin.split(",") : true }));
app.use(express.json());

app.get("/api/health", (_req, res) => res.json({ ok: true }));
app.use("/api/auth", authRouter);
app.use("/api/family", familyRouter);
app.use("/api/events", eventsRouter);
app.use("/api/swap-requests", swapRequestsRouter);

app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err);
  res.status(500).json({ error: "Internal server error" });
});

await initDb();
app.listen(PORT, () => {
  console.log(`Coparent API listening on http://localhost:${PORT}`);
});
