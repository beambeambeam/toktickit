import type { RequestHandler } from "express";

import { getCategories as retrieveCategories } from "../services/categories.js";
import {
  getDevelopmentRequesters as retrieveDevelopmentRequesters,
  getRelatedSystems as retrieveRelatedSystems,
} from "../services/reference-data.js";

export const getCategories: RequestHandler = async (_request, response) => {
  response.json({ items: await retrieveCategories() });
};

export const getRelatedSystems: RequestHandler = async (_request, response) => {
  response.json({ items: await retrieveRelatedSystems() });
};

export const getDevelopmentRequesters: RequestHandler = async (
  _request,
  response
) => {
  response.json({ items: await retrieveDevelopmentRequesters() });
};
