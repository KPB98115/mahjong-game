import { describe, expect, it } from "vitest";
import { AuthLogic } from "../../logic/client/auth/authLogic";
import { ApiClient } from "../../logic/client/http/apiClient";
import { ApiError, HttpStatus } from "../../types/server/api";
import { UserAttributeName } from "../../types/server/profile";
import { GameStatus } from "../../types/server/gameStatus";
import { PrevailingWind } from "../../types/server/prevailingWind";
import { Ruleset } from "../../types/server/ruleset";
import { createFakeFetch, failedBody, successBody } from "./fakeApi";

const profileData = {
  userId: "user-1",
  attributes: {},
  figures: {},
  currentGame: null,
};

describe("AuthLogic", () => {
  it("ensureSession posts /api/session then loadProfile gets /api/me", async () => {
    const fetchFn = createFakeFetch([
      {
        method: "POST",
        path: "/api/session",
        status: HttpStatus.Ok,
        body: successBody({ userId: "user-1" }),
      },
      {
        method: "GET",
        path: "/api/me",
        status: HttpStatus.Ok,
        body: successBody({
          ...profileData,
          attributes: { [UserAttributeName.DisplayName]: "Kingston" },
          currentGame: {
            gameId: "game-1",
            referenceCode: "04217",
            status: GameStatus.Waiting,
            prevailingWind: PrevailingWind.East,
            ruleset: Ruleset.HongKong,
            seatIndex: 0,
          },
        }),
      },
    ]);
    const auth = new AuthLogic(new ApiClient(fetchFn));
    const session = await auth.ensureSession();
    expect(session).toEqual({ ok: true, data: { userId: "user-1" } });
    const profile = await auth.loadProfile();
    expect(profile.ok).toBe(true);
    if (!profile.ok) {
      return;
    }
    expect(profile.data).toEqual({
      userId: "user-1",
      displayName: "Kingston",
      currentGame: {
        gameId: "game-1",
        referenceCode: "04217",
        status: GameStatus.Waiting,
        prevailingWind: PrevailingWind.East,
        ruleset: Ruleset.HongKong,
        seatIndex: 0,
      },
      figures: {},
    });
    expect(fetchFn.calls.map((call) => `${call.method} ${call.path}`)).toEqual([
      "POST /api/session",
      "GET /api/me",
    ]);
  });

  it("saveDisplayName trims and blocks empty or over-32 names without calling the api", async () => {
    const fetchFn = createFakeFetch([]);
    const auth = new AuthLogic(new ApiClient(fetchFn));
    const empty = await auth.saveDisplayName("   ");
    const tooLong = await auth.saveDisplayName("a".repeat(33));
    expect(empty).toEqual({
      ok: false,
      error: ApiError.InvalidBody,
      status: HttpStatus.UnprocessableEntity,
    });
    expect(tooLong).toEqual({
      ok: false,
      error: ApiError.InvalidBody,
      status: HttpStatus.UnprocessableEntity,
    });
    expect(fetchFn.calls).toEqual([]);
  });

  it("saveDisplayName patches trimmed displayName and maps the profile model", async () => {
    const fetchFn = createFakeFetch([
      {
        method: "PATCH",
        path: "/api/me",
        status: HttpStatus.Ok,
        body: successBody({
          ...profileData,
          attributes: { [UserAttributeName.DisplayName]: "Ada" },
        }),
      },
    ]);
    const auth = new AuthLogic(new ApiClient(fetchFn));
    const result = await auth.saveDisplayName("  Ada  ");
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.data.displayName).toBe("Ada");
    expect(fetchFn.calls[0]?.body).toEqual({
      attributes: { [UserAttributeName.DisplayName]: "Ada" },
    });
  });

  it("mintSocketTicket posts /api/socket-ticket", async () => {
    const fetchFn = createFakeFetch([
      {
        method: "POST",
        path: "/api/socket-ticket",
        status: HttpStatus.Ok,
        body: successBody({ ticket: "ticket-1" }),
      },
    ]);
    const auth = new AuthLogic(new ApiClient(fetchFn));
    const result = await auth.mintSocketTicket();
    expect(result).toEqual({ ok: true, data: { ticket: "ticket-1" } });
  });

  it("loadProfile maps unauthorized from a failed envelope", async () => {
    const fetchFn = createFakeFetch([
      {
        method: "GET",
        path: "/api/me",
        status: HttpStatus.Unauthorized,
        body: failedBody(ApiError.Unauthorized),
      },
    ]);
    const auth = new AuthLogic(new ApiClient(fetchFn));
    const result = await auth.loadProfile();
    expect(result).toEqual({
      ok: false,
      error: ApiError.Unauthorized,
      status: HttpStatus.Unauthorized,
    });
  });
});
