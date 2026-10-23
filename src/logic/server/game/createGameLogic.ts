import { runTransaction } from "../db/executor";
import { deleteGameCache, publishGameAborted } from "../redis/gameChannel";
import { UserRepo } from "../user/userRepo";
import { createMemoryClaimWindowStore } from "./claimWindowStore";
import { DiscardTilesRepo } from "./discardTilesRepo";
import { FlowerTilesRepo } from "./flowerTilesRepo";
import { createGameLogics, type GameLogicOptions } from "./gameLogics";
import { defaultGameRandom, type GameRandom } from "./gameRandom";
import { type GamesLogic, type GameRedis } from "./gamesLogic";
import { GamesRepo } from "./gamesRepo";
import { HandsRepo } from "./handsRepo";
import { HandTilesRepo } from "./handTilesRepo";
import { type SnapshotRepos } from "./loadGameSnapshot";
import { MeldTilesRepo } from "./meldTilesRepo";
import { MeldsRepo } from "./meldsRepo";
import { RoundScoresRepo } from "./roundScoresRepo";
import { type RoundsLogic } from "./roundsLogic";
import { RoundsRepo } from "./roundsRepo";
import { ScorePaymentsRepo } from "./scorePaymentsRepo";
import { type SeatsLogic } from "./seatsLogic";
import { SeatsRepo } from "./seatsRepo";
import { WallTilesRepo } from "./wallTilesRepo";

const processClaimWindowStore = createMemoryClaimWindowStore();

export function createSnapshotRepos(): SnapshotRepos {
  return {
    gamesRepo: new GamesRepo(),
    seatsRepo: new SeatsRepo(),
    roundsRepo: new RoundsRepo(),
    handsRepo: new HandsRepo(),
    handTilesRepo: new HandTilesRepo(),
    wallTilesRepo: new WallTilesRepo(),
    discardTilesRepo: new DiscardTilesRepo(),
    flowerTilesRepo: new FlowerTilesRepo(),
    meldsRepo: new MeldsRepo(),
    meldTilesRepo: new MeldTilesRepo(),
    roundScoresRepo: new RoundScoresRepo(),
    scorePaymentsRepo: new ScorePaymentsRepo(),
    userRepo: new UserRepo(),
  };
}

export function createSeatsLogic(
  repos = createSnapshotRepos(),
  random: GameRandom = defaultGameRandom(),
): SeatsLogic {
  return createGameLogics(defaultOptions(repos, random)).seatsLogic;
}

export function createGamesLogic(
  repos = createSnapshotRepos(),
  random: GameRandom = defaultGameRandom(),
  redis: GameRedis = {
    publishAborted: publishGameAborted,
    deleteCache: deleteGameCache,
  },
): GamesLogic {
  return createGameLogics({ ...defaultOptions(repos, random), redis }).gamesLogic;
}

export function createRoundsLogic(
  repos = createSnapshotRepos(),
  random: GameRandom = defaultGameRandom(),
): RoundsLogic {
  return createGameLogics(defaultOptions(repos, random)).roundsLogic;
}

function defaultOptions(repos: SnapshotRepos, random: GameRandom): GameLogicOptions {
  return {
    repos,
    runTransaction,
    random,
    redis: { publishAborted: publishGameAborted, deleteCache: deleteGameCache },
    claimWindowStore: processClaimWindowStore,
  };
}
