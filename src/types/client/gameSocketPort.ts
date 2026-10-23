import {
  type ClaimAction,
  type DiscardAction,
  type GameAction,
} from "../../model/server/playResult";

export type GameSocketPort = {
  connect(ticket: string, gameId: string): Promise<void>;
  disconnect(): void;
  draw(payload: GameAction): void;
  discard(payload: DiscardAction): void;
  claim(payload: ClaimAction): void;
  passClaim(payload: GameAction): void;
  declareWin(payload: GameAction): void;
};
