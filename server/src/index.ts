import { app } from "./app.js";

const DEFAULT_PORT = 3000;
const MAX_PORT = 65_535;

const parsePort = (value: string | undefined): number => {
  if (value === undefined) {
    return DEFAULT_PORT;
  }

  if (value.trim() === "") {
    throw new Error(
      `PORT must be an integer between 0 and ${MAX_PORT}; received an empty value`
    );
  }

  const port = Number(value);

  if (!Number.isInteger(port) || port < 0 || port > MAX_PORT) {
    throw new Error(
      `PORT must be an integer between 0 and ${MAX_PORT}; received "${value}"`
    );
  }

  return port;
};

const port = parsePort(process.env.PORT);
const server = app.listen(port);

server.once("error", (error) => {
  throw error;
});

server.once("listening", () => {
  const address = server.address();
  const resolvedPort =
    address !== null && typeof address !== "string" ? address.port : port;

  console.info(`Server listening on port ${resolvedPort}`);
});
