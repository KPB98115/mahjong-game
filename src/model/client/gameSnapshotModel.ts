import { type GameSnapshot } from "../server/gameSnapshot";
import { seatModelsFrom, type SeatModel } from "./seatModel";

export type GameSnapshotModel = {
  game: GameSnapshot["game"];
  seats: SeatModel[];
  round: GameSnapshot["round"];
  self: GameSnapshot["self"];
  publicTiles: GameSnapshot["publicTiles"];
  scores: GameSnapshot["scores"];
};

export function gameSnapshotModelFrom(
  snapshot: GameSnapshot,
  connectedBySeat: ReadonlyMap<number, boolean> = new Map(),
): GameSnapshotModel {
  return {
    game: snapshot.game,
    seats: seatModelsFrom(snapshot.seats, connectedBySeat),
    round: snapshot.round,
    self: snapshot.self,
    publicTiles: snapshot.publicTiles,
    scores: snapshot.scores,
  };
}
