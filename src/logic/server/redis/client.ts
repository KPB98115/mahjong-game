import { connect } from "cloudflare:sockets";
import { env } from "void/env";

type RedisAddress = {
  hostname: string;
  port: number;
  username: string | undefined;
  password: string | undefined;
  tls: boolean;
};

type RedisReply = string | number | null;

const cr = 13;
const lf = 10;
const redisTimeoutMs = 500;

function parseRedisUrl(urlString: string): RedisAddress {
  const url = new URL(urlString);
  const tls = url.protocol === "rediss:";
  const port = url.port === "" ? (tls ? 6380 : 6379) : Number(url.port);
  const username = url.username === "" ? undefined : decodeURIComponent(url.username);
  const password = url.password === "" ? undefined : decodeURIComponent(url.password);
  return {
    hostname: url.hostname,
    port,
    username,
    password,
    tls,
  };
}

function redisUrl(): string {
  const value = env.REDIS_URL;
  if (typeof value !== "string" || value === "") {
    throw new Error("REDIS_URL is not set");
  }
  return value;
}

function concatBytes(left: Uint8Array, right: Uint8Array): Uint8Array {
  const merged = new Uint8Array(left.length + right.length);
  merged.set(left);
  merged.set(right, left.length);
  return merged;
}

function findCrlf(buffer: Uint8Array, start = 0): number {
  for (let index = start; index < buffer.length - 1; index += 1) {
    if (buffer[index] === cr && buffer[index + 1] === lf) {
      return index;
    }
  }
  return -1;
}

function encodeCommand(args: string[]): Uint8Array {
  const parts: Uint8Array[] = [new TextEncoder().encode(`*${args.length}\r\n`)];
  for (const arg of args) {
    const payload = new TextEncoder().encode(arg);
    parts.push(
      new TextEncoder().encode(`$${payload.length}\r\n`),
      payload,
      new TextEncoder().encode("\r\n"),
    );
  }
  let total = 0;
  for (const part of parts) {
    total += part.length;
  }
  const command = new Uint8Array(total);
  let offset = 0;
  for (const part of parts) {
    command.set(part, offset);
    offset += part.length;
  }
  return command;
}

function decodeText(bytes: Uint8Array): string {
  return new TextDecoder().decode(bytes);
}

class RedisConnection {
  private buffer: Uint8Array = new Uint8Array(0);

  constructor(
    private reader: ReadableStreamDefaultReader<Uint8Array>,
    private writer: WritableStreamDefaultWriter<Uint8Array>,
    private socket: { close(): Promise<void> },
  ) {}

  async send(args: string[]): Promise<RedisReply> {
    await this.writer.write(encodeCommand(args));
    return this.readReply();
  }

  async close(): Promise<void> {
    try {
      await this.writer.close();
    } catch {
      // Connection may already be closed.
    }
    try {
      await this.socket.close();
    } catch {
      // Connection may already be closed.
    }
  }

  private async readReply(): Promise<RedisReply> {
    while (true) {
      const parsed = this.tryParse();
      if (parsed !== undefined) {
        return parsed;
      }
      const chunk = await this.reader.read();
      if (chunk.done) {
        throw new Error("Redis connection closed");
      }
      this.buffer = concatBytes(this.buffer, Uint8Array.from(chunk.value));
    }
  }

  private tryParse(): RedisReply | undefined {
    if (this.buffer.length === 0) {
      return undefined;
    }
    const prefix = this.buffer[0];
    const headerEnd = findCrlf(this.buffer, 1);
    if (headerEnd < 0) {
      return undefined;
    }
    const header = decodeText(this.buffer.subarray(1, headerEnd));
    if (prefix === 43) {
      this.buffer = this.buffer.subarray(headerEnd + 2);
      return header;
    }
    if (prefix === 45) {
      this.buffer = this.buffer.subarray(headerEnd + 2);
      throw new Error(header);
    }
    if (prefix === 58) {
      this.buffer = this.buffer.subarray(headerEnd + 2);
      return Number(header);
    }
    if (prefix === 36) {
      const size = Number(header);
      if (size < 0) {
        this.buffer = this.buffer.subarray(headerEnd + 2);
        return null;
      }
      const payloadStart = headerEnd + 2;
      const payloadEnd = payloadStart + size;
      if (this.buffer.length < payloadEnd + 2) {
        return undefined;
      }
      const payload = decodeText(this.buffer.subarray(payloadStart, payloadEnd));
      this.buffer = this.buffer.subarray(payloadEnd + 2);
      return payload;
    }
    throw new Error(`Unsupported Redis reply prefix ${prefix}`);
  }
}

async function openConnection(): Promise<RedisConnection> {
  const address = parseRedisUrl(redisUrl());
  const socket = connect(
    { hostname: address.hostname, port: address.port },
    { secureTransport: address.tls ? "on" : "off" },
  );
  const conn = new RedisConnection(
    socket.readable.getReader(),
    socket.writable.getWriter(),
    socket,
  );
  if (address.password !== undefined) {
    if (address.username === undefined) {
      await conn.send(["AUTH", address.password]);
    } else {
      await conn.send(["AUTH", address.username, address.password]);
    }
  }
  return conn;
}

async function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<T>((_, reject) => {
    timer = setTimeout(() => {
      reject(new Error("Redis timeout"));
    }, ms);
  });
  try {
    return await Promise.race([promise, timeout]);
  } finally {
    if (timer !== undefined) {
      clearTimeout(timer);
    }
  }
}

async function runCommand(args: string[]): Promise<RedisReply> {
  const conn = await openConnection();
  try {
    return await conn.send(args);
  } finally {
    await conn.close();
  }
}

export async function redisGet(key: string): Promise<string | null> {
  const reply = await withTimeout(runCommand(["GET", key]), redisTimeoutMs);
  if (reply === null) {
    return null;
  }
  if (typeof reply !== "string") {
    throw new Error("Unexpected Redis GET reply");
  }
  return reply;
}

export async function redisSetEx(key: string, value: string, ttlSeconds: number): Promise<void> {
  const reply = await withTimeout(
    runCommand(["SET", key, value, "EX", String(ttlSeconds)]),
    redisTimeoutMs,
  );
  if (reply !== "OK") {
    throw new Error("Unexpected Redis SET reply");
  }
}

export async function redisDel(...keys: string[]): Promise<void> {
  if (keys.length === 0) {
    return;
  }
  await withTimeout(runCommand(["DEL", ...keys]), redisTimeoutMs);
}

export async function redisPublish(channel: string, message: string): Promise<void> {
  const reply = await withTimeout(runCommand(["PUBLISH", channel, message]), redisTimeoutMs);
  if (typeof reply !== "number") {
    throw new Error("Unexpected Redis PUBLISH reply");
  }
}
