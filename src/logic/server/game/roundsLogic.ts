import { GameStatus } from "../../../types/server/gameStatus";
import { RoundPhase } from "../../../types/server/roundPhase";
import { RoundResultType } from "../../../types/server/roundResultType";
import { RoundStatus } from "../../../types/server/roundStatus";
import { type DbExecutor } from "../db/executor";
import { type GameRandom } from "./gameRandom";
import { type GameRow, type GamesRepo } from "./gamesRepo";
import { type FlowerTilesRepo } from "./flowerTilesRepo";
import { type HandTilesRepo } from "./handTilesRepo";
import { type HandsRepo } from "./handsRepo";
import { type RoundsRepo } from "./roundsRepo";
import { type SeatsRepo } from "./seatsRepo";
import { isBonusTileCode, standardWallTileCodes } from "./wallTileCodes";
import { type WallTilesRepo } from "./wallTilesRepo";

const wallSize = 144;

export class RoundsLogic {
  constructor(
    private gamesRepo: GamesRepo,
    private roundsRepo: RoundsRepo,
    private handsRepo: HandsRepo,
    private handTilesRepo: HandTilesRepo,
    private wallTilesRepo: WallTilesRepo,
    private flowerTilesRepo: FlowerTilesRepo,
    private seatsRepo: SeatsRepo,
    private random: GameRandom,
  ) {}

  async start(input: {
    game: GameRow;
    dealerSeatIndex: number;
    now: Date;
    tx: DbExecutor;
  }): Promise<void> {
    const { game, dealerSeatIndex, now, tx } = input;
    if (game.handTileCount * 4 + 1 > wallSize) {
      throw new Error("hand does not fit in the wall");
    }
    await this.gamesRepo.update(game.id, { status: GameStatus.InProgress, updatedAt: now }, tx);
    const round = await this.roundsRepo.insert(
      {
        gameId: game.id,
        roundIndex: 0,
        status: RoundStatus.InProgress,
        dealerSeatIndex,
        prevailingWind: game.prevailingWind,
        currentSeatIndex: dealerSeatIndex,
        phase: RoundPhase.Draw,
        resultType: null,
        winKind: null,
        winnerSeatIndex: null,
        discardFromSeatIndex: null,
      },
      tx,
    );
    const ordered = this.random.shuffle(standardWallTileCodes());
    const seats = await this.seatsRepo.findByGameId(game.id, tx);
    let cursor = 0;
    for (const seat of seats) {
      const hand = await this.handsRepo.insert(
        { roundId: round.id, seatIndex: seat.seatIndex },
        tx,
      );
      const tiles = [];
      for (let sortIndex = 0; sortIndex < game.handTileCount; sortIndex += 1) {
        const tileCode = ordered[cursor];
        if (tileCode == null) {
          throw new Error("wall ran out during the deal");
        }
        tiles.push({
          handId: hand.id,
          tileCode,
          sortIndex,
          isDrawn: false,
        });
        cursor += 1;
      }
      await this.handTilesRepo.insertMany(tiles, tx);
    }
    const remaining = [];
    for (let index = cursor; index < ordered.length; index += 1) {
      const tileCode = ordered[index];
      if (tileCode == null) {
        continue;
      }
      remaining.push({ roundId: round.id, tileCode, sortIndex: index });
    }
    await this.wallTilesRepo.insertMany(remaining, tx);
    if (!game.autoDraw) {
      return;
    }
    const drew = await this.drawForSeat(round.id, dealerSeatIndex, game.bonusTilesEnabled, tx);
    if (!drew) {
      return;
    }
    await this.roundsRepo.update(round.id, { phase: RoundPhase.Discard, updatedAt: now }, tx);
  }

  async markAborted(gameId: string, now: Date, tx: DbExecutor): Promise<void> {
    const rounds = await this.roundsRepo.findByGameId(gameId, tx);
    const round = rounds.length === 0 ? undefined : rounds[rounds.length - 1];
    if (round == null) {
      return;
    }
    await this.roundsRepo.update(
      round.id,
      {
        status: RoundStatus.Aborted,
        resultType: RoundResultType.Abort,
        updatedAt: now,
      },
      tx,
    );
  }

  private async drawForSeat(
    roundId: string,
    seatIndex: number,
    bonusTilesEnabled: boolean,
    tx: DbExecutor,
  ): Promise<boolean> {
    const hand = await this.handsRepo.findByRoundIdAndSeatIndex(roundId, seatIndex, tx);
    if (hand == null) {
      throw new Error("dealer hand is missing");
    }
    let fromTail = false;
    while (true) {
      const tile = await this.takeWallTile(roundId, fromTail, tx);
      if (tile == null) {
        return false;
      }
      if (bonusTilesEnabled && isBonusTileCode(tile.tileCode)) {
        const flowers = await this.flowerTilesRepo.findByRoundIdAndSeatIndex(
          roundId,
          seatIndex,
          tx,
        );
        await this.flowerTilesRepo.insert(
          {
            roundId,
            seatIndex,
            tileCode: tile.tileCode,
            sortIndex: flowers.length,
          },
          tx,
        );
        fromTail = true;
        continue;
      }
      const handTiles = await this.handTilesRepo.findByHandId(hand.id, tx);
      const last = handTiles.length === 0 ? undefined : handTiles[handTiles.length - 1];
      await this.handTilesRepo.insert(
        {
          handId: hand.id,
          tileCode: tile.tileCode,
          sortIndex: last == null ? 0 : last.sortIndex + 1,
          isDrawn: true,
        },
        tx,
      );
      return true;
    }
  }

  private async takeWallTile(
    roundId: string,
    fromTail: boolean,
    tx: DbExecutor,
  ): Promise<{ id: string; tileCode: string } | undefined> {
    const wall = await this.wallTilesRepo.findByRoundId(roundId, tx);
    if (wall.length === 0) {
      return undefined;
    }
    const tile = fromTail ? wall[wall.length - 1] : wall[0];
    if (tile == null) {
      return undefined;
    }
    await this.wallTilesRepo.deleteById(tile.id, tx);
    return tile;
  }
}
