import { describe, expect, it } from "vitest";
import { PlayLogic } from "../../logic/client/game/playLogic";
import { MeldType } from "../../types/server/meldType";
import { RoundPhase } from "../../types/server/roundPhase";
import { SocketError } from "../../types/server/socketError";
import { GameStatus } from "../../types/server/gameStatus";
import { waitingSnapshot } from "./snapshotFixture";

const gameId = "11111111-1111-4111-8111-111111111111";
const tileA = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const tileB = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

function inProgressSnapshot(phase: RoundPhase, currentSeatIndex: number, autoDraw = true) {
  const snapshot = waitingSnapshot({ gameId, status: GameStatus.InProgress });
  snapshot.round = {
    phase,
    currentSeatIndex,
    resultType: null,
    winKind: null,
    wallRemainingCount: 80,
  };
  snapshot.game.autoDraw = autoDraw;
  snapshot.game.dealerSeatIndex = 0;
  snapshot.self = {
    seatIndex: 0,
    handTiles: [
      { id: tileA, tileCode: "man_1", sortIndex: 0, isDrawn: false },
      { id: tileB, tileCode: "man_2", sortIndex: 1, isDrawn: true },
    ],
  };
  return snapshot;
}

describe("PlayLogic", () => {
  it("applies a snapshot then socket hand and turn events", () => {
    const play = new PlayLogic();
    play.applySnapshot(inProgressSnapshot(RoundPhase.Discard, 0));
    expect(play.hand.map((tile) => tile.tileCode)).toEqual(["man_1", "man_2"]);
    play.applySelfHand({
      tiles: [{ tileId: tileA, tileCode: "bam_5", sortIndex: 0, isDrawn: false }],
    });
    expect(play.hand).toEqual([{ id: tileA, tileCode: "bam_5", sortIndex: 0, isDrawn: false }]);
    play.applyTurn({ currentSeatIndex: 1, phase: RoundPhase.Draw });
    expect(play.round?.currentSeatIndex).toBe(1);
    expect(play.round?.phase).toBe(RoundPhase.Draw);
  });

  it("enables draw only on this seat in draw phase when autoDraw is false", () => {
    const play = new PlayLogic();
    play.applySnapshot(inProgressSnapshot(RoundPhase.Draw, 0, false));
    expect(play.canDraw).toBe(true);
    play.applySnapshot(inProgressSnapshot(RoundPhase.Draw, 0, true));
    expect(play.canDraw).toBe(false);
    play.applySnapshot(inProgressSnapshot(RoundPhase.Discard, 0, false));
    expect(play.canDraw).toBe(false);
  });

  it("maps discard and claim intents to parsed socket payloads", () => {
    const emitted: object[] = [];
    const play = new PlayLogic({
      draw() {},
      discard(payload) {
        emitted.push(payload);
      },
      claim(payload) {
        emitted.push(payload);
      },
      passClaim() {},
      declareWin() {},
    });
    play.applySnapshot(inProgressSnapshot(RoundPhase.Discard, 0));
    play.toggleTile(tileA);
    play.discard(gameId);
    expect(emitted).toEqual([{ gameId, tileId: tileA }]);
    play.applyTurn({ currentSeatIndex: 0, phase: RoundPhase.Claim });
    play.selectedTileIds = [tileA, tileB];
    play.claim(gameId, MeldType.Chow);
    expect(emitted[1]).toEqual({ gameId, kind: MeldType.Chow, tileIds: [tileA, tileB] });
  });

  it("stores actionError on the view model and ignores enablement for the server", () => {
    const play = new PlayLogic();
    play.applyActionError({ error: SocketError.NotYourTurn });
    expect(play.view.error).toBe(SocketError.NotYourTurn);
  });

  it("records a claim window timeout for display only", () => {
    const play = new PlayLogic();
    play.applySnapshot(inProgressSnapshot(RoundPhase.Claim, 1));
    play.applyClaimWindow({ discardSeatIndex: 1, tileCode: "east", timeoutMs: 5000 });
    expect(play.view.claimTimeoutMs).toBe(5000);
    play.applyClaimWindow({ discardSeatIndex: 1, tileCode: "east", timeoutMs: null });
    expect(play.view.claimTimeoutMs).toBeNull();
  });
});
