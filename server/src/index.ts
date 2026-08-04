import { app } from "./app.js";
import { prisma } from "./db/client.js";
import { env } from "./env.js";

const port = env.PORT;

const startServer = async (): Promise<void> => {
  await prisma.$connect();

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

  const shutdown = (signal: NodeJS.Signals): void => {
    console.info(`Received ${signal}, shutting down`);
    server.close(() => {
      void prisma.$disconnect();
    });
  };

  process.once("SIGINT", shutdown.bind(null, "SIGINT"));
  process.once("SIGTERM", shutdown.bind(null, "SIGTERM"));
};

try {
  await startServer();
} catch (error: unknown) {
  console.error("Unable to start server", error);
  await prisma.$disconnect();
  process.exitCode = 1;
}
