import { type ScoringChart } from "../../../../model/server/scoringChart";
import { BotDifficulty } from "../../../../types/server/botDifficulty";
import { MeldType } from "../../../../types/server/meldType";
import { type PrevailingWind } from "../../../../types/server/prevailingWind";
import { WinKind } from "../../../../types/server/winKind";
import { evaluateWin, type ExposedMeld, type WinContext } from "../handScoring";
import { compareTileCodes, isHonorCode, parseTileCode, suitedCode } from "../tileCode";
import { type HandTileRow } from "../handTilesRepo";

export type BotContext = {
  hand: HandTileRow[];
  exposedMelds: ExposedMeld[];
  discardCode: string | null;
  discardSeatIndex: number | null;
  seatIndex: number;
  dealerSeatIndex: number;
  winMeldCount: number;
  chowOnlyFromPrevious: boolean;
  bonusTilesEnabled: boolean;
  prevailingWind: PrevailingWind;
  flowerCodes: string[];
  chart: ScoringChart;
  wallEmpty: boolean;
  isRobKong: boolean;
};

export type BotTurnAction = { action: "win" } | { action: "discard"; tileId: string };

export type BotClaimAction =
  | { action: "win" }
  | { action: "claim"; kind: MeldType; tileIds: string[] }
  | { action: "pass" };

export function chooseTurnAction(context: BotContext, difficulty: BotDifficulty): BotTurnAction {
  const drawnTile = context.hand.find((t) => t.isDrawn);
  const fallbackId = drawnTile?.id ?? context.hand.at(-1)?.id;

  if (fallbackId == null) {
    throw new Error("bot has no tile to discard");
  }

  if (difficulty === BotDifficulty.Low) {
    return { action: "discard", tileId: fallbackId };
  }

  if (wouldWin(context, WinKind.SelfDraw, null)) {
    return { action: "win" };
  }

  const tileId =
    difficulty === BotDifficulty.Smart
      ? chooseDiscardSmart(context.hand)
      : chooseDiscardMedium(context.hand);

  return { action: "discard", tileId };
}

export function chooseClaimAction(context: BotContext, difficulty: BotDifficulty): BotClaimAction {
  const { discardCode, discardSeatIndex } = context;
  if (discardCode == null || discardSeatIndex == null) {
    return { action: "pass" };
  }

  if (difficulty === BotDifficulty.Low) {
    return { action: "pass" };
  }

  // During a rob-kong window only win or pass are valid.
  if (context.isRobKong) {
    if (difficulty === BotDifficulty.Smart && wouldWin(context, WinKind.Discard, discardCode)) {
      return { action: "win" };
    }
    return { action: "pass" };
  }

  if (difficulty === BotDifficulty.Smart && wouldWin(context, WinKind.Discard, discardCode)) {
    return { action: "win" };
  }

  const kongIds = kongTileIds(context.hand, discardCode);
  if (kongIds != null) {
    return { action: "claim", kind: MeldType.Kong, tileIds: kongIds };
  }

  const pongIds = pongTileIds(context.hand, discardCode);
  if (pongIds != null) {
    return { action: "claim", kind: MeldType.Pong, tileIds: pongIds };
  }

  if (difficulty === BotDifficulty.Smart) {
    const chowIds = chowTileIds(
      context.hand,
      discardCode,
      context.seatIndex,
      discardSeatIndex,
      context.chowOnlyFromPrevious,
    );
    if (chowIds != null) {
      return { action: "claim", kind: MeldType.Chow, tileIds: chowIds };
    }
  }

  return { action: "pass" };
}

// --- Private helpers ---

function wouldWin(context: BotContext, winKind: WinKind, extraCode: string | null): boolean {
  const concealedTileCodes = context.hand.map((t) => t.tileCode);
  if (extraCode != null) {
    concealedTileCodes.push(extraCode);
  }
  const winCtx: WinContext = {
    concealedTileCodes,
    exposedMelds: context.exposedMelds,
    winKind,
    setsNeeded: context.winMeldCount,
    seatWindIndex: (context.seatIndex - context.dealerSeatIndex + 4) % 4,
    prevailingWind: context.prevailingWind,
    isDealer: context.seatIndex === context.dealerSeatIndex,
    flowerTileCodes: context.flowerCodes,
    bonusTilesEnabled: context.bonusTilesEnabled,
    wallEmpty: context.wallEmpty,
    robbingKong: context.isRobKong,
  };
  return evaluateWin(context.chart, winCtx) != null;
}

function chooseDiscardLow(hand: HandTileRow[]): string {
  const drawn = hand.find((t) => t.isDrawn);
  const tile = drawn ?? hand.at(-1);
  if (tile == null) {
    throw new Error("bot has no tile to discard");
  }
  return tile.id;
}

