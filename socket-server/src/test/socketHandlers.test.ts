import { describe, expect, it } from "vitest";
import { createPlayWorld, playNow, userAt, type PlayWorld } from "@app/test/playWorld";
import { ClaimWindowMs } from "@app/types/server/claimWindowMs";
import { GameChannelEvent } from "@app/types/server/gameChannelEvent";
import { SocketError } from "@app/types/server/socketError";
import { SocketEvent } from "@app/types/server/socketEvent";
import { gameRoom, seatRoom } from "../logic/server/gameRooms.js";
import { createSocketHandlers, type SocketHandlers } from "../logic/server/socketHandlers.js";
import {
  createFakeScheduler,
  createFakeSocketServer,
  type FakeScheduler,
  type FakeSocket,
  type FakeSocketServer,
} from "./fakeSocketServer.js";

type SocketWorld = {
  play: PlayWorld;
  fake: FakeSocketServer;
  timers: FakeScheduler;
  handlers: SocketHandlers;
  tickets: Map<string, string>;
  seat(seatIndex: number): Promise<FakeSocket>;
};

async function createSocketWorld(
  options: Parameters<typeof createPlayWorld>[0] = {},
): Promise<SocketWorld> {
  const play = await createPlayWorld(options);
  const fake = createFakeSocketServer();
  const timers = createFakeScheduler();
  const tickets = new Map<string, string>();
  const handlers = createSocketHandlers({
    roundsLogic: play.roundsLogic,
    repos: play.repos,
    server: fake.server,
    localServer: fake.server,
    scheduler: timers.scheduler,
    clock: () => playNow,
    async takeTicket(ticket) {
      const userId = tickets.get(ticket);
      tickets.delete(ticket);
      return userId;
    },
  });
  return {
    play,
    fake,
    timers,
    handlers,
    tickets,
    async seat(seatIndex) {
      const socket = fake.connect(userAt(play, seatIndex));
      await handlers.joinGame.handle(socket, { gameId: play.gameId });
      for (const seated of fake.sockets) {
        seated.received.length = 0;
      }
      fake.roomEmits.length = 0;
      return socket;
    },
  };
}

function events(socket: FakeSocket): SocketEvent[] {
  return socket.received.map((item) => item.event);
}

function roomEvents(world: SocketWorld, room: string): SocketEvent[] {
  return world.fake.roomEmits.filter((item) => item.room === room).map((item) => item.event);
}

async function drawnTileId(world: SocketWorld, seatIndex: number): Promise<string> {
  const tile = (await world.play.hand(seatIndex)).find((row) => row.isDrawn);
  if (tile == null) {
    throw new Error(`seat ${seatIndex} has no drawn tile`);
  }
  return tile.id;
}

describe("SocketAuthHandler", () => {
  it("accepts a one-time ticket and rejects it the second time", async () => {
    const world = await createSocketWorld();
    const userId = userAt(world.play, 0);
    world.tickets.set("ticket-1", userId);

    expect(await world.handlers.auth.authenticate({ ticket: "ticket-1" })).toBe(userId);
    expect(await world.handlers.auth.authenticate({ ticket: "ticket-1" })).toBeUndefined();
    expect(await world.handlers.auth.authenticate({})).toBeUndefined();
    expect(await world.handlers.auth.authenticate({ ticket: 42 })).toBeUndefined();
  });
});

