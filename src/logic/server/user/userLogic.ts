import { actionErrorSchema, type GameActionErr } from "../../../model/server/actionResult";
import { profileResponseSchema, type ProfileResponse } from "../../../model/server/profileResponse";
import {
  patchMeBodySchema,
  type PlayerAttributeRow,
  type PlayerFigureRow,
} from "../../../model/server/playerProfile";
import { ApiError, HttpStatus } from "../../../types/server/api";
import { type JsonValue } from "../../../types/server/jsonValue";
import {
  UserAttributeName,
  UserFigureJsonKey,
  UserFigureName,
} from "../../../types/server/profile";
import { type CurrentGameSource } from "../game/currentGameSource";
import { type UserRepo } from "./userRepo";

export type UpsertAttributesOk = {
  profile: ProfileResponse;
};

export type UpsertAttributesResult = UpsertAttributesOk | GameActionErr;

const displayNameMinLength = 1;
const displayNameMaxLength = 32;
const attributeNameMinLength = 1;
const attributeNameMaxLength = 64;
const attributeValueMinLength = 1;
const attributeValueMaxLength = 256;

const figureJsonKeyByName: Record<UserFigureName, UserFigureJsonKey> = {
  [UserFigureName.GamesPlayed]: UserFigureJsonKey.GamesPlayed,
  [UserFigureName.Wins]: UserFigureJsonKey.Wins,
  [UserFigureName.RunningScore]: UserFigureJsonKey.RunningScore,
};

export class UserLogic {
  constructor(
    private userRepo: UserRepo,
    private currentGameSource: CurrentGameSource,
  ) {}

  async loadProfile(userId: string): Promise<ProfileResponse> {
    const attributes = await this.userRepo.listAttributes(userId);
    const figures = await this.userRepo.listFigures(userId);
    const currentGame = await this.currentGameSource.currentGameForUser(userId);
    return profileResponseSchema.parse({
      userId,
      attributes: attributesToMap(attributes),
      figures: figuresToJson(figures),
      currentGame,
    });
  }

  async upsertAttributes(userId: string, body: JsonValue): Promise<UpsertAttributesResult> {
    const parsed = patchMeBodySchema.safeParse(body);
    if (!parsed.success) {
      return actionErrorSchema.parse({
        error: ApiError.InvalidBody,
        status: HttpStatus.UnprocessableEntity,
      });
    }
    const normalized = this.normalizeAttributes(parsed.data.attributes);
    if (normalized == null) {
      return actionErrorSchema.parse({
        error: ApiError.InvalidBody,
        status: HttpStatus.UnprocessableEntity,
      });
    }
    for (const name of Object.keys(normalized)) {
      const value = normalized[name];
      if (value == null) {
        continue;
      }
      await this.userRepo.upsertAttribute(userId, name, value);
    }
    return { profile: await this.loadProfile(userId) };
  }

  private normalizeAttributes(
    attributes: Record<string, string>,
  ): Record<string, string> | undefined {
    const normalized: Record<string, string> = {};
    for (const name of Object.keys(attributes)) {
      const value = attributes[name];
      if (name === UserAttributeName.DisplayName) {
        const trimmed = value.trim();
        if (trimmed.length < displayNameMinLength || trimmed.length > displayNameMaxLength) {
          return undefined;
        }
        normalized[name] = trimmed;
        continue;
      }
      if (name.length < attributeNameMinLength || name.length > attributeNameMaxLength) {
        return undefined;
      }
      if (value.length < attributeValueMinLength || value.length > attributeValueMaxLength) {
        return undefined;
      }
      normalized[name] = value;
    }
    return normalized;
  }
}

export function isUpsertAttributesErr(result: UpsertAttributesResult): result is GameActionErr {
  return "error" in result;
}

function attributesToMap(rows: PlayerAttributeRow[]): Record<string, string> {
  const attributes: Record<string, string> = {};
  for (const row of rows) {
    attributes[row.name] = row.value;
  }
  return attributes;
}

function figuresToJson(rows: PlayerFigureRow[]): Partial<Record<UserFigureJsonKey, number>> {
  const figures: Partial<Record<UserFigureJsonKey, number>> = {};
  for (const row of rows) {
    if (!isUserFigureName(row.name)) {
      continue;
    }
    const numericValue = Number(row.value);
    if (Number.isNaN(numericValue)) {
      continue;
    }
    figures[figureJsonKeyByName[row.name]] = numericValue;
  }
  return figures;
}

function isUserFigureName(name: string): name is UserFigureName {
  return (
    name === UserFigureName.GamesPlayed ||
    name === UserFigureName.Wins ||
    name === UserFigureName.RunningScore
  );
}
