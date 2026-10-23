import { gameChannel } from "@app/logic/server/redis/keys";

export function gameRoom(gameId: string): string {
  return gameChannel(gameId);
}

export function seatRoom(gameId: string, seatIndex: number): string {
  return `${gameRoom(gameId)}:seat:${seatIndex}`;
}

export function tableRooms(gameId: string): string[] {
  return [gameRoom(gameId), ...[0, 1, 2, 3].map((seatIndex) => seatRoom(gameId, seatIndex))];
}
