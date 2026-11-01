import { describe, expect, it } from "vitest";
import {
  createGameWireBody,
  emptyCreateGameViewModel,
  selectRuleset,
} from "../../model/client/createGameViewModel";
import { ClaimWindowMs } from "../../types/server/claimWindowMs";
import { Ruleset } from "../../types/server/ruleset";
import { ScoreUnit } from "../../types/server/scoreUnit";

const defaults = { autoDraw: true, claimWindowMs: ClaimWindowMs.FiveSeconds };

describe("create game view", () => {
  it("starts on Hong Kong fan with a minimum of 3", () => {
    const view = emptyCreateGameViewModel(defaults);
    expect(view.ruleset).toBe(Ruleset.HongKong);
    expect(view.scoreUnit).toBe(ScoreUnit.Fan);
    expect(view.minScoreUnits).toBe(3);
    expect(createGameWireBody(view)).toMatchObject({
      ruleset: Ruleset.HongKong,
      scoreUnit: ScoreUnit.Fan,
      minScoreUnits: 3,
      chowOnlyFromPrevious: true,
    });
  });

  it("follows the ruleset when the player switches tables", () => {
    const view = emptyCreateGameViewModel(defaults);
    selectRuleset(view, Ruleset.Taiwan);
    expect(view.scoreUnit).toBe(ScoreUnit.Tai);
    expect(view.minScoreUnits).toBe(0);
    view.minScoreUnits = 8;
    view.minScoreTouched = true;
    view.chowOnlyFromPrevious = false;
    view.chowTouched = true;
    selectRuleset(view, Ruleset.HongKong);
    expect(view.scoreUnit).toBe(ScoreUnit.Fan);
    expect(view.minScoreUnits).toBe(8);
    expect(view.chowOnlyFromPrevious).toBe(true);
    expect(createGameWireBody(view).chowOnlyFromPrevious).toBe(true);
  });
});
