import { type ClaimWindowStore } from "./claimWindowStore";
import { DiscardTilesLogic } from "./discardTilesLogic";
import { FlowerTilesLogic } from "./flowerTilesLogic";
import { type GameRandom } from "./gameRandom";
import { GamesLogic, type GameRedis } from "./gamesLogic";
import { HandsLogic } from "./handsLogic";
import { HandTilesLogic } from "./handTilesLogic";
import { type SnapshotRepos } from "./loadGameSnapshot";
import { MeldTilesLogic } from "./meldTilesLogic";
import { MeldsLogic } from "./meldsLogic";
import { RoundScoresLogic } from "./roundScoresLogic";
import { RoundsLogic } from "./roundsLogic";
import { ScorePaymentsLogic } from "./scorePaymentsLogic";
import { SeatsLogic, type GameTransaction } from "./seatsLogic";
import { WallTilesLogic } from "./wallTilesLogic";

export type GameLogicOptions = {
  repos: SnapshotRepos;
  runTransaction: GameTransaction;
  random: GameRandom;
  redis: GameRedis;
  claimWindowStore: ClaimWindowStore;
};

export type GameLogics = {
  gamesLogic: GamesLogic;
  seatsLogic: SeatsLogic;
  roundsLogic: RoundsLogic;
};

export function createGameLogics(options: GameLogicOptions): GameLogics {
  const { repos, random } = options;
  const roundsLogic = new RoundsLogic({
    repos,
    wallTilesLogic: new WallTilesLogic(repos.wallTilesRepo),
    handsLogic: new HandsLogic(repos.handsRepo),
    handTilesLogic: new HandTilesLogic(repos.handTilesRepo),
    flowerTilesLogic: new FlowerTilesLogic(repos.flowerTilesRepo),
    discardTilesLogic: new DiscardTilesLogic(repos.discardTilesRepo),
    meldsLogic: new MeldsLogic(repos.meldsRepo, new MeldTilesLogic(repos.meldTilesRepo)),
    roundScoresLogic: new RoundScoresLogic(repos.roundScoresRepo, repos.seatsRepo, repos.userRepo),
    scorePaymentsLogic: new ScorePaymentsLogic(repos.scorePaymentsRepo),
    claimWindowStore: options.claimWindowStore,
    runTransaction: options.runTransaction,
    random,
  });
  const seatsLogic = new SeatsLogic(
    repos.seatsRepo,
    repos.gamesRepo,
    roundsLogic,
    repos,
    options.runTransaction,
    random,
  );
  const gamesLogic = new GamesLogic(
    repos,
    roundsLogic,
    seatsLogic,
    options.runTransaction,
    random,
    options.redis,
  );
  return { gamesLogic, seatsLogic, roundsLogic };
}
