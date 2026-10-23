import { runTransaction, voidDatabase } from "../db/voidDatabase";
import { createGameRedis } from "../redis/gameChannel";
import { createRedisRoundCache } from "../redis/roundCache";
import { workersRedis } from "../redis/workersRedis";
import { createRedisClaimWindowStore } from "./claimWindowStore";
import { createGameLogics, createSnapshotRepos, type GameLogicOptions } from "./gameLogics";
import { defaultGameRandom, type GameRandom } from "./gameRandom";
import { type GamesLogic, type GameRedis } from "./gamesLogic";
import { type SnapshotRepos } from "./loadGameSnapshot";
import { type RoundsLogic } from "./roundsLogic";
import { type SeatsLogic } from "./seatsLogic";

export function createSeatsLogic(
  repos = createSnapshotRepos(voidDatabase),
  random: GameRandom = defaultGameRandom(),
): SeatsLogic {
  return createGameLogics(defaultOptions(repos, random)).seatsLogic;
}

export function createGamesLogic(
  repos = createSnapshotRepos(voidDatabase),
  random: GameRandom = defaultGameRandom(),
  redis: GameRedis = createGameRedis(workersRedis),
): GamesLogic {
  return createGameLogics({ ...defaultOptions(repos, random), redis }).gamesLogic;
}

export function createRoundsLogic(
  repos = createSnapshotRepos(voidDatabase),
  random: GameRandom = defaultGameRandom(),
): RoundsLogic {
  return createGameLogics(defaultOptions(repos, random)).roundsLogic;
}

function defaultOptions(repos: SnapshotRepos, random: GameRandom): GameLogicOptions {
  return {
    repos,
    runTransaction,
    random,
    redis: createGameRedis(workersRedis),
    claimWindowStore: createRedisClaimWindowStore(workersRedis),
    roundCache: createRedisRoundCache(workersRedis),
  };
}
