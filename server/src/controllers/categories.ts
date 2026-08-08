import type { RequestHandler } from "express";

import { getCategories as retrieveCategories } from "../services/categories.js";

export const getCategories: RequestHandler = async (_request, response) => {
  const categories = await retrieveCategories();

  response.json(categories);
};
