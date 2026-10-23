import { DragonTile, FlowerTile, SeasonTile, TileSuit, WindTile } from "../../../types/server/tile";

const tileCodes = new Set<string>([
  ...suitedCodes(),
  ...Object.values(WindTile),
  ...Object.values(DragonTile),
  ...Object.values(FlowerTile),
  ...Object.values(SeasonTile),
]);

export function tileFaceFileName(tileCode: string): string | undefined {
  if (!tileCodes.has(tileCode)) {
    return undefined;
  }
  return `${tileCode}.svg`;
}

export function tileFaceSrc(tileCode: string): string | undefined {
  const fileName = tileFaceFileName(tileCode);
  if (fileName == null) {
    return undefined;
  }
  return tileModules[`../../../static/tiles/${fileName}`];
}

const tileModules = import.meta.glob("../../../static/tiles/*.svg", {
  eager: true,
  query: "?url",
  import: "default",
}) as Record<string, string>;

function suitedCodes(): string[] {
  const codes: string[] = [];
  for (const suit of Object.values(TileSuit)) {
    for (let rank = 1; rank <= 9; rank += 1) {
      codes.push(`${suit}_${rank}`);
    }
  }
  return codes;
}
