import { Ruleset } from "../../../types/server/ruleset";
import { ScoreUnit } from "../../../types/server/scoreUnit";

const hongKongMinScoreUnits = 3;
const taiwanMinScoreUnits = 0;

export function scoreUnitForRuleset(ruleset: Ruleset): ScoreUnit {
  if (ruleset === Ruleset.HongKong) {
    return ScoreUnit.Fan;
  }
  return ScoreUnit.Tai;
}

export function defaultMinScoreUnits(ruleset: Ruleset): number {
  if (ruleset === Ruleset.HongKong) {
    return hongKongMinScoreUnits;
  }
  return taiwanMinScoreUnits;
}

export function lockedChowOnlyFromPrevious(ruleset: Ruleset): boolean | undefined {
  if (ruleset === Ruleset.HongKong) {
    return true;
  }
  return undefined;
}
