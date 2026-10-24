import { type GameSnapshot } from "../server/gameSnapshot";

export type SeatModel = GameSnapshot["seats"][number] & {
  connected: boolean;
};

export function seatModelsFrom(
  seats: GameSnapshot["seats"],
  connectedBySeat: ReadonlyMap<number, boolean>,
): SeatModel[] {
  return seats.map((seat) => ({
    ...seat,
    connected: seat.botDifficulty != null || connectedBySeat.get(seat.seatIndex) === true,
  }));
}
