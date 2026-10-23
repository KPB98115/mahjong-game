import { ClaimWindowMs } from "../../../types/server/claimWindowMs";
import { DiscardWinPayer } from "../../../types/server/discardWinPayer";
import { Ruleset } from "../../../types/server/ruleset";
import { ScoreUnit } from "../../../types/server/scoreUnit";

export type GamePageOptions = {
  rulesets: Ruleset[];
  claimWindowMsOptions: Array<ClaimWindowMs | null>;
  scoreUnits: ScoreUnit[];
  discardWinPayers: DiscardWinPayer[];
  defaults: {
    autoDraw: boolean;
    claimWindowMs: ClaimWindowMs | null;
  };
};

export function staticGamePageOptions(): GamePageOptions {
  return {
    rulesets: [Ruleset.HongKong, Ruleset.Taiwan],
    claimWindowMsOptions: [ClaimWindowMs.FiveSeconds, ClaimWindowMs.TenSeconds, null],
    scoreUnits: [ScoreUnit.Fan, ScoreUnit.Tai],
    discardWinPayers: [DiscardWinPayer.Discarder, DiscardWinPayer.AllThree],
    defaults: { autoDraw: true, claimWindowMs: ClaimWindowMs.FiveSeconds },
  };
}
