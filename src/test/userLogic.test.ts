import { describe, expect, it } from "vitest";
import { UserLogic, isUpsertAttributesErr } from "../logic/server/user/userLogic";
import { ApiError, HttpStatus } from "../types/server/api";
import { GameStatus } from "../types/server/gameStatus";
import { PrevailingWind } from "../types/server/prevailingWind";
import { type CurrentGame } from "../model/server/profileResponse";
import { UserAttributeName, UserFigureJsonKey, UserFigureName } from "../types/server/profile";
import { Ruleset } from "../types/server/ruleset";
import { createUserRepoFake, repeatCharacter } from "./fakeAuth";

const userId = "user-1";
const noCurrentGame = {
  async currentGameForUser(): Promise<CurrentGame | null> {
    return null;
  },
};

describe("UserLogic.loadProfile", () => {
  it("maps stored attributes by name and locked figures to camelCase json numbers", async () => {
    const fake = createUserRepoFake({
      attributes: [
        { id: "a1", userId, name: UserAttributeName.DisplayName, value: "Kingston" },
        { id: "a2", userId, name: "locale", value: "en" },
      ],
      figures: [
        { id: "f1", userId, name: UserFigureName.GamesPlayed, value: "4" },
        { id: "f2", userId, name: UserFigureName.Wins, value: "2" },
        { id: "f3", userId, name: UserFigureName.RunningScore, value: "-12.5" },
        { id: "f4", userId, name: "other_stat", value: "9" },
      ],
    });
    const profile = await new UserLogic(fake.repo, noCurrentGame).loadProfile(userId);
    expect(profile.userId).toBe(userId);
    expect(profile.attributes).toEqual({ displayName: "Kingston", locale: "en" });
    expect(profile.figures).toEqual({
      [UserFigureJsonKey.GamesPlayed]: 4,
      [UserFigureJsonKey.Wins]: 2,
      [UserFigureJsonKey.RunningScore]: -12.5,
    });
    expect(profile.currentGame).toBeNull();
  });

  it("omits missing figure keys and non-numeric figure values", async () => {
    const fake = createUserRepoFake({
      figures: [{ id: "f1", userId, name: UserFigureName.Wins, value: "not-a-number" }],
    });
    const profile = await new UserLogic(fake.repo, noCurrentGame).loadProfile(userId);
    expect(profile.figures).toEqual({});
  });

  it("returns the seated game from the seats source", async () => {
    const currentGame: CurrentGame = {
      gameId: "game-1",
      referenceCode: "04217",
      status: GameStatus.Waiting,
      prevailingWind: PrevailingWind.East,
      ruleset: Ruleset.HongKong,
      seatIndex: 0,
    };
    const fake = createUserRepoFake();
    const profile = await new UserLogic(fake.repo, {
      async currentGameForUser() {
        return currentGame;
      },
    }).loadProfile(userId);
    expect(profile.currentGame).toEqual(currentGame);
  });
});

describe("UserLogic.upsertAttributes", () => {
  it("trims displayName and stores the trimmed 1-32 character value", async () => {
    const fake = createUserRepoFake();
    const result = await new UserLogic(fake.repo, noCurrentGame).upsertAttributes(userId, {
      attributes: { displayName: "  Kingston  " },
    });
    expect(isUpsertAttributesErr(result)).toBe(false);
    if (isUpsertAttributesErr(result)) {
      return;
    }
    expect(fake.upserts).toEqual([{ userId, name: "displayName", value: "Kingston" }]);
    expect(result.profile.attributes.displayName).toBe("Kingston");
  });

  it("accepts displayName of length 1 and 32 after trim", async () => {
    const fake = createUserRepoFake();
    const logic = new UserLogic(fake.repo, noCurrentGame);
    const one = await logic.upsertAttributes(userId, { attributes: { displayName: "A" } });
    const thirtyTwo = await logic.upsertAttributes(userId, {
      attributes: { displayName: repeatCharacter("n", 32) },
    });
    expect(isUpsertAttributesErr(one)).toBe(false);
    expect(isUpsertAttributesErr(thirtyTwo)).toBe(false);
  });

  it("returns invalidBody 422 and writes nothing when displayName is empty after trim", async () => {
    const fake = createUserRepoFake();
    const result = await new UserLogic(fake.repo, noCurrentGame).upsertAttributes(userId, {
      attributes: { displayName: "   " },
    });
    expect(isUpsertAttributesErr(result)).toBe(true);
    if (!isUpsertAttributesErr(result)) {
      return;
    }
    expect(result.error).toBe(ApiError.InvalidBody);
    expect(result.status).toBe(HttpStatus.UnprocessableEntity);
    expect(fake.upserts).toEqual([]);
  });

  it("returns invalidBody 422 when displayName is longer than 32 after trim", async () => {
    const fake = createUserRepoFake();
    const result = await new UserLogic(fake.repo, noCurrentGame).upsertAttributes(userId, {
      attributes: { displayName: repeatCharacter("n", 33) },
    });
    expect(isUpsertAttributesErr(result)).toBe(true);
    expect(fake.upserts).toEqual([]);
  });

  it("stores other attribute names as sent without trimming", async () => {
    const fake = createUserRepoFake();
    const result = await new UserLogic(fake.repo, noCurrentGame).upsertAttributes(userId, {
      attributes: { locale: "  en  " },
    });
    expect(isUpsertAttributesErr(result)).toBe(false);
    expect(fake.upserts).toEqual([{ userId, name: "locale", value: "  en  " }]);
  });

  it("rejects other names longer than 64 or values longer than 256 without partial writes", async () => {
    const fake = createUserRepoFake();
    const logic = new UserLogic(fake.repo, noCurrentGame);
    const longName = await logic.upsertAttributes(userId, {
      attributes: {
        displayName: "ok",
        [repeatCharacter("k", 65)]: "value",
      },
    });
    const longValue = await logic.upsertAttributes(userId, {
      attributes: { note: repeatCharacter("v", 257) },
    });
    expect(isUpsertAttributesErr(longName)).toBe(true);
    expect(isUpsertAttributesErr(longValue)).toBe(true);
    expect(fake.upserts).toEqual([]);
  });

  it("treats an empty attributes object as a no-op success", async () => {
    const fake = createUserRepoFake();
    const result = await new UserLogic(fake.repo, noCurrentGame).upsertAttributes(userId, {
      attributes: {},
    });
    expect(isUpsertAttributesErr(result)).toBe(false);
    expect(fake.upserts).toEqual([]);
  });

  it("returns invalidBody 422 when the body is not an attributes string map", async () => {
    const fake = createUserRepoFake();
    const logic = new UserLogic(fake.repo, noCurrentGame);
    const missing = await logic.upsertAttributes(userId, { displayName: "Kingston" });
    const wrongType = await logic.upsertAttributes(userId, { attributes: { displayName: 1 } });
    expect(isUpsertAttributesErr(missing)).toBe(true);
    expect(isUpsertAttributesErr(wrongType)).toBe(true);
    expect(fake.upserts).toEqual([]);
  });
});
