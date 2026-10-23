import { ClaimAnswerKind } from "../../../types/server/claimAnswerKind";
import { MeldType } from "../../../types/server/meldType";
import { TileKind } from "../../../types/server/tile";
import { type DbExecutor } from "../db/executor";
import { type ClaimAnswer, type SeatClaimAnswer } from "./claimWindowStore";
import { type MeldTileRow } from "./meldTilesRepo";
import { type MeldTileInput, type MeldTilesLogic } from "./meldTilesLogic";
import { type MeldRow, type MeldsRepo } from "./meldsRepo";
import { compareTileCodes, parseTileCode } from "./tileCode";

export type SeatMeld = {
  meld: MeldRow;
  tiles: MeldTileRow[];
};

export type ExposeMeldInput = {
  roundId: string;
  seatIndex: number;
  meldType: MeldType;
  isConcealed: boolean;
  fromSeatIndex: number | null;
  tiles: MeldTileInput[];
};

const seatCount = 4;

const meldSize: Record<MeldType, number> = {
  [MeldType.Chow]: 3,
  [MeldType.Pong]: 3,
  [MeldType.Kong]: 4,
};

const meldPriority: Record<MeldType, number> = {
  [MeldType.Chow]: 1,
  [MeldType.Pong]: 2,
  [MeldType.Kong]: 3,
};

const winPriority = 4;

export function formsMeld(kind: MeldType, tileCodes: string[]): boolean {
  if (tileCodes.length !== meldSize[kind]) {
    return false;
  }
  const parsed = tileCodes.map((code) => parseTileCode(code));
  if (parsed.some((tile) => tile == null || tile.kind === TileKind.Bonus)) {
    return false;
  }
  if (kind !== MeldType.Chow) {
    return tileCodes.every((code) => code === tileCodes[0]);
  }
  const sorted = tileCodes
    .slice()
    .sort(compareTileCodes)
    .map((code) => parseTileCode(code));
  const [first, second, third] = sorted;
  if (first?.suit == null || first.rank == null) {
    return false;
  }
  return (
    second?.suit === first.suit &&
    third?.suit === first.suit &&
    second.rank === first.rank + 1 &&
    third.rank === first.rank + 2
  );
}

export class MeldsLogic {
  constructor(
    private meldsRepo: MeldsRepo,
    private meldTilesLogic: MeldTilesLogic,
  ) {}

  canChow(claimerSeatIndex: number, discarderSeatIndex: number, chowOnlyFromPrevious: boolean) {
    return !chowOnlyFromPrevious || (discarderSeatIndex + 1) % seatCount === claimerSeatIndex;
  }

  pickClaim(answers: SeatClaimAnswer[], discarderSeatIndex: number): SeatClaimAnswer | undefined {
    let best: SeatClaimAnswer | undefined;
    for (const item of answers) {
      if (priority(item.answer) === 0) {
        continue;
      }
      if (best == null || outranks(item, best, discarderSeatIndex)) {
        best = item;
      }
    }
    return best;
  }

  async listForRound(roundId: string, tx?: DbExecutor): Promise<SeatMeld[]> {
    return this.withTiles(await this.meldsRepo.findByRoundId(roundId, tx), tx);
  }

  async listForSeat(roundId: string, seatIndex: number, tx?: DbExecutor): Promise<SeatMeld[]> {
    return this.withTiles(
      await this.meldsRepo.findByRoundIdAndSeatIndex(roundId, seatIndex, tx),
      tx,
    );
  }

  async expose(input: ExposeMeldInput, tx: DbExecutor): Promise<SeatMeld> {
    const existing = await this.meldsRepo.findByRoundIdAndSeatIndex(
      input.roundId,
      input.seatIndex,
      tx,
    );
    const last = existing[existing.length - 1];
    const meld = await this.meldsRepo.insert(
      {
        roundId: input.roundId,
        seatIndex: input.seatIndex,
        meldType: input.meldType,
        isConcealed: input.isConcealed,
        fromSeatIndex: input.fromSeatIndex,
        sortIndex: last == null ? 0 : last.sortIndex + 1,
      },
      tx,
    );
    const ordered = input.tiles
      .slice()
      .sort((left, right) => compareTileCodes(left.tileCode, right.tileCode));
    const tiles = await this.meldTilesLogic.add(meld.id, ordered, 0, tx);
    return { meld, tiles };
  }

  findUpgradablePong(melds: SeatMeld[], tileCode: string): SeatMeld | undefined {
    return melds.find(
      (item) => item.meld.meldType === MeldType.Pong && item.tiles[0]?.tileCode === tileCode,
    );
  }

  async upgradeToKong(pong: SeatMeld, tileCode: string, tx: DbExecutor): Promise<SeatMeld> {
    const meld = await this.meldsRepo.update(pong.meld.id, { meldType: MeldType.Kong }, tx);
    if (meld == null) {
      throw new Error("pong to upgrade is missing");
    }
    const added = await this.meldTilesLogic.add(
      meld.id,
      [{ tileCode, isClaimed: false }],
      pong.tiles.length,
      tx,
    );
    return { meld, tiles: [...pong.tiles, ...added] };
  }

  private async withTiles(melds: MeldRow[], tx?: DbExecutor): Promise<SeatMeld[]> {
    const result: SeatMeld[] = [];
    for (const meld of melds) {
      result.push({ meld, tiles: await this.meldTilesLogic.list(meld.id, tx) });
    }
    return result;
  }
}

function priority(answer: ClaimAnswer): number {
  if (answer.kind === ClaimAnswerKind.Win) {
    return winPriority;
  }
  if (answer.kind === ClaimAnswerKind.Meld) {
    return meldPriority[answer.meldType];
  }
  return 0;
}

function outranks(
  candidate: SeatClaimAnswer,
  current: SeatClaimAnswer,
  discarderSeatIndex: number,
): boolean {
  const difference = priority(candidate.answer) - priority(current.answer);
  if (difference !== 0) {
    return difference > 0;
  }
  return (
    seatDistance(discarderSeatIndex, candidate.seatIndex) <
    seatDistance(discarderSeatIndex, current.seatIndex)
  );
}

export function seatDistance(fromSeatIndex: number, toSeatIndex: number): number {
  return (toSeatIndex - fromSeatIndex + seatCount) % seatCount;
}