describe("JoinGameHandler", () => {
  it("joins the game and seat rooms and sends the seat its hand", async () => {
    const world = await createSocketWorld();
    const socket = world.fake.connect(userAt(world.play, 2));

    await world.handlers.joinGame.handle(socket, { gameId: world.play.gameId });

    expect([...socket.rooms]).toEqual([
      gameRoom(world.play.gameId),
      seatRoom(world.play.gameId, 2),
    ]);
    expect(events(socket)).toEqual([
      SocketEvent.Joined,
      SocketEvent.SelfHand,
      SocketEvent.PublicState,
      SocketEvent.Presence,
    ]);
    expect(socket.data).toMatchObject({ gameId: world.play.gameId, seatIndex: 2 });
  });

  it("answers actionError for a missing user, a bad body, and a stranger", async () => {
    const world = await createSocketWorld();
    const anonymous = world.fake.connect(undefined);
    await world.handlers.joinGame.handle(anonymous, { gameId: world.play.gameId });
    const seated = world.fake.connect(userAt(world.play, 0));
    await world.handlers.joinGame.handle(seated, { gameId: "nope" });
    const stranger = world.fake.connect("2b7a6f0e-9c1d-4e3f-8a5b-6c7d8e9f0a1b");
    await world.handlers.joinGame.handle(stranger, { gameId: world.play.gameId });

    expect(anonymous.received).toEqual([
      { event: SocketEvent.ActionError, payload: { error: SocketError.Unauthorized } },
    ]);
    expect(seated.received).toEqual([
      { event: SocketEvent.ActionError, payload: { error: SocketError.InvalidBody } },
    ]);
    expect(stranger.received).toEqual([
      { event: SocketEvent.ActionError, payload: { error: SocketError.NotSeated } },
    ]);
    expect(stranger.rooms.size).toBe(0);
  });

  it("re-arms the claim timer when a seat rejoins during an open window", async () => {
    const world = await createSocketWorld();
    const dealer = await world.seat(0);
    await world.handlers.discard.handle(dealer, {
      gameId: world.play.gameId,
      tileId: await drawnTileId(world, 0),
    });
    for (const timer of world.timers.active()) {
      timer.fire();
    }
    await world.handlers.coordinator.settled();
    await world.play.roundsLogic.discard({
      gameId: world.play.gameId,
      userId: userAt(world.play, 1),
      tileId: await drawnTileId(world, 1),
      now: playNow,
    });
    expect(world.timers.active()).toHaveLength(0);

    await world.seat(2);

    expect(world.timers.active().map((timer) => timer.ms)).toEqual([ClaimWindowMs.FiveSeconds]);
  });
});

describe("play handlers", () => {
  it("broadcasts a discard, starts the claim timer, and cancels it once everyone passes", async () => {
    const world = await createSocketWorld();
    const sockets = [
      await world.seat(0),
      await world.seat(1),
      await world.seat(2),
      await world.seat(3),
    ];
    const [dealer] = sockets;
    if (dealer == null) {
      throw new Error("expected the dealer socket");
    }

    await world.handlers.discard.handle(dealer, {
      gameId: world.play.gameId,
      tileId: await drawnTileId(world, 0),
    });

    expect(events(dealer)).toEqual([
      SocketEvent.Discarded,
      SocketEvent.ClaimWindow,
      SocketEvent.PublicState,
    ]);
    expect(world.timers.active().map((timer) => timer.ms)).toEqual([ClaimWindowMs.FiveSeconds]);

    for (const socket of sockets.slice(1)) {
      await world.handlers.passClaim.handle(socket, { gameId: world.play.gameId });
    }

    expect(world.timers.active()).toHaveLength(0);
    const nextSeat = sockets[1];
    expect(nextSeat == null ? [] : events(nextSeat).slice(-3)).toEqual([
      SocketEvent.Turn,
      SocketEvent.Drew,
      SocketEvent.PublicState,
    ]);
    expect(events(sockets[2] ?? dealer)).not.toContain(SocketEvent.Drew);
  });

  it("passes unanswered seats when the claim timer fires", async () => {
    const world = await createSocketWorld();
    const dealer = await world.seat(0);
    await world.handlers.discard.handle(dealer, {
      gameId: world.play.gameId,
      tileId: await drawnTileId(world, 0),
    });

    world.timers.active()[0]?.fire();
    await world.handlers.coordinator.settled();

    expect(events(dealer).slice(-2)).toEqual([SocketEvent.Turn, SocketEvent.PublicState]);
    expect((await world.play.round()).currentSeatIndex).toBe(1);
  });

  it("queues passes that arrive at once so each one counts", async () => {
    const world = await createSocketWorld();
    const sockets = [
      await world.seat(0),
      await world.seat(1),
      await world.seat(2),
      await world.seat(3),
    ];
    const dealer = sockets[0];
    if (dealer == null) {
      throw new Error("expected the dealer socket");
    }
    await world.handlers.discard.handle(dealer, {
      gameId: world.play.gameId,
      tileId: await drawnTileId(world, 0),
    });

    await Promise.all(
      sockets
        .slice(1)
        .map((socket) => world.handlers.passClaim.handle(socket, { gameId: world.play.gameId })),
    );

    expect(roomEvents(world, gameRoom(world.play.gameId))).toContain(SocketEvent.Turn);
    expect(sockets.flatMap(events)).not.toContain(SocketEvent.ActionError);
  });

  it("sends actionError only to the socket that broke a rule", async () => {
    const world = await createSocketWorld();
    const dealer = await world.seat(0);
    const other = await world.seat(1);

    await world.handlers.draw.handle(other, { gameId: world.play.gameId });
    await world.handlers.claim.handle(other, {
      gameId: world.play.gameId,
      kind: "pong",
      tileIds: "not-a-list",
    });

    expect(other.received).toEqual([
      { event: SocketEvent.ActionError, payload: { error: SocketError.AutoDrawEnabled } },
      { event: SocketEvent.ActionError, payload: { error: SocketError.InvalidBody } },
    ]);
    expect(dealer.received).toEqual([]);
  });

  it("wins through declareWin and stops any timer", async () => {
    const world = await createSocketWorld({
      wall: { hands: [["red", "red", "red", "east"]], draws: ["east"] },
      body: { ruleset: "hongKong", handTileCount: 4, winMeldCount: 1 },
    });
    const dealer = await world.seat(0);

    await world.handlers.declareWin.handle(dealer, { gameId: world.play.gameId });

    expect(events(dealer)).toEqual([SocketEvent.RoundEnded, SocketEvent.PublicState]);
    expect(world.timers.active()).toHaveLength(0);
  });
});

