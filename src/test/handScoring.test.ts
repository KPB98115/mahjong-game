import { describe, expect, it } from "vitest";
import { evaluateWin, payoutAmount, type WinContext } from "../logic/server/game/handScoring";
import { scoringChartFor } from "../logic/server/game/scoringChart";
import { scoringCatalogVersion } from "../logic/server/game/scoringVersion";
import { type ScoringChart } from "../model/server/scoringChart";
import { MeldType } from "../types/server/meldType";
import { PrevailingWind } from "../types/server/prevailingWind";
import { Ruleset } from "../types/server/ruleset";
import { ScoreUnit } from "../types/server/scoreUnit";
import { ScoringPattern } from "../types/server/scoringPattern";
import { WinKind } from "../types/server/winKind";

function chart(ruleset: Ruleset): ScoringChart {
  const found = scoringChartFor(ruleset, scoringCatalogVersion);
  if (found == null) {
    throw new Error(`missing chart ${ruleset}`);
  }
  return found;
}

function context(overrides: Partial<WinContext>): WinContext {
  return {
    concealedTileCodes: [],
    exposedMelds: [],
    winKind: WinKind.Discard,
    setsNeeded: 4,
    seatWindIndex: 1,
    prevailingWind: PrevailingWind.East,
    isDealer: false,
    flowerTileCodes: [],
    bonusTilesEnabled: true,
    wallEmpty: false,
    robbingKong: false,
    ...overrides,
  };
}

const allChowsHand = [
  "man_1",
  "man_2",
  "man_3",
  "man_4",
  "man_5",
  "man_6",
  "bam_2",
  "bam_3",
  "bam_4",
  "dot_3",
  "dot_4",
  "dot_5",
  "west",
  "west",
];

const orphans = [
  "man_1",
  "man_9",
  "bam_1",
  "bam_9",
  "dot_1",
  "dot_9",
  "east",
  "south",
  "west",
  "north",
  "red",
  "green",
  "white",
];

describe("scoringChartFor", () => {
  it("loads the pinned hong kong and taiwan charts", () => {
    expect(chart(Ruleset.HongKong)).toMatchObject({
      version: scoringCatalogVersion,
      scoreUnit: ScoreUnit.Fan,
    });
    expect(chart(Ruleset.Taiwan)).toMatchObject({
      version: scoringCatalogVersion,
      scoreUnit: ScoreUnit.Tai,
    });
  });

  it("returns undefined for a version that was never shipped", () => {
    expect(scoringChartFor(Ruleset.HongKong, "1999-01-01")).toBeUndefined();
  });
});

