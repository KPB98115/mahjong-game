import { type GameStatus } from "./gameStatus";
import { type PrevailingWind } from "./prevailingWind";
import { type Ruleset } from "./ruleset";

export enum UserAttributeName {
  DisplayName = "displayName",
}

export enum UserFigureName {
  GamesPlayed = "games_played",
  Wins = "wins",
  RunningScore = "running_score",
}

export enum UserFigureJsonKey {
  GamesPlayed = "gamesPlayed",
  Wins = "wins",
  RunningScore = "runningScore",
}

export type CurrentGame = {
  gameId: string;
  referenceCode: string;
  status: GameStatus;
  prevailingWind: PrevailingWind;
  ruleset: Ruleset;
  seatIndex: number;
};

export type ProfileResponse = {
  userId: string;
  attributes: Record<string, string>;
  figures: Partial<Record<UserFigureJsonKey, number>>;
  currentGame: CurrentGame | null;
};
