import { describe, expect, it } from "vitest";
import { loadPublicState } from "../logic/server/game/loadGameSnapshot";
import { wallTileCount } from "../logic/server/game/wallTileCodes";
import { createPlayWorld, playNow, userAt } from "./playWorld";

describe("wall snapshot indexes", () => {
  it("keeps the Hong Kong head at the deal cursor until a draw or tail take", async () => {
    const opened = await createPlayWorld({ body: { ruleset: "hongKong", autoDraw: false } });
    const afterDeal = await loadPublicState(opened.repos, opened.gameId);
    expect(afterDeal?.round).toMatchObject({
      wallRemainingCount: 92,
      wallHeadSortIndex: 52,
      wallTailSortIndex: 143,
    });

    const flowered = await createPlayWorld({
      body: { ruleset: "hongKong", autoDraw: false },
      wall: { hands: [[], [], ["flower_plum"], []], tail: ["man_9"] },
    });
    const afterFlower = await loadPublicState(flowered.repos, flowered.gameId);
    expect(afterFlower?.round?.wallHeadSortIndex).toBe(52);
    expect(afterFlower?.round?.wallTailSortIndex).toBeLessThan(wallTileCount - 1);
  });

  it("advances the head on a normal draw and pulls the tail back on a replacement", async () => {
    const world = await createPlayWorld({
      body: { ruleset: "hongKong", autoDraw: false },
      wall: { draws: ["flower_plum"], tail: ["man_9"] },
    });
    const before = await loadPublicState(world.repos, world.gameId);
    expect(before?.round?.wallHeadSortIndex).toBe(52);
    expect(before?.round?.wallTailSortIndex).toBe(143);

    const drawn = await world.roundsLogic.draw({
      gameId: world.gameId,
      userId: userAt(world, 0),
      now: playNow,
    });
    expect(drawn.ok).toBe(true);
    const after = await loadPublicState(world.repos, world.gameId);
    expect(after?.round?.wallHeadSortIndex).toBe(53);
    expect(after?.round?.wallTailSortIndex).toBe(142);
  });

  it("publishes null head and tail when the wall is empty", async () => {
    const world = await createPlayWorld({ body: { ruleset: "hongKong", autoDraw: false } });
    const round = await world.round();
    const tiles = await world.tables.wallTilesRepo.findByRoundId(round.id);
    for (const tile of tiles) {
      await world.tables.wallTilesRepo.deleteById(tile.id);
    }
    const empty = await loadPublicState(world.repos, world.gameId);
    expect(empty?.round).toMatchObject({
      wallRemainingCount: 0,
      wallHeadSortIndex: null,
      wallTailSortIndex: null,
    });
    expect(JSON.stringify(empty?.round)).not.toMatch(/tileCode/);
  });
});
