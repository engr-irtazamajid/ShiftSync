import { createServer } from "http";
import { app } from "./app";
import { env } from "./config/env";
import { connectDb } from "./config/db";
import { initSockets } from "./sockets";
import { startDropExpiryJob } from "./jobs/dropExpiry";

async function main(): Promise<void> {
  await connectDb();

  const httpServer = createServer(app);
  initSockets(httpServer);
  startDropExpiryJob();

  httpServer.listen(env.port, () => {
    // eslint-disable-next-line no-console
    console.log(`ShiftSync API listening on port ${env.port}`);
  });
}

main().catch((err) => {
  console.error("Failed to start server", err);
  process.exit(1);
});
