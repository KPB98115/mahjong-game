import { MeldType } from "../../../types/server/meldType";
import { TileKind } from "../../../types/server/tile";
import { compareTileCodes, isTerminalOrHonorCode, parseTileCode, suitedCode } from "./tileCode";

export type ConcealedSet = {
  meldType: MeldType;
  tileCodes: string[];
};

export type HandShape = {
  pair: string;
  sets: ConcealedSet[];
};

const sevenPairsTileCount = 14;
const thirteenOrphansTileCount = 14;
const orphanKinds = 13;

export function findStandardShapes(tileCodes: string[], setsNeeded: number): HandShape[] {
  if (tileCodes.length !== setsNeeded * 3 + 2 || !allPlayable(tileCodes)) {
    return [];
  }
  const counts = countCodes(tileCodes);
  const shapes: HandShape[] = [];
  for (const pair of counts.keys()) {
    if ((counts.get(pair) ?? 0) < 2) {
      continue;
    }
    counts.set(pair, (counts.get(pair) ?? 0) - 2);
    for (const sets of splitIntoSets(counts)) {
      shapes.push({ pair, sets });
    }
    counts.set(pair, (counts.get(pair) ?? 0) + 2);
  }
  return shapes;
}

export function isSevenPairs(tileCodes: string[]): boolean {
  if (tileCodes.length !== sevenPairsTileCount || !allPlayable(tileCodes)) {
    return false;
  }
  const counts = countCodes(tileCodes);
  return [...counts.values()].every((count) => count === 2);
}

export function isThirteenOrphans(tileCodes: string[]): boolean {
  if (tileCodes.length !== thirteenOrphansTileCount) {
    return false;
  }
  if (!tileCodes.every((code) => isTerminalOrHonorCode(code))) {
    return false;
  }
  return countCodes(tileCodes).size === orphanKinds;
}

function allPlayable(tileCodes: string[]): boolean {
  return tileCodes.every((code) => {
    const parsed = parseTileCode(code);
    return parsed != null && parsed.kind !== TileKind.Bonus;
  });
}

function countCodes(tileCodes: string[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const code of tileCodes.slice().sort(compareTileCodes)) {
    counts.set(code, (counts.get(code) ?? 0) + 1);
  }
  return counts;
}

function splitIntoSets(counts: Map<string, number>): ConcealedSet[][] {
  const first = [...counts.keys()].find((code) => (counts.get(code) ?? 0) > 0);
  if (first == null) {
    return [[]];
  }
  const results: ConcealedSet[][] = [];
  const firstCount = counts.get(first) ?? 0;
  if (firstCount >= 3) {
    counts.set(first, firstCount - 3);
    for (const rest of splitIntoSets(counts)) {
      results.push([{ meldType: MeldType.Pong, tileCodes: [first, first, first] }, ...rest]);
    }
    counts.set(first, firstCount);
  }
  const run = runStartingAt(first);
  if (run != null && run.every((code) => (counts.get(code) ?? 0) > 0)) {
    for (const code of run) {
      counts.set(code, (counts.get(code) ?? 0) - 1);
    }
    for (const rest of splitIntoSets(counts)) {
      results.push([{ meldType: MeldType.Chow, tileCodes: run }, ...rest]);
    }
    for (const code of run) {
      counts.set(code, (counts.get(code) ?? 0) + 1);
    }
  }
  return results;
}

function runStartingAt(code: string): string[] | undefined {
  const parsed = parseTileCode(code);
  if (parsed == null || parsed.suit == null || parsed.rank == null || parsed.rank > 7) {
    return undefined;
  }
  return [code, suitedCode(parsed.suit, parsed.rank + 1), suitedCode(parsed.suit, parsed.rank + 2)];
}
