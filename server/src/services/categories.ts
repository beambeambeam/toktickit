import { ApiError } from "../errors/api-error.js";
import { findCategories } from "../repositories/categories.js";

export const getCategories = async () => {
  try {
    return await findCategories();
  } catch {
    throw new ApiError(
      500,
      "REFERENCE_DATA_UNAVAILABLE",
      "Unable to load Categories."
    );
  }
};
