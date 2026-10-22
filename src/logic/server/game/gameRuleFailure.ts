import { type GameActionErr } from "../../../model/server/actionResult";

export class GameRuleFailure extends Error {
  constructor(readonly failure: GameActionErr) {
    super(failure.error);
    this.name = "GameRuleFailure";
  }
}

export function readGameRuleFailure(error: object): GameActionErr | undefined {
  if (error instanceof GameRuleFailure) {
    return error.failure;
  }
  return undefined;
}
