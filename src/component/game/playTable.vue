<script setup lang="ts">
import { computed } from "vue";
import ClaimBar from "./claimBar.vue";
import SeatZone from "./seatZone.vue";
import TableCenter from "./tableCenter.vue";
import {
  claimTrayOpen,
  liveDiscard,
  suggestAction,
  SuggestedAction,
  timerSeconds,
} from "../../logic/client/game/claimSuggestion";
import { type PlayLogic } from "../../logic/client/game/playLogic";
import { placeSeats } from "../../logic/client/game/tableLayout";
import { useLocale } from "../../logic/client/locale/useLocale";
import { type GameSnapshotModel } from "../../model/client/gameSnapshotModel";
import { MessageKey } from "../../types/client/messageKey";
import { type MeldType } from "../../types/server/meldType";
import { RoundPhase } from "../../types/server/roundPhase";

const props = defineProps<{
  snapshot: GameSnapshotModel;
  play: PlayLogic;
}>();

const emit = defineEmits<{
  toggleTile: [tileId: string];
  draw: [];
  discard: [];
  discardTile: [tileId: string];
  claim: [kind: MeldType, tileIds: string[]];
  pass: [];
  win: [];
}>();

const locale = useLocale();

const seats = computed(() =>
  placeSeats({
    selfSeatIndex: props.play.selfSeatIndex ?? 0,
    dealerSeatIndex: props.snapshot.game.dealerSeatIndex,
    handTileCount: props.snapshot.game.handTileCount,
    phase: props.play.round?.phase ?? null,
    currentSeatIndex: props.play.round?.currentSeatIndex ?? null,
    seats: props.snapshot.seats,
    discards: props.play.publicTiles.discards,
    melds: props.play.publicTiles.melds,
    flowers: props.play.publicTiles.flowerTiles,
  }),
);

const openDiscard = computed(() =>
  liveDiscard({
    phase: props.play.round?.phase ?? null,
    claimTileCode: props.play.view.claimTileCode,
    claimDiscardSeatIndex: props.play.view.claimDiscardSeatIndex,
    discards: props.play.publicTiles.discards,
  }),
);

const suggestion = computed(() =>
  suggestAction({
    phase: props.play.round?.phase ?? null,
    selfSeatIndex: props.play.selfSeatIndex,
    hand: props.play.hand,
    selectedTileIds: props.play.view.selectedTileIds,
    melds: props.play.publicTiles.melds.filter(
      (meld) => meld.seatIndex === props.play.selfSeatIndex,
    ),
    discardSeatIndex: openDiscard.value?.seatIndex ?? null,
    discardTileCode: openDiscard.value?.tileCode ?? null,
    chowOnlyFromPrevious: props.snapshot.game.chowOnlyFromPrevious,
    canDeclareWin: props.play.canDeclareWin,
    canDraw: props.play.canDraw,
    canDiscard: props.play.canDiscard,
  }),
);

const currentSide = computed(() => seats.value.find((seat) => seat.isCurrent)?.side ?? null);
const trayOpen = computed(() => claimTrayOpen(suggestion.value));
const seconds = computed(() =>
  timerSeconds(props.play.view.turnRemainingMs, props.play.view.claimTimeoutMs),
);
const yourTurn = computed(() => {
  const round = props.play.round;
  return (
    round != null &&
    props.play.selfSeatIndex != null &&
    round.currentSeatIndex === props.play.selfSeatIndex &&
    (round.phase === RoundPhase.Draw || round.phase === RoundPhase.Discard)
  );
});
const showTurn = computed(() => props.play.canDraw || props.play.canDiscard);
const turnEnabled = computed(() => props.play.canDraw || props.play.canPressDiscard);
const turnSuggested = computed(
  () =>
    suggestion.value.suggested === SuggestedAction.Draw ||
    suggestion.value.suggested === SuggestedAction.Discard,
);
const turnLabel = computed(() =>
  props.play.round?.phase === RoundPhase.Draw
    ? locale.text(MessageKey.DrawTile)
    : locale.text(MessageKey.DiscardTile),
);
const suggestedText = computed(() => {
  const action = suggestion.value.suggested;
  if (action == null) {
    return "";
  }
  return locale.text(MessageKey.SuggestedAction, { action: actionLabel(action) });
});

function actionLabel(action: SuggestedAction): string {
  if (action === SuggestedAction.Win) {
    return locale.text(MessageKey.Hu);
  }
  if (action === SuggestedAction.Kong) {
    return locale.text(MessageKey.Kong);
  }
  if (action === SuggestedAction.Pong) {
    return locale.text(MessageKey.Pong);
  }
  if (action === SuggestedAction.Chow) {
    return locale.text(MessageKey.Chow);
  }
  if (action === SuggestedAction.Draw) {
    return locale.text(MessageKey.DrawTile);
  }
  return locale.text(MessageKey.DiscardTile);
}

function toggleTile(tileId: string) {
  emit("toggleTile", tileId);
}

function draw() {
  emit("draw");
}

function discard() {
  emit("discard");
}

function discardTile(tileId: string) {
  emit("discardTile", tileId);
}

function claim(kind: MeldType, tileIds: string[]) {
  emit("claim", kind, tileIds);
}

function pass() {
  emit("pass");
}

function win() {
  emit("win");
}

