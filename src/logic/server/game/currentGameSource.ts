import { type CurrentGame } from "../../../model/server/profileResponse";

export type CurrentGameSource = {
  currentGameForUser(userId: string): Promise<CurrentGame | null>;
};
