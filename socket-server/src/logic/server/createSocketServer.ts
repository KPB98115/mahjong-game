import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { createAdapter } from "@socket.io/redis-adapter";
import { createClient } from "redis";
import { Server } from "socket.io";

import { type ServerConfig } from "./config.js";
import { buildHealthResponse, healthResponseSchema } from "./healthResponse.js";
import { SocketEvent } from "../../type/server/socketEvent.js";

function handleHealthRequest(response: ServerResponse): void {
  const body = healthResponseSchema.parse(buildHealthResponse());
  response.writeHead(200, { "Content-Type": "application/json" });
  response.end(JSON.stringify(body));
}

function isHealthRequest(request: IncomingMessage): boolean {
  return request.method === "GET" && request.url === "/health";
}

export async function startSocketServer(config: ServerConfig): Promise<void> {
  const httpServer = createServer((request, response) => {
    if (isHealthRequest(request)) {
      handleHealthRequest(response);
      return;
    }
    response.writeHead(404);
    response.end();
  });

  const pubClient = createClient({ url: config.redisUrl });
  const subClient = pubClient.duplicate();
  await pubClient.connect();
  await subClient.connect();

  const io = new Server(httpServer, {
    cors: {
      origin: config.corsOrigin,
      methods: ["GET", "POST"],
    },
  });

  io.adapter(createAdapter(pubClient, subClient));

  io.on("connection", (socket) => {
    socket.on(SocketEvent.Ping, () => {
      socket.emit(SocketEvent.Pong);
    });
  });

  await new Promise<void>((resolve, reject) => {
    httpServer.listen(config.port, "0.0.0.0", () => resolve());
    httpServer.on("error", reject);
  });

  console.log(`Socket.IO listening on 0.0.0.0:${config.port}`);
}
