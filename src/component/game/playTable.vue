<script setup lang="ts">
import { defineAsyncComponent } from "vue";
import { type PlayLogic } from "../../logic/client/game/playLogic";
import { useLocale } from "../../logic/client/locale/useLocale";
import { type GameSnapshotModel } from "../../model/client/gameSnapshotModel";
import { MessageKey } from "../../types/client/messageKey";
import { type MeldType } from "../../types/server/meldType";

defineProps<{
  snapshot: GameSnapshotModel;
  play: PlayLogic;
}>();

const emit = defineEmits<{
  toggleTile: [tileId: string];
  draw: [];
  discard: [];
  claim: [kind: MeldType];
  pass: [];
  win: [];
  abort: [];
}>();

const locale = useLocale();
const HandTiles = defineAsyncComponent(() => import("./handTiles.vue"));
const DiscardArea = defineAsyncComponent(() => import("./discardArea.vue"));
const MeldArea = defineAsyncComponent(() => import("./meldArea.vue"));
const FlowerArea = defineAsyncComponent(() => import("./flowerArea.vue"));
const ClaimBar = defineAsyncComponent(() => import("./claimBar.vue"));
const TurnBanner = defineAsyncComponent(() => import("./turnBanner.vue"));
const SeatRail = defineAsyncComponent(() => import("./seatRail.vue"));

function toggleTile(tileId: string) {
  emit("toggleTile", tileId);
}

function draw() {
  emit("draw");
}

function discard() {
  emit("discard");
}

function claim(kind: MeldType) {
  emit("claim", kind);
}

function pass() {
  emit("pass");
}

function win() {
  emit("win");
}

function abort() {
  emit("abort");
}
</script>

<template>
  <section class="play-table">
    <SeatRail :seats="snapshot.seats" :current-seat-index="play.round?.currentSeatIndex ?? null" />
    <TurnBanner :round="play.round" :self-seat-index="play.selfSeatIndex" />
    <p v-if="play.view.error" class="error" role="alert">
      {{ locale.errorLabel(play.view.error) }}
    </p>
    <div class="felt scroll-region">
      <DiscardArea :discards="play.publicTiles.discards" />
      <MeldArea :melds="play.publicTiles.melds" />
      <FlowerArea :flowers="play.publicTiles.flowerTiles" />
    </div>
    <HandTiles
      :tiles="play.hand"
      :selected-tile-ids="play.view.selectedTileIds"
      @toggle="toggleTile"
    />
    <ClaimBar
      :can-claim="play.canClaim"
      :can-pass="play.canPass"
      :can-declare-win="play.canDeclareWin"
      :claim-timeout-ms="play.view.claimTimeoutMs"
      @claim="claim"
      @pass="pass"
      @win="win"
    />
    <div class="actions">
      <button class="btn" type="button" :disabled="!play.canDraw" @click="draw">
        {{ locale.text(MessageKey.DrawTile) }}
      </button>
      <button class="btn btn-accent" type="button" :disabled="!play.canDiscard" @click="discard">
        {{ locale.text(MessageKey.DiscardTile) }}
      </button>
      <button class="btn btn-danger" type="button" @click="abort">
        {{ locale.text(MessageKey.AbortTable) }}
      </button>
    </div>
  </section>
</template>

<style scoped>
.play-table {
  height: 100%;
  min-height: 0;
  display: flex;
  flex-direction: column;
  gap: 1cqh;
}

.felt {
  flex: 1;
  display: grid;
  grid-template-columns: minmax(0, 1.4fr) minmax(0, 1fr) minmax(0, 0.8fr);
  gap: 1.5cqw;
  align-content: start;
}

.actions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-md);
}
</style>
