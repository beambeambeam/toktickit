import type { RequestHandler } from "express";
import swaggerUi from "swagger-ui-express";

import { openapiDocument } from "../openapi.js";

const documentationHtml = swaggerUi
  .generateHTML(openapiDocument)
  .replace("<head>", '<head>\n  <base href="/docs/">');

export const getOpenapiDocument: RequestHandler = (_request, response) => {
  response.json(openapiDocument);
};

export const getDocumentation: RequestHandler = (_request, response) => {
  response.type("html").send(documentationHtml);
};
