import type { RequestHandler } from "express";

import { getCategories as retrieveCategories } from "../services/categories.js";
import { getRelatedSystems as retrieveRelatedSystems } from "../services/reference-data.js";

export const getCategories: RequestHandler = async (_request, response) => {
  response.json({ items: await retrieveCategories() });
};

export const getRelatedSystems: RequestHandler = async (_request, response) => {
  response.json({ items: await retrieveRelatedSystems() });
};
