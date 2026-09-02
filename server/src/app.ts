import cors from "cors";
import express from "express";

import { corsConfig } from "./config/cors.js";
import { apiRouter } from "./routes/api.js";
import { documentationRouter } from "./routes/documentation.js";

export const app = express();

app.use(
  "/api",
  cors({
    allowedHeaders: ["Content-Type", "X-Development-Requester-Id"],
    origin: corsConfig.CORS_ORIGIN,
  }),
  apiRouter
);
app.use(documentationRouter);
