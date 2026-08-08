import { findCategories } from "../repositories/categories.js";

export const getCategories = async () => {
  try {
    return await findCategories();
  } catch (error: unknown) {
    throw new Error("Unable to retrieve request categories", { cause: error });
  }
};
