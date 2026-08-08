import { Router } from "express";
import swaggerUi from "swagger-ui-express";

import {
  getDocumentation,
  getOpenapiDocument,
} from "../controllers/documentation.js";

export const documentationRouter = Router();

documentationRouter.get("/openapi.json", getOpenapiDocument);

documentationRouter.get("/docs", getDocumentation);
documentationRouter.use("/docs", swaggerUi.serve);
