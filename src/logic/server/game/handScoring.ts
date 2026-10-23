import { type ScoringChart } from "../../../model/server/scoringChart";
import { MeldType } from "../../../types/server/meldType";
import { PayoutKind } from "../../../types/server/payoutKind";
import { type PrevailingWind } from "../../../types/server/prevailingWind";
import { ScoringPattern } from "../../../types/server/scoringPattern";
import { TileKind } from "../../../types/server/tile";
import { WinKind } from "../../../types/server/winKind";
import { findStandardShapes, isSevenPairs, isThirteenOrphans } from "./handShape";
import {
  bonusSeatPosition,
  flowerOrder,
  isDragonCode,
  isWindCode,
  parseTileCode,
  seasonOrder,
  windOrder,
} from "./tileCode";

export type ExposedMeld = {
  meldType: MeldType;
  isConcealed: boolean;
  tileCodes: string[];
};

export type WinContext = {
  concealedTileCodes: string[];
  exposedMelds: ExposedMeld[];
  winKind: WinKind;
  setsNeeded: number;
  seatWindIndex: number;
  prevailingWind: PrevailingWind;
  isDealer: boolean;
  flowerTileCodes: string[];
  bonusTilesEnabled: boolean;
  wallEmpty: boolean;
  robbingKong: boolean;
};

export type PatternScore = {
  pattern: ScoringPattern;
  units: number;
};

export type WinScore = {
  units: number;
  patterns: PatternScore[];
};

type ScoredSet = {
  meldType: MeldType;
  tileCodes: string[];
};

type Arrangement =
  | { pattern: null; pair: string; sets: ScoredSet[] }
  | { pattern: ScoringPattern.SevenPairs | ScoringPattern.ThirteenOrphans };

type PatternCounts = Map<ScoringPattern, number>;

const patternOrder: ScoringPattern[] = Object.values(ScoringPattern);

export function evaluateWin(chart: ScoringChart, context: WinContext): WinScore | undefined {
  let best: WinScore | undefined;
  for (const arrangement of arrangementsFor(chart, context)) {
    const score = scoreArrangement(chart, context, arrangement);
    if (best == null || score.units > best.units) {
      best = score;
    }
  }
  return best;
}

export function payoutAmount(chart: ScoringChart, units: number): number {
  if (chart.payout.kind === PayoutKind.Doubling) {
    return chart.payout.basePoints * 2 ** Math.min(units, chart.payout.capUnits);
  }
  return chart.payout.base + units * chart.payout.perUnit;
}

function arrangementsFor(chart: ScoringChart, context: WinContext): Arrangement[] {
  const arrangements: Arrangement[] = [];
  const setsLeft = context.setsNeeded - context.exposedMelds.length;
  if (setsLeft >= 0) {
    const exposed = context.exposedMelds.map((meld) => ({
      meldType: meld.meldType,
      tileCodes: meld.tileCodes,
    }));
    for (const shape of findStandardShapes(context.concealedTileCodes, setsLeft)) {
      arrangements.push({ pattern: null, pair: shape.pair, sets: [...shape.sets, ...exposed] });
    }
  }
  if (context.exposedMelds.length > 0) {
    return arrangements;
  }
  if (
    chart.patterns[ScoringPattern.SevenPairs] != null &&
    isSevenPairs(context.concealedTileCodes)
  ) {
    arrangements.push({ pattern: ScoringPattern.SevenPairs });
  }
  if (
    chart.patterns[ScoringPattern.ThirteenOrphans] != null &&
    isThirteenOrphans(context.concealedTileCodes)
  ) {
    arrangements.push({ pattern: ScoringPattern.ThirteenOrphans });
  }
  return arrangements;
}

function scoreArrangement(
  chart: ScoringChart,
  context: WinContext,
  arrangement: Arrangement,
): WinScore {
  const counts: PatternCounts = new Map();
  addSituationPatterns(counts, context);
  addSuitPatterns(counts, allTileCodes(context));
  if (arrangement.pattern == null) {
    addSetPatterns(counts, context, arrangement.pair, arrangement.sets);
  } else {
    counts.set(arrangement.pattern, 1);
  }
  if (counts.has(ScoringPattern.AllHonors)) {
    counts.delete(ScoringPattern.AllPongs);
  }
  const patterns: PatternScore[] = [];
  let total = 0;
  for (const pattern of patternOrder) {
    const count = counts.get(pattern) ?? 0;
    const perPattern = chart.patterns[pattern];
    if (count === 0 || perPattern == null) {
      continue;
    }
    patterns.push({ pattern, units: perPattern * count });
    total += perPattern * count;
  }
  const units = chart.limitUnits == null ? total : Math.min(total, chart.limitUnits);
  return { units, patterns };
}

