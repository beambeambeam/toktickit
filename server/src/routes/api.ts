import { Router } from "express";

import { getCategories } from "../controllers/categories.js";
import { getHealth } from "../controllers/health.js";
import { apiErrorHandler, apiNotFound } from "../middlewares/api-errors.js";

export const apiRouter = Router();

apiRouter.get("/categories", getCategories);
apiRouter.get("/health", getHealth);
apiRouter.use(apiNotFound);
apiRouter.use(apiErrorHandler);
