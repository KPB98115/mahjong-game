import { type AppDatabase } from "../db/executor";
import { type RoundCache } from "../redis/roundCache";
import { UserRepo } from "../user/userRepo";
import { type ClaimWindowStore } from "./claimWindowStore";
import { DiscardTilesLogic } from "./discardTilesLogic";
import { DiscardTilesRepo } from "./discardTilesRepo";
import { FlowerTilesLogic } from "./flowerTilesLogic";
import { FlowerTilesRepo } from "./flowerTilesRepo";
import { type GameRandom } from "./gameRandom";
import { GamesLogic, type GameRedis } from "./gamesLogic";
import { GamesRepo } from "./gamesRepo";
import { HandsLogic } from "./handsLogic";
import { HandsRepo } from "./handsRepo";
import { HandTilesLogic } from "./handTilesLogic";
import { HandTilesRepo } from "./handTilesRepo";
import { type SnapshotRepos } from "./loadGameSnapshot";
import { MeldTilesLogic } from "./meldTilesLogic";
import { MeldTilesRepo } from "./meldTilesRepo";
import { MeldsLogic } from "./meldsLogic";
import { MeldsRepo } from "./meldsRepo";
import { RoundScoresLogic } from "./roundScoresLogic";
import { RoundScoresRepo } from "./roundScoresRepo";
import { RoundsLogic } from "./roundsLogic";
import { RoundsRepo } from "./roundsRepo";
import { ScorePaymentsLogic } from "./scorePaymentsLogic";
import { ScorePaymentsRepo } from "./scorePaymentsRepo";
import { SeatsLogic, type GameTransaction } from "./seatsLogic";
import { SeatsRepo } from "./seatsRepo";
import { WallTilesLogic } from "./wallTilesLogic";
import { WallTilesRepo } from "./wallTilesRepo";

export type GameLogicOptions = {
  repos: SnapshotRepos;
  runTransaction: GameTransaction;
  random: GameRandom;
  redis: GameRedis;
  claimWindowStore: ClaimWindowStore;
  roundCache: RoundCache;
};

export type GameLogics = {
  gamesLogic: GamesLogic;
  seatsLogic: SeatsLogic;
  roundsLogic: RoundsLogic;
};

export function createSnapshotRepos(database: AppDatabase): SnapshotRepos {
  return {
    gamesRepo: new GamesRepo(database),
    seatsRepo: new SeatsRepo(database),
    roundsRepo: new RoundsRepo(database),
    handsRepo: new HandsRepo(database),
    handTilesRepo: new HandTilesRepo(database),
    wallTilesRepo: new WallTilesRepo(database),
    discardTilesRepo: new DiscardTilesRepo(database),
    flowerTilesRepo: new FlowerTilesRepo(database),
    meldsRepo: new MeldsRepo(database),
    meldTilesRepo: new MeldTilesRepo(database),
    roundScoresRepo: new RoundScoresRepo(database),
    scorePaymentsRepo: new ScorePaymentsRepo(database),
    userRepo: new UserRepo(database),
  };
}

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
    roundCache: options.roundCache,
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
    options.redis,
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
