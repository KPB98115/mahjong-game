import { type CurrentGame, type ProfileResponse } from "../server/profileResponse";
import { UserAttributeName } from "../../types/server/profile";

export type PlayerProfileModel = {
  userId: string;
  displayName: string | null;
  currentGame: CurrentGame | null;
  figures: ProfileResponse["figures"];
};

export function playerProfileModelFrom(response: ProfileResponse): PlayerProfileModel {
  const displayName = response.attributes[UserAttributeName.DisplayName];
  return {
    userId: response.userId,
    displayName: displayName == null || displayName === "" ? null : displayName,
    currentGame: response.currentGame,
    figures: response.figures,
  };
}
