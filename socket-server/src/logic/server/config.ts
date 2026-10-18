import { z } from "zod";

const serverConfigSchema = z.object({
  port: z.coerce.number().int().min(1).max(65535).default(3001),
  corsOrigin: z.string().min(1).default("http://localhost:5173"),
  redisUrl: z.string().min(1),
});

export type ServerConfig = z.infer<typeof serverConfigSchema>;

export function loadServerConfig(env: NodeJS.ProcessEnv): ServerConfig {
  return serverConfigSchema.parse({
    port: env.PORT,
    corsOrigin: env.CORS_ORIGIN,
    redisUrl: env.REDIS_URL,
  });
}
