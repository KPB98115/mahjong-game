import { runTransaction } from "../db/executor";
import { deleteGameCache, publishGameAborted } from "../redis/gameChannel";
import { UserRepo } from "../user/userRepo";
import { DiscardTilesRepo } from "./discardTilesRepo";
import { FlowerTilesRepo } from "./flowerTilesRepo";
import { defaultGameRandom, type GameRandom } from "./gameRandom";
import { GamesLogic, type GameRedis } from "./gamesLogic";
import { GamesRepo } from "./gamesRepo";
import { HandsRepo } from "./handsRepo";
import { HandTilesRepo } from "./handTilesRepo";
import { type SnapshotRepos } from "./loadGameSnapshot";
import { MeldTilesRepo } from "./meldTilesRepo";
import { MeldsRepo } from "./meldsRepo";
import { RoundScoresRepo } from "./roundScoresRepo";
import { RoundsLogic } from "./roundsLogic";
import { RoundsRepo } from "./roundsRepo";
import { ScorePaymentsRepo } from "./scorePaymentsRepo";
import { SeatsLogic } from "./seatsLogic";
import { SeatsRepo } from "./seatsRepo";
import { WallTilesRepo } from "./wallTilesRepo";

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

export function createRoundsLogic(
  repos: SnapshotRepos,
  random: GameRandom = defaultGameRandom(),
): RoundsLogic {
  return new RoundsLogic(
    repos.gamesRepo,
    repos.roundsRepo,
    repos.handsRepo,
    repos.handTilesRepo,
    repos.wallTilesRepo,
    repos.flowerTilesRepo,
    repos.seatsRepo,
    random,
  );
}

export function createSeatsLogic(
  repos = createSnapshotRepos(),
  random: GameRandom = defaultGameRandom(),
): SeatsLogic {
  return new SeatsLogic(
    repos.seatsRepo,
    repos.gamesRepo,
    createRoundsLogic(repos, random),
    repos,
    runTransaction,
    random,
  );
}

export function createGamesLogic(
  repos = createSnapshotRepos(),
  random: GameRandom = defaultGameRandom(),
  redis: GameRedis = {
    publishAborted: publishGameAborted,
    deleteCache: deleteGameCache,
  },
): GamesLogic {
  const roundsLogic = createRoundsLogic(repos, random);
  const seatsLogic = new SeatsLogic(
    repos.seatsRepo,
    repos.gamesRepo,
    roundsLogic,
    repos,
    runTransaction,
    random,
  );
  return new GamesLogic(repos, roundsLogic, seatsLogic, runTransaction, random, redis);
}