describe("DisconnectHandler", () => {
  it("reports a seat offline only when its last socket leaves", async () => {
    const world = await createSocketWorld();
    const watcher = await world.seat(0);
    const first = await world.seat(1);
    const second = await world.seat(1);

    world.fake.disconnect(first);
    await world.handlers.disconnect.handle(first);
    expect(events(watcher)).toEqual([]);

    world.fake.disconnect(second);
    await world.handlers.disconnect.handle(second);
    expect(watcher.received).toEqual([
      { event: SocketEvent.Presence, payload: { seatIndex: 1, connected: false } },
    ]);
  });
});

describe("GameFanoutHandler", () => {
  it("emits gameAborted, empties the rooms, and stops the timer", async () => {
    const world = await createSocketWorld();
    const dealer = await world.seat(0);
    await world.handlers.discard.handle(dealer, {
      gameId: world.play.gameId,
      tileId: await drawnTileId(world, 0),
    });

    await world.handlers.fanout.handle(
      JSON.stringify({ event: GameChannelEvent.GameAborted, gameId: world.play.gameId }),
    );

    expect(events(dealer).at(-1)).toBe(SocketEvent.GameAborted);
    expect(dealer.rooms.size).toBe(0);
    expect(world.timers.active()).toHaveLength(0);
  });

  it("refreshes every seat's hand and the public state when the table changes", async () => {
    const world = await createSocketWorld();
    const seats = [await world.seat(0), await world.seat(3)];

    await world.handlers.fanout.handle(
      JSON.stringify({ event: GameChannelEvent.GameChanged, gameId: world.play.gameId }),
    );

    for (const socket of seats) {
      expect(events(socket).sort()).toEqual([SocketEvent.PublicState, SocketEvent.SelfHand].sort());
    }
  });

  it("moves sockets to the next wind's game", async () => {
    const world = await createSocketWorld({
      wall: { hands: [["red", "red", "red", "east"]], draws: ["east"] },
      body: { ruleset: "hongKong", handTileCount: 4, winMeldCount: 1 },
    });
    const dealer = await world.seat(0);
    await world.handlers.declareWin.handle(dealer, { gameId: world.play.gameId });
    for (const seatIndex of [0, 1, 2, 3]) {
      await world.play.gamesLogic.agreeNextWind(
        world.play.gameId,
        userAt(world.play, seatIndex),
        playNow,
      );
    }
    const nextWind = world.play.tables.nextWinds[0];
    if (nextWind == null) {
      throw new Error("expected a next wind notice");
    }
    dealer.received.length = 0;

    await world.handlers.fanout.handle(
      JSON.stringify({ event: GameChannelEvent.NextWind, ...nextWind }),
    );

    expect([...dealer.rooms]).toEqual([
      gameRoom(nextWind.nextGameId),
      seatRoom(nextWind.nextGameId, 0),
    ]);
    expect(events(dealer)[0]).toBe(SocketEvent.Joined);
  });

  it("ignores messages it cannot parse", async () => {
    const world = await createSocketWorld();
    await expect(world.handlers.fanout.handle("{")).resolves.toBeUndefined();
  });
});

describe("PingHandler", () => {
  it("answers pong", async () => {
    const world = await createSocketWorld();
    const socket = world.fake.connect(undefined);
    world.handlers.ping.handle(socket);
    expect(events(socket)).toEqual([SocketEvent.Pong]);
  });
});
