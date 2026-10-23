import { type HandTileModel } from "../../../model/client/handTileModel";
import { emptyPlayViewModel, type PlayViewModel } from "../../../model/client/playViewModel";
import { type PublicTilesModel } from "../../../model/client/publicTilesModel";
import { type RoundModel } from "../../../model/client/roundModel";
import {
  claimActionSchema,
  discardActionSchema,
  gameActionSchema,
  type ClaimedPayload,
  type ClaimWindowPayload,
  type DiscardedPayload,
  type DrewPayload,
  type ActionErrorPayload,
  type RoundEndedPayload,
  type SelfHandPayload,
  type TurnPayload,
} from "../../../model/server/playResult";
import { type GameSnapshot } from "../../../model/server/gameSnapshot";
import { type GameSocketPort } from "../../../types/client/gameSocketPort";
import { type MeldType } from "../../../types/server/meldType";
import { RoundPhase } from "../../../types/server/roundPhase";

export type PlayEmitter = Pick<
  GameSocketPort,
  "draw" | "discard" | "claim" | "passClaim" | "declareWin"
>;

export class PlayLogic {
  view: PlayViewModel = emptyPlayViewModel();
  hand: HandTileModel[] = [];
  publicTiles: PublicTilesModel = { discards: [], melds: [], flowerTiles: [] };
  round: RoundModel | null = null;
  selfSeatIndex: number | null = null;
  autoDraw = true;

  constructor(readonly emitter: PlayEmitter | undefined = undefined) {}

  get selectedTileIds(): string[] {
    return this.view.selectedTileIds;
  }

  set selectedTileIds(value: string[]) {
    this.view.selectedTileIds = value;
  }

  get canDraw(): boolean {
    return this.isSelfTurn(RoundPhase.Draw) && !this.autoDraw;
  }

  get canDiscard(): boolean {
    return this.isSelfTurn(RoundPhase.Discard);
  }

  get canClaim(): boolean {
    return this.round?.phase === RoundPhase.Claim || this.canDiscard;
  }

  get canPass(): boolean {
    return this.round?.phase === RoundPhase.Claim || this.round?.phase === RoundPhase.RobKong;
  }

  get canDeclareWin(): boolean {
    return this.canPass || this.canDiscard;
  }

  applySnapshot(snapshot: GameSnapshot): void {
    this.autoDraw = snapshot.game.autoDraw;
    this.round = snapshot.round;
    this.publicTiles = snapshot.publicTiles;
    this.selfSeatIndex = snapshot.self?.seatIndex ?? null;
    this.hand = snapshot.self?.handTiles ?? [];
  }

  applySelfHand(payload: SelfHandPayload): void {
    this.hand = payload.tiles.map((tile) => ({
      id: tile.tileId,
      tileCode: tile.tileCode,
      sortIndex: tile.sortIndex,
      isDrawn: tile.isDrawn,
    }));
  }

  applyDrew(payload: DrewPayload): void {
    this.hand = [
      ...this.hand.filter((tile) => !tile.isDrawn),
      {
        id: payload.tile.tileId,
        tileCode: payload.tile.tileCode,
        sortIndex: this.hand.length,
        isDrawn: true,
      },
    ];
    if (this.selfSeatIndex == null) {
      return;
    }
    this.publicTiles = {
      ...this.publicTiles,
      flowerTiles: [
        ...this.publicTiles.flowerTiles,
        ...payload.flowers.map((flower, offset) => ({
          seatIndex: this.selfSeatIndex ?? 0,
          tileCode: flower.tileCode,
          sortIndex: this.publicTiles.flowerTiles.length + offset,
        })),
      ],
    };
  }

  applyDiscarded(payload: DiscardedPayload): void {
    this.publicTiles = {
      ...this.publicTiles,
      discards: [
        ...this.publicTiles.discards,
        {
          seatIndex: payload.seatIndex,
          tileCode: payload.tileCode,
          sortIndex: this.publicTiles.discards.length,
        },
      ],
    };
    this.hand = this.hand.filter((tile) => tile.id !== payload.tileId);
  }

  applyClaimWindow(payload: ClaimWindowPayload): void {
    this.view.claimTimeoutMs = payload.timeoutMs;
  }

  applyClaimed(payload: ClaimedPayload): void {
    this.view.claimTimeoutMs = null;
    this.publicTiles = {
      ...this.publicTiles,
      melds: [
        ...this.publicTiles.melds,
        {
          seatIndex: payload.seatIndex,
          meldType: payload.kind,
          isConcealed: false,
          fromSeatIndex: null,
          sortIndex: this.publicTiles.melds.length,
          tiles: payload.tileCodes.map((tileCode, sortIndex) => ({
            tileCode,
            sortIndex,
            isClaimed: sortIndex === 0,
          })),
        },
      ],
    };
  }

  applyTurn(payload: TurnPayload): void {
    if (this.round == null) {
      this.round = {
        phase: payload.phase,
        currentSeatIndex: payload.currentSeatIndex,
        resultType: null,
        winKind: null,
        wallRemainingCount: 0,
      };
      return;
    }
    this.round = {
      ...this.round,
      phase: payload.phase,
      currentSeatIndex: payload.currentSeatIndex,
    };
  }

  applyRoundEnded(payload: RoundEndedPayload): void {
    this.view.claimTimeoutMs = null;
    if (this.round == null) {
      return;
    }
    this.round = {
      ...this.round,
      resultType: payload.resultType,
      winKind: payload.winKind,
    };
  }

  applyActionError(payload: ActionErrorPayload): void {
    this.view.error = payload.error;
  }

  toggleTile(tileId: string): void {
    if (this.view.selectedTileIds.includes(tileId)) {
      this.view.selectedTileIds = this.view.selectedTileIds.filter((id) => id !== tileId);
      return;
    }
    this.view.selectedTileIds = [...this.view.selectedTileIds, tileId];
  }

  draw(gameId: string): void {
    if (!this.canDraw) {
      return;
    }
    const parsed = gameActionSchema.safeParse({ gameId });
    if (!parsed.success) {
      return;
    }
    this.emitter?.draw(parsed.data);
  }

  discard(gameId: string): void {
    if (!this.canDiscard || this.view.selectedTileIds.length !== 1) {
      return;
    }
    const tileId = this.view.selectedTileIds[0];
    if (tileId == null) {
      return;
    }
    const parsed = discardActionSchema.safeParse({ gameId, tileId });
    if (!parsed.success) {
      return;
    }
    this.emitter?.discard(parsed.data);
  }

  claim(gameId: string, kind: MeldType): void {
    if (!this.canClaim) {
      return;
    }
    const parsed = claimActionSchema.safeParse({
      gameId,
      kind,
      tileIds: this.view.selectedTileIds,
    });
    if (!parsed.success) {
      return;
    }
    this.emitter?.claim(parsed.data);
  }

  passClaim(gameId: string): void {
    if (!this.canPass) {
      return;
    }
    const parsed = gameActionSchema.safeParse({ gameId });
    if (!parsed.success) {
      return;
    }
    this.emitter?.passClaim(parsed.data);
  }

  declareWin(gameId: string): void {
    if (!this.canDeclareWin) {
      return;
    }
    const parsed = gameActionSchema.safeParse({ gameId });
    if (!parsed.success) {
      return;
    }
    this.emitter?.declareWin(parsed.data);
  }

  private isSelfTurn(phase: RoundPhase): boolean {
    return (
      this.round != null &&
      this.round.phase === phase &&
      this.selfSeatIndex != null &&
      this.round.currentSeatIndex === this.selfSeatIndex
    );
  }
}
