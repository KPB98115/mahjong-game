import { defineEnv, string } from "void/env";

export default defineEnv({
  REDIS_URL: string(),
});
