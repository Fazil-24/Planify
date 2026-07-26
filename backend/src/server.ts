import "dotenv/config";
import express from "express";
import cors from "cors";
import { planRouter } from "./routes/plan";
import { geocodeSearchRouter } from "./routes/geocodeSearch";

const app = express();
const PORT = process.env.PORT ?? 4000;

const allowedOrigins = (process.env.FRONTEND_ORIGIN ?? "http://localhost:3000")
  .split(",")
  .map((origin) => origin.trim());

app.use(
  cors({
    origin: allowedOrigins,
  })
);
app.use(express.json());

app.get("/health", (_req, res) => res.json({ status: "ok" }));

app.use(planRouter);
app.use(geocodeSearchRouter);

app.listen(PORT, () => {
  console.log(`PlanIFY backend listening on port ${PORT}`);
  console.log(`Allowed CORS origins: ${allowedOrigins.join(", ")}`);
});
