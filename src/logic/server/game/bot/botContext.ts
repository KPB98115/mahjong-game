import { type ScoringChart } from "../../../../model/server/scoringChart";
import { type PrevailingWind } from "../../../../types/server/prevailingWind";
import { type ExposedMeld } from "../handScoring";
import { type HandsRepo } from "../handsRepo";
import { type HandTilesRepo } from "../handTilesRepo";
import { type FlowerTilesRepo } from "../flowerTilesRepo";
import { type MeldsRepo } from "../meldsRepo";
import { type MeldTilesRepo } from "../meldTilesRepo";
import { type WallTilesRepo } from "../wallTilesRepo";
import { scoringChartFor } from "../scoringChart";
import { type GameRow } from "../gamesRepo";
import { type RoundRow } from "../roundsRepo";
import { type BotContext } from "./botPlayer";

export type BotContextRepos = {
  handsRepo: HandsRepo;
  handTilesRepo: HandTilesRepo;
  meldsRepo: MeldsRepo;
  meldTilesRepo: MeldTilesRepo;
  flowerTilesRepo: FlowerTilesRepo;
  wallTilesRepo: WallTilesRepo;
};

export async function buildBotContext(
  repos: BotContextRepos,
  game: GameRow,
  round: RoundRow,
  seatIndex: number,
  discardCode: string | null,
  discardSeatIndex: number | null,
  isRobKong: boolean,
): Promise<BotContext> {
  const handRow = await repos.handsRepo.findByRoundIdAndSeatIndex(round.id, seatIndex);
  const hand = handRow == null ? [] : await repos.handTilesRepo.findByHandId(handRow.id);

  const meldRows = await repos.meldsRepo.findByRoundIdAndSeatIndex(round.id, seatIndex);
  const exposedMelds: ExposedMeld[] = await Promise.all(
    meldRows.map(async (meld) => {
      const tiles = await repos.meldTilesRepo.findByMeldId(meld.id);
      return {
        meldType: meld.meldType,
        isConcealed: meld.isConcealed,
        tileCodes: tiles.map((t) => t.tileCode),
      };
    }),
  );

  const flowers = await repos.flowerTilesRepo.findByRoundIdAndSeatIndex(round.id, seatIndex);
  const wall = await repos.wallTilesRepo.findByRoundId(round.id);

  const chart = scoringChartFor(game.ruleset, game.scoringVersion);
  if (chart == null) {
    throw new Error(`no scoring chart for ruleset=${game.ruleset} version=${game.scoringVersion}`);
  }

  return {
    hand,
    exposedMelds,
    discardCode,
    discardSeatIndex,
    seatIndex,
    dealerSeatIndex: round.dealerSeatIndex,
    winMeldCount: game.winMeldCount,
    chowOnlyFromPrevious: game.chowOnlyFromPrevious,
    bonusTilesEnabled: game.bonusTilesEnabled,
    prevailingWind: round.prevailingWind as PrevailingWind,
    flowerCodes: flowers.map((f) => f.tileCode),
    chart: chart as ScoringChart,
    wallEmpty: wall.length === 0,
    isRobKong,
  };
}
