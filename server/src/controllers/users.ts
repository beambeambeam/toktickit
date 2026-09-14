import type { RequestHandler } from "express";

import { createUserAccount, listUsers } from "../services/users.js";

export const getUsers: RequestHandler = async (request, response) => {
  response.json({ items: await listUsers(request.query) });
};

export const createUser: RequestHandler = async (request, response) => {
  const user = await createUserAccount(request.body);
  response.status(201).json({ user });
};
