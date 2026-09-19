import { ApiError } from "../errors/api-error.js";
import { findRelatedSystems } from "../repositories/related-systems.js";

export const getRelatedSystems = async () => {
  try {
    return await findRelatedSystems();
  } catch {
    throw new ApiError(
      500,
      "REFERENCE_DATA_UNAVAILABLE",
      "Unable to load Related Systems."
    );
  }
};
