import type { RequestHandler } from "express";

import { ApiError } from "../errors/api-error.js";
import { getAuthenticatedUserId } from "../middlewares/auth-context.js";
import { getRequesterDashboard } from "../services/requester-dashboard.js";

export const getRequesterDashboardController: RequestHandler = async (
  request,
  response
) => {
  if (Object.keys(request.query).length > 0) {
    throw new ApiError(400, "VALIDATION_ERROR", "Request validation failed.", {
      field: "query",
      reason: "The Requester dashboard does not accept query parameters.",
    });
  }

  response.json(await getRequesterDashboard(getAuthenticatedUserId(response)));
};
