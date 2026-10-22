const suits = ["man", "bam", "dot"] as const;
const honors = ["east", "south", "west", "north", "red", "green", "white"] as const;
const flowers = ["flower_plum", "flower_orchid", "flower_chrysanthemum", "flower_bamboo"] as const;
const seasons = ["season_spring", "season_summer", "season_autumn", "season_winter"] as const;

export function standardWallTileCodes(): string[] {
  const codes: string[] = [];
  for (const suit of suits) {
    for (let rank = 1; rank <= 9; rank += 1) {
      for (let copy = 0; copy < 4; copy += 1) {
        codes.push(`${suit}_${rank}`);
      }
    }
  }
  for (const honor of honors) {
    for (let copy = 0; copy < 4; copy += 1) {
      codes.push(honor);
    }
  }
  for (const flower of flowers) {
    codes.push(flower);
  }
  for (const season of seasons) {
    codes.push(season);
  }
  return codes;
}

export function isBonusTileCode(tileCode: string): boolean {
  return tileCode.startsWith("flower_") || tileCode.startsWith("season_");
}