describe("evaluateWin (hong kong)", () => {
  it("scores a concealed all-chow discard win with no flowers", () => {
    expect(
      evaluateWin(chart(Ruleset.HongKong), context({ concealedTileCodes: allChowsHand })),
    ).toEqual({
      units: 3,
      patterns: [
        { pattern: ScoringPattern.ConcealedHand, units: 1 },
        { pattern: ScoringPattern.NoFlowers, units: 1 },
        { pattern: ScoringPattern.AllChows, units: 1 },
      ],
    });
  });

  it("adds robbing the kong to a discard-style win", () => {
    expect(
      evaluateWin(
        chart(Ruleset.HongKong),
        context({ concealedTileCodes: allChowsHand, robbingKong: true }),
      ),
    ).toEqual({
      units: 4,
      patterns: [
        { pattern: ScoringPattern.ConcealedHand, units: 1 },
        { pattern: ScoringPattern.NoFlowers, units: 1 },
        { pattern: ScoringPattern.RobbingKong, units: 1 },
        { pattern: ScoringPattern.AllChows, units: 1 },
      ],
    });
    expect(
      evaluateWin(
        chart(Ruleset.Taiwan),
        context({ concealedTileCodes: allChowsHand, robbingKong: true }),
      )?.patterns,
    ).toContainEqual({ pattern: ScoringPattern.RobbingKong, units: 1 });
  });

  it("counts the seat flower and a full set of flowers", () => {
    const score = evaluateWin(
      chart(Ruleset.HongKong),
      context({
        concealedTileCodes: allChowsHand,
        seatWindIndex: 2,
        flowerTileCodes: ["flower_plum", "flower_orchid", "flower_chrysanthemum", "flower_bamboo"],
      }),
    );
    expect(score?.patterns).toEqual([
      { pattern: ScoringPattern.ConcealedHand, units: 1 },
      { pattern: ScoringPattern.OwnFlower, units: 1 },
      { pattern: ScoringPattern.FlowerSet, units: 2 },
      { pattern: ScoringPattern.AllChows, units: 1 },
    ]);
    expect(score?.units).toBe(5);
  });

  it("picks the best split: all pongs full flush beats chows", () => {
    const score = evaluateWin(
      chart(Ruleset.HongKong),
      context({
        concealedTileCodes: [
          "dot_1",
          "dot_1",
          "dot_1",
          "dot_2",
          "dot_2",
          "dot_2",
          "dot_3",
          "dot_3",
          "dot_3",
          "dot_9",
          "dot_9",
        ],
        exposedMelds: [
          { meldType: MeldType.Pong, isConcealed: false, tileCodes: ["dot_5", "dot_5", "dot_5"] },
        ],
        winKind: WinKind.SelfDraw,
        flowerTileCodes: ["flower_orchid"],
      }),
    );
    expect(score).toEqual({
      units: 12,
      patterns: [
        { pattern: ScoringPattern.SelfDraw, units: 1 },
        { pattern: ScoringPattern.OwnFlower, units: 1 },
        { pattern: ScoringPattern.AllPongs, units: 3 },
        { pattern: ScoringPattern.FullFlush, units: 7 },
      ],
    });
  });

  it("scores half flush with dragon, seat wind, and prevailing wind pongs", () => {
    const score = evaluateWin(
      chart(Ruleset.HongKong),
      context({
        concealedTileCodes: [
          "bam_1",
          "bam_2",
          "bam_3",
          "bam_7",
          "bam_8",
          "bam_9",
          "red",
          "red",
          "red",
          "east",
          "east",
          "east",
          "bam_5",
          "bam_5",
        ],
        seatWindIndex: 0,
        isDealer: true,
      }),
    );
    expect(score).toEqual({
      units: 8,
      patterns: [
        { pattern: ScoringPattern.ConcealedHand, units: 1 },
        { pattern: ScoringPattern.NoFlowers, units: 1 },
        { pattern: ScoringPattern.HalfFlush, units: 3 },
        { pattern: ScoringPattern.DragonPong, units: 1 },
        { pattern: ScoringPattern.SeatWindPong, units: 1 },
        { pattern: ScoringPattern.PrevailingWindPong, units: 1 },
      ],
    });
  });

  it("lets big three dragons replace the single dragon pongs", () => {
    const score = evaluateWin(
      chart(Ruleset.HongKong),
      context({
        concealedTileCodes: [
          "white",
          "white",
          "white",
          "man_2",
          "man_3",
          "man_4",
          "dot_8",
          "dot_8",
        ],
        exposedMelds: [
          { meldType: MeldType.Pong, isConcealed: false, tileCodes: ["red", "red", "red"] },
          {
            meldType: MeldType.Kong,
            isConcealed: false,
            tileCodes: ["green", "green", "green", "green"],
          },
        ],
      }),
    );
    expect(score).toEqual({
      units: 9,
      patterns: [
        { pattern: ScoringPattern.NoFlowers, units: 1 },
        { pattern: ScoringPattern.BigThreeDragons, units: 8 },
      ],
    });
  });

  it("caps a limit hand such as thirteen orphans at the chart limit", () => {
    const score = evaluateWin(
      chart(Ruleset.HongKong),
      context({ concealedTileCodes: [...orphans, "red"], winKind: WinKind.SelfDraw }),
    );
    expect(score?.units).toBe(13);
    expect(score?.patterns.map((item) => item.pattern)).toContain(ScoringPattern.ThirteenOrphans);
  });

  it("scores seven pairs and counts the last tile on an empty wall", () => {
    const pairs = ["man_1", "man_9", "bam_3", "dot_5", "east", "red", "white"];
    expect(
      evaluateWin(
        chart(Ruleset.HongKong),
        context({
          concealedTileCodes: pairs.flatMap((code) => [code, code]),
          winKind: WinKind.SelfDraw,
          wallEmpty: true,
        }),
      ),
    ).toEqual({
      units: 8,
      patterns: [
        { pattern: ScoringPattern.SelfDraw, units: 1 },
        { pattern: ScoringPattern.ConcealedHand, units: 1 },
        { pattern: ScoringPattern.NoFlowers, units: 1 },
        { pattern: ScoringPattern.LastTileSelfDraw, units: 1 },
        { pattern: ScoringPattern.SevenPairs, units: 4 },
      ],
    });
  });

  it("returns undefined for a hand that does not win", () => {
    const broken = allChowsHand.slice();
    broken[0] = "north";
    expect(
      evaluateWin(chart(Ruleset.HongKong), context({ concealedTileCodes: broken })),
    ).toBeUndefined();
  });
});

describe("evaluateWin (taiwan)", () => {
  it("does not know seven pairs", () => {
    const pairs = ["man_1", "man_9", "bam_3", "dot_5", "east", "red", "white"];
    expect(
      evaluateWin(
        chart(Ruleset.Taiwan),
        context({ concealedTileCodes: pairs.flatMap((code) => [code, code]) }),
      ),
    ).toBeUndefined();
  });

  it("scores a concealed dealer self-draw with a seat flower", () => {
    const score = evaluateWin(
      chart(Ruleset.Taiwan),
      context({
        concealedTileCodes: [
          "man_1",
          "man_2",
          "man_3",
          "man_4",
          "man_5",
          "man_6",
          "man_7",
          "man_8",
          "man_9",
          "bam_2",
          "bam_3",
          "bam_4",
          "dot_6",
          "dot_7",
          "dot_8",
          "north",
          "north",
        ],
        setsNeeded: 5,
        winKind: WinKind.SelfDraw,
        seatWindIndex: 0,
        isDealer: true,
        flowerTileCodes: ["flower_plum", "season_summer"],
      }),
    );
    expect(score).toEqual({
      units: 6,
      patterns: [
        { pattern: ScoringPattern.SelfDraw, units: 1 },
        { pattern: ScoringPattern.ConcealedHand, units: 1 },
        { pattern: ScoringPattern.Dealer, units: 1 },
        { pattern: ScoringPattern.OwnFlower, units: 1 },
        { pattern: ScoringPattern.AllChows, units: 2 },
      ],
    });
  });
});

describe("payoutAmount", () => {
  it("doubles per fan up to the cap in hong kong", () => {
    const hongKong = chart(Ruleset.HongKong);
    expect(payoutAmount(hongKong, 0)).toBe(1);
    expect(payoutAmount(hongKong, 3)).toBe(8);
    expect(payoutAmount(hongKong, 13)).toBe(1024);
  });

  it("pays base plus tai in taiwan", () => {
    expect(payoutAmount(chart(Ruleset.Taiwan), 6)).toBe(7);
  });
});
