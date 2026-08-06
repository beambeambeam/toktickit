import express from "express";

import { documentationRouter } from "./routes/documentation.js";

export const app = express();

app.use(documentationRouter);
