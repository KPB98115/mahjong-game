import { parseCreateGameBody } from "../server/createGameBody";
import { ClaimWindowMs } from "../../types/server/claimWindowMs";
import { type DiscardWinPayer } from "../../types/server/discardWinPayer";
import { type JsonValue } from "../../types/server/jsonValue";
import { Ruleset } from "../../types/server/ruleset";
import { type ScoreUnit } from "../../types/server/scoreUnit";
import {
  defaultMinScoreUnits,
  lockedChowOnlyFromPrevious,
  scoreUnitForRuleset,
} from "../../logic/server/game/rulesetScore";

export type CreateGameDefaults = {
  autoDraw: boolean;
  claimWindowMs: ClaimWindowMs | null;
};

export type CreateGameViewModel = {
  ruleset: Ruleset;
  scoreUnit: ScoreUnit;
  discardWinPayer: DiscardWinPayer | undefined;
  claimWindowMs: ClaimWindowMs | null;
  autoDraw: boolean;
  bonusTilesEnabled: boolean | undefined;
  chowOnlyFromPrevious: boolean | undefined;
  handTileCount: number | undefined;
  winMeldCount: number | undefined;
  minScoreUnits: number | undefined;
  minScoreTouched: boolean;
  claimWindowTouched: boolean;
  autoDrawTouched: boolean;
  bonusTilesTouched: boolean;
  chowTouched: boolean;
};

export function emptyCreateGameViewModel(defaults: CreateGameDefaults): CreateGameViewModel {
  const ruleset = Ruleset.HongKong;
  return {
    ruleset,
    scoreUnit: scoreUnitForRuleset(ruleset),
    discardWinPayer: undefined,
    claimWindowMs: defaults.claimWindowMs,
    autoDraw: defaults.autoDraw,
    bonusTilesEnabled: true,
    chowOnlyFromPrevious: true,
    handTileCount: undefined,
    winMeldCount: undefined,
    minScoreUnits: defaultMinScoreUnits(ruleset),
    minScoreTouched: false,
    claimWindowTouched: false,
    autoDrawTouched: false,
    bonusTilesTouched: false,
    chowTouched: false,
  };
}

export function selectRuleset(view: CreateGameViewModel, ruleset: Ruleset): void {
  view.ruleset = ruleset;
  view.scoreUnit = scoreUnitForRuleset(ruleset);
  const lockedChow = lockedChowOnlyFromPrevious(ruleset);
  if (lockedChow != null) {
    view.chowOnlyFromPrevious = lockedChow;
  }
  if (!view.minScoreTouched) {
    view.minScoreUnits = defaultMinScoreUnits(ruleset);
  }
}

export function createGameWireBody(view: CreateGameViewModel): JsonValue {
  const body: { [key: string]: JsonValue } = {
    ruleset: view.ruleset,
    scoreUnit: view.scoreUnit,
  };
  if (view.discardWinPayer != null) {
    body.discardWinPayer = view.discardWinPayer;
  }
  if (view.claimWindowTouched) {
    body.claimWindowMs = view.claimWindowMs;
  }
  if (view.autoDrawTouched) {
    body.autoDraw = view.autoDraw;
  }
  if (view.bonusTilesTouched && view.bonusTilesEnabled != null) {
    body.bonusTilesEnabled = view.bonusTilesEnabled;
  }
  const lockedChow = lockedChowOnlyFromPrevious(view.ruleset);
  if (lockedChow != null) {
    body.chowOnlyFromPrevious = lockedChow;
  } else if (view.chowTouched && view.chowOnlyFromPrevious != null) {
    body.chowOnlyFromPrevious = view.chowOnlyFromPrevious;
  }
  if (view.handTileCount != null) {
    body.handTileCount = view.handTileCount;
  }
  if (view.winMeldCount != null) {
    body.winMeldCount = view.winMeldCount;
  }
  if (view.minScoreUnits != null) {
    body.minScoreUnits = view.minScoreUnits;
  }
  return body;
}

export function parsedCreateGameBody(view: CreateGameViewModel) {
  return parseCreateGameBody(createGameWireBody(view));
}