function addSituationPatterns(counts: PatternCounts, context: WinContext): void {
  const selfDraw = context.winKind === WinKind.SelfDraw;
  setWhen(counts, ScoringPattern.SelfDraw, selfDraw);
  setWhen(
    counts,
    ScoringPattern.ConcealedHand,
    context.exposedMelds.every((meld) => meld.isConcealed),
  );
  setWhen(counts, ScoringPattern.Dealer, context.isDealer);
  setWhen(
    counts,
    ScoringPattern.NoFlowers,
    context.bonusTilesEnabled && context.flowerTileCodes.length === 0,
  );
  const ownFlowers = context.flowerTileCodes.filter(
    (code) => bonusSeatPosition(code) === context.seatWindIndex,
  ).length;
  setCount(counts, ScoringPattern.OwnFlower, ownFlowers);
  const fullSets = [flowerOrder, seasonOrder].filter((set: string[]) =>
    set.every((code) => context.flowerTileCodes.includes(code)),
  ).length;
  setCount(counts, ScoringPattern.FlowerSet, fullSets);
  setWhen(counts, ScoringPattern.LastTileSelfDraw, selfDraw && context.wallEmpty);
  setWhen(counts, ScoringPattern.RobbingKong, !selfDraw && context.robbingKong);
}

function addSuitPatterns(counts: PatternCounts, tileCodes: string[]): void {
  const suits = new Set<string>();
  let hasHonor = false;
  for (const code of tileCodes) {
    const parsed = parseTileCode(code);
    if (parsed?.kind === TileKind.Suited && parsed.suit != null) {
      suits.add(parsed.suit);
    } else if (parsed?.kind === TileKind.Wind || parsed?.kind === TileKind.Dragon) {
      hasHonor = true;
    }
  }
  setWhen(counts, ScoringPattern.AllHonors, suits.size === 0 && hasHonor);
  setWhen(counts, ScoringPattern.FullFlush, suits.size === 1 && !hasHonor);
  setWhen(counts, ScoringPattern.HalfFlush, suits.size === 1 && hasHonor);
}

function addSetPatterns(
  counts: PatternCounts,
  context: WinContext,
  pair: string,
  sets: ScoredSet[],
): void {
  const tripletCodes = sets
    .filter((set) => set.meldType !== MeldType.Chow)
    .map((set) => set.tileCodes[0] ?? "");
  setWhen(
    counts,
    ScoringPattern.AllChows,
    sets.length > 0 && sets.every((set) => set.meldType === MeldType.Chow),
  );
  setWhen(counts, ScoringPattern.AllPongs, sets.length > 0 && tripletCodes.length === sets.length);

  const dragonPongs = tripletCodes.filter(isDragonCode).length;
  if (dragonPongs === 3) {
    counts.set(ScoringPattern.BigThreeDragons, 1);
  } else if (dragonPongs === 2 && isDragonCode(pair)) {
    counts.set(ScoringPattern.SmallThreeDragons, 1);
  } else {
    setCount(counts, ScoringPattern.DragonPong, dragonPongs);
  }

  const windPongs = tripletCodes.filter(isWindCode).length;
  if (windPongs === 4) {
    counts.set(ScoringPattern.BigFourWinds, 1);
  } else if (windPongs === 3 && isWindCode(pair)) {
    counts.set(ScoringPattern.SmallFourWinds, 1);
  } else {
    const seatWind = windOrder[context.seatWindIndex];
    setWhen(
      counts,
      ScoringPattern.SeatWindPong,
      seatWind != null && tripletCodes.includes(seatWind),
    );
    setWhen(
      counts,
      ScoringPattern.PrevailingWindPong,
      tripletCodes.includes(context.prevailingWind),
    );
  }
}

function allTileCodes(context: WinContext): string[] {
  return [...context.concealedTileCodes, ...context.exposedMelds.flatMap((meld) => meld.tileCodes)];
}

function setWhen(counts: PatternCounts, pattern: ScoringPattern, condition: boolean): void {
  if (condition) {
    counts.set(pattern, 1);
  }
}

function setCount(counts: PatternCounts, pattern: ScoringPattern, count: number): void {
  if (count > 0) {
    counts.set(pattern, count);
  }
}
