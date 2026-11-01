import { describe, expect, it } from "vitest";
import {
  SuggestedAction,
  claimTrayOpen,
  liveDiscard,
  suggestAction,
  timerSeconds,
} from "../../logic/client/game/claimSuggestion";
import { MeldType } from "../../types/server/meldType";
import { RoundPhase } from "../../types/server/roundPhase";

const hand = [
  { id: "a", tileCode: "man_2" },
  { id: "b", tileCode: "man_3" },
  { id: "c", tileCode: "man_4" },
  { id: "d", tileCode: "dot_5" },
  { id: "e", tileCode: "dot_5" },
  { id: "f", tileCode: "dot_5" },
  { id: "g", tileCode: "east" },
  { id: "h", tileCode: "east" },
  { id: "i", tileCode: "east" },
  { id: "j", tileCode: "east" },
];

function suggest(
  overrides: Partial<Parameters<typeof suggestAction>[0]> = {},
): ReturnType<typeof suggestAction> {
  return suggestAction({
    phase: RoundPhase.Claim,
    selfSeatIndex: 0,
    hand,
    selectedTileIds: [],
    melds: [],
    discardSeatIndex: 3,
    discardTileCode: "man_5",
    chowOnlyFromPrevious: true,
    canDeclareWin: true,
    canDraw: false,
    canDiscard: false,
    ...overrides,
  });
}

describe("claim suggestion", () => {
  it("suggests a win ahead of kong, pong, and chow", () => {
    const suggestion = suggest({ discardTileCode: "dot_5", discardSeatIndex: 3 });
    expect(suggestion.suggested).toBe(SuggestedAction.Win);
    expect(suggestion.showWin).toBe(true);
    expect(suggestion.showPass).toBe(true);
    expect(suggestion.offers.map((offer) => offer.kind)).toEqual([MeldType.Kong, MeldType.Pong]);
    expect(claimTrayOpen(suggestion)).toBe(true);
  });

  it("suggests kong ahead of pong when a win is not offered", () => {
    const suggestion = suggest({ discardTileCode: "dot_5", canDeclareWin: false });
    expect(suggestion.suggested).toBe(SuggestedAction.Kong);
    expect(suggestion.offers.find((offer) => offer.kind === MeldType.Kong)?.tileIds).toEqual([
      "d",
      "e",
      "f",
    ]);
  });

  it("suggests chow from the previous seat only", () => {
    const fromPrevious = suggest({
      discardTileCode: "man_1",
      discardSeatIndex: 3,
      canDeclareWin: false,
    });
    expect(fromPrevious.suggested).toBe(SuggestedAction.Chow);
    expect(fromPrevious.offers.map((offer) => offer.kind)).toEqual([MeldType.Chow]);
    const fromAcross = suggest({
      discardTileCode: "man_1",
      discardSeatIndex: 1,
      canDeclareWin: false,
    });
    expect(fromAcross.offers).toEqual([]);
    expect(fromAcross.suggested).toBeNull();
    const anySeat = suggest({
      discardTileCode: "man_1",
      discardSeatIndex: 1,
      chowOnlyFromPrevious: false,
      canDeclareWin: false,
    });
    expect(anySeat.suggested).toBe(SuggestedAction.Chow);
  });

  it("uses the selected chow when more than one sequence fits", () => {
    const rich = [
      { id: "a", tileCode: "man_3" },
      { id: "b", tileCode: "man_4" },
      { id: "c", tileCode: "man_6" },
      { id: "d", tileCode: "man_7" },
    ];
    const suggestion = suggest({
      hand: rich,
      discardTileCode: "man_5",
      discardSeatIndex: 3,
      selectedTileIds: ["c", "d"],
      canDeclareWin: false,
    });
    expect(suggestion.offers.find((offer) => offer.kind === MeldType.Chow)?.tileIds).toEqual([
      "c",
      "d",
    ]);
  });

  it("offers only win or pass while robbing a kong", () => {
    const suggestion = suggest({
      phase: RoundPhase.RobKong,
      discardTileCode: "dot_5",
      canDeclareWin: true,
    });
    expect(suggestion.offers).toEqual([]);
    expect(suggestion.suggested).toBe(SuggestedAction.Win);
    expect(suggestion.showPass).toBe(true);
  });

  it("does not offer a claim to the player who discarded", () => {
    const suggestion = suggest({ selfSeatIndex: 3, discardSeatIndex: 3 });
    expect(suggestion.showWin).toBe(false);
    expect(suggestion.showPass).toBe(false);
    expect(suggestion.offers).toEqual([]);
    expect(claimTrayOpen(suggestion)).toBe(false);
  });

  it("suggests a concealed kong on your discard turn, then an added kong", () => {
    const concealed = suggest({
      phase: RoundPhase.Discard,
      discardTileCode: null,
      discardSeatIndex: null,
      canDeclareWin: true,
      canDiscard: true,
    });
    expect(concealed.suggested).toBe(SuggestedAction.Kong);
    expect(concealed.offers[0]?.tileIds).toEqual(["g", "h", "i", "j"]);
    expect(concealed.showWin).toBe(false);
    const added = suggest({
      phase: RoundPhase.Discard,
      hand: [{ id: "z", tileCode: "white" }],
      melds: [{ meldType: MeldType.Pong, tiles: [{ tileCode: "white" }] }],
      discardTileCode: null,
      discardSeatIndex: null,
      canDeclareWin: true,
      canDiscard: true,
      selectedTileIds: [],
    });
    expect(added.offers).toEqual([{ kind: MeldType.Kong, tileIds: ["z"] }]);
    const choosing = suggest({
      phase: RoundPhase.Discard,
      hand: [{ id: "z", tileCode: "bam_1" }],
      canDiscard: true,
      canDeclareWin: true,
      selectedTileIds: ["z"],
      discardTileCode: null,
      discardSeatIndex: null,
    });
    expect(choosing.showWin).toBe(true);
    expect(choosing.suggested).toBe(SuggestedAction.Discard);
  });

  it("reads the claim tile from the window, then from the newest discard", () => {
    expect(
      liveDiscard({
        phase: RoundPhase.Claim,
        claimTileCode: "east",
        claimDiscardSeatIndex: 2,
        discards: [{ seatIndex: 1, tileCode: "man_1", sortIndex: 4 }],
      }),
    ).toEqual({ seatIndex: 2, tileCode: "east" });
    expect(
      liveDiscard({
        phase: RoundPhase.Claim,
        claimTileCode: null,
        claimDiscardSeatIndex: null,
        discards: [
          { seatIndex: 1, tileCode: "man_1", sortIndex: 1 },
          { seatIndex: 2, tileCode: "south", sortIndex: 3 },
        ],
      }),
    ).toEqual({ seatIndex: 2, tileCode: "south" });
    expect(
      liveDiscard({
        phase: RoundPhase.Discard,
        claimTileCode: "east",
        claimDiscardSeatIndex: 2,
        discards: [],
      }),
    ).toBeNull();
  });

  it("shows the active countdown in seconds", () => {
    expect(timerSeconds(2500, 5000)).toBe(3);
    expect(timerSeconds(null, 1000)).toBe(1);
    expect(timerSeconds(null, null)).toBeNull();
  });
});
