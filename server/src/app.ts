import cors from "cors";
import express from "express";

import { corsConfig } from "./config/cors.js";
import { apiRouter } from "./routes/api.js";
import { documentationRouter } from "./routes/documentation.js";

export const app = express();

app.set("trust proxy", 1);

app.use(
  "/api",
  cors({
    allowedHeaders: ["Content-Type", "X-CSRF-Token"],
    credentials: true,
    exposedHeaders: ["Content-Disposition", "Retry-After"],
    methods: ["GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"],
    origin: corsConfig.CORS_ORIGIN,
  }),
  apiRouter
);
app.use(documentationRouter);
