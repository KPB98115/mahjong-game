import {
  DragonTile,
  FlowerTile,
  SeasonTile,
  TileKind,
  TileSuit,
  WindTile,
} from "../../../types/server/tile";

export type ParsedTile = {
  code: string;
  kind: TileKind;
  suit: TileSuit | null;
  rank: number | null;
};

export const suitOrder: TileSuit[] = Object.values(TileSuit);
export const windOrder: WindTile[] = Object.values(WindTile);
export const dragonOrder: DragonTile[] = Object.values(DragonTile);
export const flowerOrder: FlowerTile[] = Object.values(FlowerTile);
export const seasonOrder: SeasonTile[] = Object.values(SeasonTile);

const kindOrder: TileKind[] = Object.values(TileKind);
const bonusOrder: string[] = [...flowerOrder, ...seasonOrder];

export function isWindCode(code: string): boolean {
  return windOrder.some((tile) => tile === code);
}

export function isDragonCode(code: string): boolean {
  return dragonOrder.some((tile) => tile === code);
}

export function isBonusCode(code: string): boolean {
  return bonusOrder.includes(code);
}

export function parseTileCode(code: string): ParsedTile | undefined {
  if (isWindCode(code)) {
    return { code, kind: TileKind.Wind, suit: null, rank: null };
  }
  if (isDragonCode(code)) {
    return { code, kind: TileKind.Dragon, suit: null, rank: null };
  }
  if (isBonusCode(code)) {
    return { code, kind: TileKind.Bonus, suit: null, rank: null };
  }
  const [suitText, rankText, extra] = code.split("_");
  if (extra !== undefined || rankText === undefined || rankText.length !== 1) {
    return undefined;
  }
  const suit = suitOrder.find((item) => item === suitText);
  if (suit === undefined || rankText < "1" || rankText > "9") {
    return undefined;
  }
  return { code, kind: TileKind.Suited, suit, rank: Number(rankText) };
}

export function compareTileCodes(left: string, right: string): number {
  return tileOrder(left) - tileOrder(right);
}

export function isHonorCode(code: string): boolean {
  const parsed = parseTileCode(code);
  return parsed != null && (parsed.kind === TileKind.Wind || parsed.kind === TileKind.Dragon);
}

export function isTerminalOrHonorCode(code: string): boolean {
  const parsed = parseTileCode(code);
  if (parsed == null || parsed.kind === TileKind.Bonus) {
    return false;
  }
  return parsed.kind !== TileKind.Suited || parsed.rank === 1 || parsed.rank === 9;
}

export function suitedCode(suit: TileSuit, rank: number): string {
  return `${suit}_${rank}`;
}

export function bonusSeatPosition(code: string): number | undefined {
  const flower = flowerOrder.findIndex((tile) => tile === code);
  if (flower >= 0) {
    return flower;
  }
  const season = seasonOrder.findIndex((tile) => tile === code);
  return season >= 0 ? season : undefined;
}

function tileOrder(code: string): number {
  const parsed = parseTileCode(code);
  if (parsed == null) {
    return Number.MAX_SAFE_INTEGER;
  }
  const kindBase = kindOrder.indexOf(parsed.kind) * 100;
  if (parsed.kind === TileKind.Suited && parsed.suit != null && parsed.rank != null) {
    return kindBase + suitOrder.indexOf(parsed.suit) * 10 + parsed.rank;
  }
  if (parsed.kind === TileKind.Wind) {
    return kindBase + windOrder.findIndex((tile) => tile === code);
  }
  if (parsed.kind === TileKind.Dragon) {
    return kindBase + dragonOrder.findIndex((tile) => tile === code);
  }
  return kindBase + bonusOrder.indexOf(code);
}
