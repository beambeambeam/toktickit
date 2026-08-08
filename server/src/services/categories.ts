import { findCategories } from "../repositories/categories.js";

export const getCategories = async () => await findCategories();