function takeTurn() {
  if (props.play.canDraw) {
    draw();
    return;
  }
  discard();
}
</script>

<template>
  <section class="play-table">
    <p v-if="play.view.error" class="error banner" role="alert">
      {{ locale.errorLabel(play.view.error) }}
    </p>
    <div class="felt">
      <p class="sr-only" aria-live="polite">{{ suggestedText }}</p>
      <article
        v-for="seat in seats"
        :key="seat.seatIndex"
        class="badge"
        :class="[seat.side, { current: seat.isCurrent }]"
        :aria-current="seat.isCurrent ? 'true' : undefined"
      >
        <span class="wind" aria-hidden="true">{{ locale.windMark(seat.wind) }}</span>
        <span class="who">
          <strong>{{ locale.playerLabel(seat.displayName, seat.seatIndex) }}</strong>
          <span class="score">{{ seat.score }}</span>
        </span>
        <span class="presence" :class="{ online: seat.connected }">
          <span class="sr-only">{{
            locale.text(seat.connected ? MessageKey.Connected : MessageKey.Away)
          }}</span>
        </span>
      </article>
      <div class="center">
        <TableCenter
          :round-wind="snapshot.game.prevailingWind"
          :wall-remaining="play.round?.wallRemainingCount ?? 0"
          :timer-seconds="seconds"
          :current-side="currentSide"
          :markers="seats.map((seat) => ({ side: seat.side, wind: seat.wind }))"
        />
      </div>
      <SeatZone
        v-for="seat in seats"
        :key="seat.seatIndex"
        :seat="seat"
        :hand="seat.isSelf ? play.hand : []"
        :selected-tile-ids="play.view.selectedTileIds"
        @toggle="toggleTile"
        @discard-tile="discardTile"
      />
      <ClaimBar
        v-if="trayOpen"
        class="tray"
        :suggestion="suggestion"
        @claim="claim"
        @pass="pass"
        @win="win"
      />
      <div v-if="showTurn" class="turn-dock">
        <p v-if="yourTurn" class="your-turn">{{ locale.text(MessageKey.YourTurn) }}</p>
        <button
          class="btn turn-btn"
          :class="{ 'btn-accent': turnEnabled, 'is-suggested': turnSuggested }"
          type="button"
          :disabled="!turnEnabled"
          @click="takeTurn"
        >
          {{ turnLabel }}
        </button>
      </div>
    </div>
  </section>
</template>

<style scoped>
.play-table {
  height: 100%;
  min-height: 0;
}

.felt {
  position: relative;
  height: 100%;
  min-height: 0;
  container-type: size;
  overflow: hidden;
  --hand-tile-w: clamp(2.75rem, 11cqh, 3.25rem);
  --hand-tile-h: clamp(3.7rem, 15cqh, 4.4rem);
}

.banner {
  position: absolute;
  z-index: 7;
  top: 2.6rem;
  left: 18%;
  right: 18%;
}

.badge {
  position: absolute;
  z-index: 4;
  display: flex;
  align-items: center;
  gap: 0.35rem;
  max-width: 34%;
  min-height: 2rem;
  margin: 0;
  padding: 0.15rem 0.5rem 0.15rem 0.15rem;
  border-radius: 999px;
  background: rgb(6 32 20 / 0.82);
  border: 1px solid var(--color-border);
}

.badge.left {
  top: 0.25rem;
  left: 0.25rem;
}

.badge.across {
  top: 0.25rem;
  left: 50%;
  transform: translateX(-50%);
}

.badge.right {
  top: 0.25rem;
  right: 0.25rem;
}

.badge.self {
  left: 0.25rem;
  bottom: 0.4rem;
  max-width: 6rem;
}

.badge.current {
  border-color: var(--color-accent);
}

.wind {
  display: grid;
  place-items: center;
  width: 1.7rem;
  height: 1.7rem;
  border-radius: 999px;
  background: var(--color-accent);
  color: var(--color-on-accent);
  font-size: 0.75rem;
  font-weight: 700;
}

.who {
  display: flex;
  align-items: baseline;
  gap: 0.35rem;
  min-width: 0;
  font-size: 0.78rem;
}

.who strong {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.score {
  font-variant-numeric: tabular-nums;
  font-weight: 700;
}

.presence {
  width: 0.5rem;
  height: 0.5rem;
  border-radius: 999px;
  background: var(--color-muted-foreground);
}

.presence.online {
  background: #86efac;
}

.center {
  position: absolute;
  z-index: 3;
  left: 50%;
  top: 50%;
  transform: translate(-50%, -46%);
}

.tray {
  position: absolute;
  z-index: 5;
  left: 12%;
  right: 16%;
  bottom: calc(var(--hand-tile-h) + 0.85rem);
}

.turn-dock {
  position: absolute;
  z-index: 5;
  right: 3.4rem;
  bottom: 0.35rem;
  display: grid;
  justify-items: end;
  gap: 0.2rem;
}

.your-turn {
  margin: 0;
  color: var(--color-accent);
  font-size: 0.75rem;
  font-weight: 700;
}

.turn-btn {
  min-width: 4.5rem;
  border-radius: 999px;
}

.turn-btn.is-suggested {
  box-shadow: 0 0 0 3px var(--color-ring);
}

.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  margin: -1px;
  padding: 0;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}
</style>
