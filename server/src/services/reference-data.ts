import { ApiError } from "../errors/api-error.js";
import {
  findActiveDevelopmentRequester,
  findActiveDevelopmentRequesters,
} from "../repositories/development-requesters.js";
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

export const getDevelopmentRequesters = async () => {
  try {
    return await findActiveDevelopmentRequesters();
  } catch {
    throw new ApiError(
      500,
      "REFERENCE_DATA_UNAVAILABLE",
      "Unable to load Development Requesters."
    );
  }
};

export const requireActiveDevelopmentRequester = async (id: number) => {
  try {
    return await findActiveDevelopmentRequester(id);
  } catch {
    throw new ApiError(
      500,
      "REQUESTER_CONTEXT_UNAVAILABLE",
      "Unable to validate the Development Requester context."
    );
  }
};
