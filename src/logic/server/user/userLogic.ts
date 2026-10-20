import {
  patchMeBodySchema,
  type PlayerAttributeRow,
  type PlayerFigureRow,
} from "../../../model/server/playerProfile";
import { ApiError, HttpStatus } from "../../../types/server/api";
import {
  UserAttributeName,
  UserFigureJsonKey,
  UserFigureName,
  type ProfileResponse,
} from "../../../types/server/profile";
import { type UserRepo } from "./userRepo";

export type UpsertAttributesOk = {
  profile: ProfileResponse;
};

export type UpsertAttributesErr = {
  error: ApiError;
  status: HttpStatus;
};

export type UpsertAttributesResult = UpsertAttributesOk | UpsertAttributesErr;

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
  constructor(private userRepo: UserRepo) {}

  async loadProfile(userId: string): Promise<ProfileResponse> {
    const attributes = await this.userRepo.listAttributes(userId);
    const figures = await this.userRepo.listFigures(userId);
    return {
      userId,
      attributes: attributesToMap(attributes),
      figures: figuresToJson(figures),
      currentGame: null,
    };
  }

  async upsertAttributes(userId: string, body: unknown): Promise<UpsertAttributesResult> {
    const parsed = patchMeBodySchema.safeParse(body);
    if (!parsed.success) {
      return { error: ApiError.InvalidBody, status: HttpStatus.UnprocessableEntity };
    }
    const normalized = this.normalizeAttributes(parsed.data.attributes);
    if (normalized === undefined) {
      return { error: ApiError.InvalidBody, status: HttpStatus.UnprocessableEntity };
    }
    for (const name of Object.keys(normalized)) {
      const value = normalized[name];
      if (value === undefined) {
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

export function isUpsertAttributesErr(
  result: UpsertAttributesResult,
): result is UpsertAttributesErr {
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
