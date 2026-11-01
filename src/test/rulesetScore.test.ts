import { describe, expect, it } from "vitest";
import {
  defaultMinScoreUnits,
  lockedChowOnlyFromPrevious,
  scoreUnitForRuleset,
} from "../logic/server/game/rulesetScore";
import { Ruleset } from "../types/server/ruleset";
import { ScoreUnit } from "../types/server/scoreUnit";

describe("ruleset score", () => {
  it("scores Hong Kong in fan with a minimum of 3", () => {
    expect(scoreUnitForRuleset(Ruleset.HongKong)).toBe(ScoreUnit.Fan);
    expect(defaultMinScoreUnits(Ruleset.HongKong)).toBe(3);
    expect(lockedChowOnlyFromPrevious(Ruleset.HongKong)).toBe(true);
  });

  it("scores Taiwan in tai", () => {
    expect(scoreUnitForRuleset(Ruleset.Taiwan)).toBe(ScoreUnit.Tai);
    expect(defaultMinScoreUnits(Ruleset.Taiwan)).toBe(0);
    expect(lockedChowOnlyFromPrevious(Ruleset.Taiwan)).toBeUndefined();
  });
});
