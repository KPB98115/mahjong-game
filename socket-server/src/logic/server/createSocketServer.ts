import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import * as schema from "@schema";
import { transactionRunner } from "@app/logic/server/db/executor";
import { createRedisClaimWindowStore } from "@app/logic/server/game/claimWindowStore";
import { createGameLogics, createSnapshotRepos } from "@app/logic/server/game/gameLogics";
import { defaultGameRandom } from "@app/logic/server/game/gameRandom";
import { createGameRedis } from "@app/logic/server/redis/gameChannel";
import { gameChannel } from "@app/logic/server/redis/keys";
import { createRedisRoundCache } from "@app/logic/server/redis/roundCache";
import { type JsonValue } from "@app/types/server/jsonValue";
import { SocketError } from "@app/types/server/socketError";
import { SocketEvent } from "@app/types/server/socketEvent";
import { createAdapter } from "@socket.io/redis-adapter";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { createClient } from "redis";
import { Server } from "socket.io";

import { type ServerConfig } from "./config.js";
import {
  type GameServer,
  type GameSocket,
  type Scheduler,
  type SocketData,
  type SocketPayload,
} from "./gameSocket.js";
import { buildHealthResponse, healthResponseSchema } from "./healthResponse.js";
import { nodeRedisCommands, nodeTicketTaker } from "./nodeRedis.js";
import { createSocketHandlers } from "./socketHandlers.js";

type ServerEvents = Record<SocketEvent, (payload?: SocketPayload) => void>;
type ClientEvents = Record<SocketEvent, (payload?: JsonValue) => void>;
type GameIo = Server<ClientEvents, ServerEvents, ServerEvents, SocketData>;

function handleHealthRequest(response: ServerResponse): void {
  const body = healthResponseSchema.parse(buildHealthResponse());
  response.writeHead(200, { "Content-Type": "application/json" });
  response.end(JSON.stringify(body));
}

function isHealthRequest(request: IncomingMessage): boolean {
  return request.method === "GET" && request.url === "/health";
}

const nodeScheduler: Scheduler = (callback, ms) => {
  const timer = setTimeout(callback, ms);
  return {
    cancel() {
      clearTimeout(timer);
    },
  };
};

function gameServerOf(target: GameIo | GameIo["local"]): GameServer {
  return {
    to(room) {
      return target.to(room);
    },
    in(room) {
      const operator = target.in(room);
      return {
        async fetchSockets(): Promise<GameSocket[]> {
          return operator.fetchSockets();
        },
        socketsLeave(leaving) {
          operator.socketsLeave(leaving);
        },
      };
    },
  };
}

function logFailure(work: Promise<void>): void {
  work.catch((error: Error) => {
    console.error(error);
  });
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
  const gameSubscriber = pubClient.duplicate();
  await Promise.all([pubClient.connect(), subClient.connect(), gameSubscriber.connect()]);

  const database = drizzle({ client: new Pool({ connectionString: config.databaseUrl }), schema });
  const redis = nodeRedisCommands(pubClient);
  const { roundsLogic } = createGameLogics({
    repos: createSnapshotRepos(database),
    runTransaction: transactionRunner(database),
    random: defaultGameRandom(),
    redis: createGameRedis(redis),
    claimWindowStore: createRedisClaimWindowStore(redis),
    roundCache: createRedisRoundCache(redis),
  });

  const io: GameIo = new Server(httpServer, {
    cors: {
      origin: config.corsOrigin,
      methods: ["GET", "POST"],
    },
  });
  io.adapter(createAdapter(pubClient, subClient));

  const handlers = createSocketHandlers({
    roundsLogic,
    server: gameServerOf(io),
    localServer: gameServerOf(io.local),
    scheduler: nodeScheduler,
    clock: () => new Date(),
    takeTicket: nodeTicketTaker(pubClient),
  });

  io.use((socket, next) => {
    handlers.auth
      .authenticate(socket.handshake.auth)
      .then((userId) => {
        if (userId == null) {
          next(new Error(SocketError.Unauthorized));
          return;
        }
        socket.data.userId = userId;
        next();
      })
      .catch((error: Error) => next(error));
  });

  io.on("connection", (socket) => {
    socket.on(SocketEvent.Ping, () => handlers.ping.handle(socket));
    socket.on(SocketEvent.JoinGame, (payload) =>
      logFailure(handlers.joinGame.handle(socket, payload)),
    );
    socket.on(SocketEvent.Draw, (payload) => logFailure(handlers.draw.handle(socket, payload)));
    socket.on(SocketEvent.Discard, (payload) =>
      logFailure(handlers.discard.handle(socket, payload)),
    );
    socket.on(SocketEvent.Claim, (payload) => logFailure(handlers.claim.handle(socket, payload)));
    socket.on(SocketEvent.PassClaim, (payload) =>
      logFailure(handlers.passClaim.handle(socket, payload)),
    );
    socket.on(SocketEvent.DeclareWin, (payload) =>
      logFailure(handlers.declareWin.handle(socket, payload)),
    );
    socket.on("disconnect", () => logFailure(handlers.disconnect.handle(socket)));
  });

  await gameSubscriber.pSubscribe(gameChannel("*"), (message) =>
    logFailure(handlers.fanout.handle(message)),
  );

  await new Promise<void>((resolve, reject) => {
    httpServer.listen(config.port, "0.0.0.0", () => resolve());
    httpServer.on("error", reject);
  });

  console.log(`Socket.IO listening on 0.0.0.0:${config.port}`);
}
