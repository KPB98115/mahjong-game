import { describe, expect, it } from "vitest";
import { GamesLogic } from "../../logic/client/game/gamesLogic";
import { ApiClient } from "../../logic/client/http/apiClient";
import { ApiError, HttpStatus } from "../../types/server/api";
import { Ruleset } from "../../types/server/ruleset";
import { createFakeFetch, successBody } from "./fakeApi";
import { waitingSnapshot } from "./snapshotFixture";

describe("GamesLogic", () => {
  it("create parses the body then posts /api/games", async () => {
    const snapshot = waitingSnapshot();
    const fetchFn = createFakeFetch([
      {
        method: "POST",
        path: "/api/games",
        status: HttpStatus.Ok,
        body: successBody(snapshot),
      },
    ]);
    const games = new GamesLogic(new ApiClient(fetchFn));
    const result = await games.create({ ruleset: Ruleset.HongKong });
    expect(result).toEqual({ ok: true, data: snapshot });
    expect(fetchFn.calls[0]?.body).toEqual({ ruleset: Ruleset.HongKong });
  });

  it("create returns rulesetUnknown without calling the api", async () => {
    const fetchFn = createFakeFetch([]);
    const games = new GamesLogic(new ApiClient(fetchFn));
    const result = await games.create({ ruleset: "japanese" });
    expect(result).toEqual({
      ok: false,
      error: ApiError.RulesetUnknown,
      status: HttpStatus.UnprocessableEntity,
    });
    expect(fetchFn.calls).toEqual([]);
  });

  it("join posts the referenceCode string", async () => {
    const snapshot = waitingSnapshot();
    const fetchFn = createFakeFetch([
      {
        method: "POST",
        path: "/api/games/join",
        status: HttpStatus.Ok,
        body: successBody(snapshot),
      },
    ]);
    const games = new GamesLogic(new ApiClient(fetchFn));
    const result = await games.join("04217");
    expect(result.ok).toBe(true);
    expect(fetchFn.calls[0]?.body).toEqual({ referenceCode: "04217" });
  });
});
