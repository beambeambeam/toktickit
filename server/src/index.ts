import { app } from "./app.js";
import { env } from "./env.js";

const port = env.PORT;
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
