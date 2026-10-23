import {
  dragonOrder,
  flowerOrder,
  isBonusCode,
  seasonOrder,
  suitedCode,
  suitOrder,
  windOrder,
} from "./tileCode";

export function standardWallTileCodes(): string[] {
  const codes: string[] = [];
  for (const suit of suitOrder) {
    for (let rank = 1; rank <= 9; rank += 1) {
      for (let copy = 0; copy < 4; copy += 1) {
        codes.push(suitedCode(suit, rank));
      }
    }
  }
  for (const honor of [...windOrder, ...dragonOrder]) {
    for (let copy = 0; copy < 4; copy += 1) {
      codes.push(honor);
    }
  }
  codes.push(...flowerOrder, ...seasonOrder);
  return codes;
}

export function isBonusTileCode(tileCode: string): boolean {
  return isBonusCode(tileCode);
}
