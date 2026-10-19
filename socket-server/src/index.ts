import { loadServerConfig } from "./logic/server/config.js";
import { startSocketServer } from "./logic/server/createSocketServer.js";

async function main(): Promise<void> {
  const config = loadServerConfig(process.env);
  await startSocketServer(config);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