function chooseDiscardMedium(hand: HandTileRow[]): string {
  const counts = new Map<string, number>();
  for (const tile of hand) {
    counts.set(tile.tileCode, (counts.get(tile.tileCode) ?? 0) + 1);
  }

  const drawn = hand.find((t) => t.isDrawn);

  // Discard drawn tile if it is isolated (only one copy in hand).
  if (drawn != null && (counts.get(drawn.tileCode) ?? 0) === 1) {
    return drawn.id;
  }

  // Otherwise prefer discarding an isolated honor tile.
  const isolatedHonor = hand.find((t) => (counts.get(t.tileCode) ?? 0) === 1 && isHonorCode(t.tileCode));
  if (isolatedHonor != null) {
    return isolatedHonor.id;
  }

  // Then any isolated suited tile.
  const isolatedSuited = hand.find((t) => (counts.get(t.tileCode) ?? 0) === 1);
  if (isolatedSuited != null) {
    return isolatedSuited.id;
  }

  // Fallback: discard the drawn tile.
  return chooseDiscardLow(hand);
}

// Scores each candidate discard by the strength of the remaining hand and picks the best one.
function chooseDiscardSmart(hand: HandTileRow[]): string {
  let bestId: string | null = null;
  let bestScore = -1;

  for (const candidate of hand) {
    const remaining = hand.filter((t) => t.id !== candidate.id).map((t) => t.tileCode);
    const score = handStrengthScore(remaining);
    if (score > bestScore) {
      bestScore = score;
      bestId = candidate.id;
    }
  }

  if (bestId == null) {
    return chooseDiscardLow(hand);
  }
  return bestId;
}

// Greedy hand-strength scorer: extracts pongs then chows and counts what remains.
// Returns sets * 3 + pairs as a proxy for hand closeness to a win.
function handStrengthScore(tileCodes: string[]): number {
  const counts = new Map<string, number>();
  for (const code of tileCodes) {
    counts.set(code, (counts.get(code) ?? 0) + 1);
  }

  let sets = 0;
  const sortedCodes = [...counts.keys()].sort(compareTileCodes);

  // Extract pongs.
  for (const code of sortedCodes) {
    const count = counts.get(code) ?? 0;
    if (count >= 3) {
      const pongs = Math.floor(count / 3);
      sets += pongs;
      counts.set(code, count % 3);
    }
  }

  // Extract chows.
  for (const code of sortedCodes) {
    const parsed = parseTileCode(code);
    if (parsed == null || parsed.suit == null || parsed.rank == null || parsed.rank > 7) {
      continue;
    }
    const { suit, rank } = parsed;
    const code2 = suitedCode(suit, rank + 1);
    const code3 = suitedCode(suit, rank + 2);
    const c1 = counts.get(code) ?? 0;
    const c2 = counts.get(code2) ?? 0;
    const c3 = counts.get(code3) ?? 0;
    const chows = Math.min(c1, c2, c3);
    if (chows > 0) {
      sets += chows;
      counts.set(code, c1 - chows);
      counts.set(code2, c2 - chows);
      counts.set(code3, c3 - chows);
    }
  }

  let pairs = 0;
  for (const count of counts.values()) {
    pairs += Math.floor(count / 2);
  }

  return sets * 3 + pairs;
}

function pongTileIds(hand: HandTileRow[], code: string): [string, string] | null {
  const matches = hand.filter((t) => t.tileCode === code);
  const first = matches[0];
  const second = matches[1];
  if (first != null && second != null) {
    return [first.id, second.id];
  }
  return null;
}

function kongTileIds(hand: HandTileRow[], code: string): [string, string, string] | null {
  const matches = hand.filter((t) => t.tileCode === code);
  const first = matches[0];
  const second = matches[1];
  const third = matches[2];
  if (first != null && second != null && third != null) {
    return [first.id, second.id, third.id];
  }
  return null;
}

function chowTileIds(
  hand: HandTileRow[],
  discardCode: string,
  seatIndex: number,
  discardSeatIndex: number,
  chowOnlyFromPrevious: boolean,
): [string, string] | null {
  if (chowOnlyFromPrevious && (discardSeatIndex + 1) % 4 !== seatIndex) {
    return null;
  }

  for (const [codeA, codeB] of chowPartners(discardCode)) {
    const tileA = hand.find((t) => t.tileCode === codeA);
    if (tileA == null) continue;
    const tileB = hand.find((t) => t.tileCode === codeB && t.id !== tileA.id);
    if (tileB == null) continue;
    return [tileA.id, tileB.id];
  }

  return null;
}

// Returns pairs of tile codes that together with discardCode form a chow.
function chowPartners(discardCode: string): [string, string][] {
  const parsed = parseTileCode(discardCode);
  if (parsed == null || parsed.suit == null || parsed.rank == null) {
    return [];
  }
  const { suit, rank } = parsed;
  const partners: [string, string][] = [];
  const offsets: [number, number][] = [
    [-2, -1],
    [-1, 1],
    [1, 2],
  ];
  for (const [a, b] of offsets) {
    const rankA = rank + a;
    const rankB = rank + b;
    if (rankA >= 1 && rankA <= 9 && rankB >= 1 && rankB <= 9) {
      partners.push([suitedCode(suit, rankA), suitedCode(suit, rankB)]);
    }
  }
  return partners;
}
