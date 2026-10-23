import { describe, expect, it } from "vitest";
import {
  findStandardShapes,
  isSevenPairs,
  isThirteenOrphans,
} from "../logic/server/game/handShape";
import { formsMeld } from "../logic/server/game/meldsLogic";
import { compareTileCodes, parseTileCode } from "../logic/server/game/tileCode";
import { MeldType } from "../types/server/meldType";
import { TileKind, TileSuit } from "../types/server/tile";

describe("parseTileCode", () => {
  it("reads suited, wind, dragon, and bonus codes", () => {
    expect(parseTileCode("bam_5")).toEqual({
      code: "bam_5",
      kind: TileKind.Suited,
      suit: TileSuit.Bam,
      rank: 5,
    });
    expect(parseTileCode("east")).toMatchObject({ kind: TileKind.Wind, suit: null, rank: null });
    expect(parseTileCode("white")).toMatchObject({ kind: TileKind.Dragon });
    expect(parseTileCode("flower_plum")).toMatchObject({ kind: TileKind.Bonus });
    expect(parseTileCode("season_winter")).toMatchObject({ kind: TileKind.Bonus });
  });

  it("rejects unknown codes", () => {
    for (const code of ["bam_0", "bam_10", "man", "dot_x", "flower_rose", "joker", ""]) {
      expect(parseTileCode(code)).toBeUndefined();
    }
  });

  it("orders suits, then winds, dragons, and bonus tiles", () => {
    const sorted = ["red", "bam_2", "east", "man_9", "dot_1", "man_1", "flower_plum"].sort(
      compareTileCodes,
    );
    expect(sorted).toEqual(["man_1", "man_9", "bam_2", "dot_1", "east", "red", "flower_plum"]);
  });
});

describe("formsMeld", () => {
  it("accepts a same-suit run as a chow in any order", () => {
    expect(formsMeld(MeldType.Chow, ["dot_5", "dot_3", "dot_4"])).toBe(true);
    expect(formsMeld(MeldType.Chow, ["dot_3", "bam_4", "dot_5"])).toBe(false);
    expect(formsMeld(MeldType.Chow, ["east", "south", "west"])).toBe(false);
    expect(formsMeld(MeldType.Chow, ["dot_3", "dot_3", "dot_4"])).toBe(false);
  });

  it("accepts three of a kind as a pong and four as a kong", () => {
    expect(formsMeld(MeldType.Pong, ["red", "red", "red"])).toBe(true);
    expect(formsMeld(MeldType.Pong, ["red", "red", "green"])).toBe(false);
    expect(formsMeld(MeldType.Kong, ["man_1", "man_1", "man_1", "man_1"])).toBe(true);
    expect(formsMeld(MeldType.Kong, ["man_1", "man_1", "man_1"])).toBe(false);
  });

  it("never treats bonus tiles as a meld", () => {
    expect(formsMeld(MeldType.Pong, ["flower_plum", "flower_plum", "flower_plum"])).toBe(false);
  });
});

describe("findStandardShapes", () => {
  it("splits a winning hand into sets and one pair", () => {
    const shapes = findStandardShapes(
      [
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
      ],
      4,
    );
    expect(shapes).toHaveLength(1);
    expect(shapes[0]).toEqual({
      pair: "west",
      sets: [
        { meldType: MeldType.Chow, tileCodes: ["man_1", "man_2", "man_3"] },
        { meldType: MeldType.Chow, tileCodes: ["man_4", "man_5", "man_6"] },
        { meldType: MeldType.Chow, tileCodes: ["bam_2", "bam_3", "bam_4"] },
        { meldType: MeldType.Chow, tileCodes: ["dot_3", "dot_4", "dot_5"] },
      ],
    });
  });

  it("returns every split so scoring can pick the best one", () => {
    const shapes = findStandardShapes(
      [
        "dot_1",
        "dot_1",
        "dot_1",
        "dot_2",
        "dot_2",
        "dot_2",
        "dot_3",
        "dot_3",
        "dot_3",
        "red",
        "red",
      ],
      3,
    );
    const kinds = shapes.map((shape) => shape.sets.map((set) => set.meldType).join(","));
    expect(kinds).toContain("pong,pong,pong");
    expect(kinds).toContain("chow,chow,chow");
  });

  it("only needs the sets that are not already exposed", () => {
    expect(findStandardShapes(["bam_7", "bam_8", "bam_9", "south", "south"], 1)).toHaveLength(1);
    expect(findStandardShapes(["south", "south"], 0)).toEqual([{ pair: "south", sets: [] }]);
  });

  it("returns nothing for a hand that does not win", () => {
    expect(
      findStandardShapes(
        [
          "man_1",
          "man_2",
          "man_4",
          "man_5",
          "man_6",
          "man_7",
          "bam_2",
          "bam_3",
          "bam_4",
          "dot_3",
          "dot_4",
          "dot_5",
          "west",
          "west",
        ],
        4,
      ),
    ).toEqual([]);
    expect(findStandardShapes(["east", "south", "west", "west", "west"], 1)).toEqual([]);
    expect(findStandardShapes(["flower_plum", "flower_plum"], 0)).toEqual([]);
    expect(findStandardShapes(["man_1", "man_1", "man_1"], 1)).toEqual([]);
  });
});

describe("special shapes", () => {
  it("recognises seven distinct pairs", () => {
    const pairs = ["man_1", "man_9", "bam_3", "dot_5", "east", "red", "white"];
    expect(isSevenPairs(pairs.flatMap((code) => [code, code]))).toBe(true);
    expect(
      isSevenPairs([
        "man_1",
        "man_1",
        "man_1",
        "man_1",
        ...pairs.slice(1, 6).flatMap((c) => [c, c]),
      ]),
    ).toBe(false);
    expect(isSevenPairs(pairs.flatMap((code) => [code, code]).slice(0, 12))).toBe(false);
  });

  it("recognises thirteen orphans with one duplicate", () => {
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
    expect(isThirteenOrphans([...orphans, "red"])).toBe(true);
    expect(isThirteenOrphans([...orphans.slice(1), "man_2", "red"])).toBe(false);
    expect(isThirteenOrphans(orphans)).toBe(false);
  });
});
