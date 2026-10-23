import { describe, expect, it } from "vitest";
import { tileFaceFileName } from "../../logic/client/game/tileFace";
import { DragonTile, FlowerTile, SeasonTile, TileSuit, WindTile } from "../../types/server/tile";

describe("tileFaceFileName", () => {
  it("maps every live tile code to a vendored svg name", () => {
    const expected = new Map<string, string>();
    for (const suit of Object.values(TileSuit)) {
      for (let rank = 1; rank <= 9; rank += 1) {
        expected.set(`${suit}_${rank}`, `${suit}_${rank}.svg`);
      }
    }
    for (const wind of Object.values(WindTile)) {
      expected.set(wind, `${wind}.svg`);
    }
    for (const dragon of Object.values(DragonTile)) {
      expected.set(dragon, `${dragon}.svg`);
    }
    for (const flower of Object.values(FlowerTile)) {
      expected.set(flower, `${flower}.svg`);
    }
    for (const season of Object.values(SeasonTile)) {
      expected.set(season, `${season}.svg`);
    }
    for (const [code, fileName] of expected) {
      expect(tileFaceFileName(code)).toBe(fileName);
    }
  });

  it("falls back to no image for an unknown code", () => {
    expect(tileFaceFileName("nope")).toBeUndefined();
    expect(tileFaceFileName("man_0")).toBeUndefined();
  });
});
