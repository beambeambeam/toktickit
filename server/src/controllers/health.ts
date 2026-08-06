import type { RequestHandler } from "express";

const healthResponse = {
  service: "TokTickIT API",
  status: "ok",
} as const;

export const getHealth: RequestHandler = (_request, response) => {
  response.set("Cache-Control", "no-store").json(healthResponse);
};
