import { describe, expect, it } from "vitest";
import { type PlayOutcome } from "../model/server/playResult";
import { RoundPhase } from "../types/server/roundPhase";
import { SocketError } from "../types/server/socketError";
import { SocketEvent } from "../types/server/socketEvent";
import { createPlayWorld, discardDrawn, emittedEvents, playNow, userAt } from "./playWorld";

function outcomesWith(outcomes: PlayOutcome[], event: SocketEvent): PlayOutcome[] {
  return outcomes.filter((outcome) => outcome.ok && emittedEvents(outcome).includes(event));
}

describe("actions that arrive at the same time", () => {
  it("counts every pass sent at once and resolves the window exactly once", async () => {
    const world = await createPlayWorld();
    await discardDrawn(world, 0);

    const outcomes = await Promise.all(
      [1, 2, 3].map((seatIndex) =>
        world.roundsLogic.passClaim({
          gameId: world.gameId,
          userId: userAt(world, seatIndex),
          now: playNow,
        }),
      ),
    );

    expect(outcomes.every((outcome) => outcome.ok)).toBe(true);
    expect(outcomesWith(outcomes, SocketEvent.Turn)).toHaveLength(1);
    const round = await world.round();
    expect(round.currentSeatIndex).toBe(1);
    expect(round.phase).toBe(RoundPhase.Discard);
    expect(await world.hand(1)).toHaveLength(14);
  });

  it("commits a discard sent twice at once only once", async () => {
    const world = await createPlayWorld();
    const tile = (await world.hand(0)).find((row) => row.isDrawn);
    if (tile == null) {
      throw new Error("dealer should hold a drawn tile");
    }
    const input = { gameId: world.gameId, userId: userAt(world, 0), tileId: tile.id, now: playNow };

    const outcomes = await Promise.all([
      world.roundsLogic.discard(input),
      world.roundsLogic.discard(input),
    ]);

    expect(outcomes.filter((outcome) => outcome.ok)).toHaveLength(1);
    expect(outcomes.filter((outcome) => !outcome.ok)).toEqual([
      { ok: false, error: SocketError.NotYourTurn },
    ]);
    const round = await world.round();
    expect(await world.tables.discardTilesRepo.findByRoundId(round.id)).toHaveLength(1);
    expect(await world.hand(0)).toHaveLength(13);
  });

  it("locks the game row inside every play transaction", async () => {
    const world = await createPlayWorld();
    const before = world.tables.lockedGameIds.length;
    await discardDrawn(world, 0);
    expect(world.tables.lockedGameIds.slice(before)).toEqual([world.gameId]);
  });
});
