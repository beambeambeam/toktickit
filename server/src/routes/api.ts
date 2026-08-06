import { Router } from "express";

import { getHealth } from "../controllers/health.js";
import { apiErrorHandler, apiNotFound } from "../middlewares/api-errors.js";

export const apiRouter = Router();

apiRouter.get("/health", getHealth);
apiRouter.use(apiNotFound);
apiRouter.use(apiErrorHandler);
