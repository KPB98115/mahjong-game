export type RedisCommands = {
  get(key: string): Promise<string | null>;
  setEx(key: string, value: string, ttlSeconds: number): Promise<void>;
  del(...keys: string[]): Promise<void>;
  publish(channel: string, message: string): Promise<void>;
};
