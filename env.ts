import { defineEnv, string } from "void/env";

export default defineEnv({
  REDIS_URL: string(),
  SOCKET_ORIGIN: string().default("http://localhost:3001"),
});
