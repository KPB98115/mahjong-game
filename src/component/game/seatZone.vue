<script setup lang="ts">
import { computed } from "vue";
import { type HandTileModel } from "../../model/client/handTileModel";
import { discardRows, type SeatPlace } from "../../logic/client/game/tableLayout";
import { useLocale } from "../../logic/client/locale/useLocale";
import { MessageKey } from "../../types/client/messageKey";
import HandTiles from "./handTiles.vue";
import TileFace from "./tileFace.vue";
import TileWall from "./tileWall.vue";

const props = defineProps<{
  seat: SeatPlace;
  hand: HandTileModel[];
  selectedTileIds: string[];
}>();

const emit = defineEmits<{
  toggle: [tileId: string];
  discardTile: [tileId: string];
}>();

const locale = useLocale();
const rows = computed(() => discardRows(props.seat.discards));
const seatLabel = computed(() => locale.playerLabel(props.seat.displayName, props.seat.seatIndex));

function toggle(tileId: string) {
  emit("toggle", tileId);
}

function discardTile(tileId: string) {
  emit("discardTile", tileId);
}
</script>

<template>
  <div class="zone" :class="[seat.side, seat.exposedEdge]">
    <div
      v-if="seat.flowers.length > 0 || seat.melds.length > 0"
      class="exposed"
      :aria-label="`${locale.text(MessageKey.Flowers)} ${locale.text(MessageKey.Melds)}`"
    >
      <ul v-if="seat.melds.length > 0" class="melds">
        <li v-for="meld in seat.melds" :key="meld.sortIndex" class="meld">
          <TileFace
            v-for="tile in meld.tiles"
            :key="`${meld.sortIndex}-${tile.sortIndex}`"
            :tile-code="tile.tileCode"
          />
        </li>
      </ul>
      <ul v-if="seat.flowers.length > 0" class="flowers">
        <li v-for="tile in seat.flowers" :key="tile.sortIndex">
          <TileFace :tile-code="tile.tileCode" />
        </li>
      </ul>
    </div>
    <div class="holding">
      <div
        v-if="rows.length > 0"
        class="river"
        :aria-label="`${seatLabel} ${locale.text(MessageKey.Discards)}`"
      >
        <ol v-for="(row, rowIndex) in rows" :key="rowIndex" class="river-row">
          <li v-for="tile in row" :key="tile.sortIndex" :class="{ latest: tile.isLatest }">
            <TileFace :tile-code="tile.tileCode" />
          </li>
        </ol>
      </div>
      <HandTiles
        v-if="seat.isSelf"
        :tiles="hand"
        :selected-tile-ids="selectedTileIds"
        @toggle="toggle"
        @discard-tile="discardTile"
      />
      <TileWall v-else :count="seat.concealedCount" />
    </div>
  </div>
</template>

<style scoped>
.zone {
  position: absolute;
  z-index: 1;
  min-width: 0;
  min-height: 0;
  --tile-w: 1.6rem;
  --tile-h: 2.15rem;
}

.zone.self {
  z-index: 2;
  left: 0.25rem;
  right: 0.25rem;
  bottom: 0.3rem;
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr);
  align-items: end;
  column-gap: 0.4rem;
  --tile-w: clamp(1.5rem, 7cqh, 2.35rem);
  --tile-h: clamp(2.05rem, 9.2cqh, 3.1rem);
}

.zone.right,
.zone.left {
  top: 3.2rem;
  bottom: calc(var(--hand-tile-h, 3rem) + 2.2rem);
  --tile-w: 1.5rem;
  --tile-h: 1.75rem;
  width: min(46%, 18rem);
  display: grid;
  pointer-events: none;
}

.zone.right {
  right: 0.2rem;
  grid-template-columns: auto auto;
  grid-template-rows: minmax(0, 1fr) auto;
  grid-template-areas:
    "river tiles"
    "river exposed";
  justify-content: end;
  align-items: stretch;
}

.zone.left {
  left: 0.2rem;
  grid-template-columns: auto auto;
  grid-template-rows: auto minmax(0, 1fr);
  grid-template-areas:
    "exposed river"
    "tiles river";
  justify-content: start;
  align-items: stretch;
}

.zone.across {
  top: 2.5rem;
  left: 16%;
  right: 16%;
  display: grid;
  grid-template-columns: auto auto;
  grid-template-areas:
    "tiles exposed"
    "river river";
  justify-content: center;
  justify-items: center;
  pointer-events: none;
  --tile-w: 1.5rem;
  --tile-h: 2rem;
}

.exposed {
  display: flex;
  gap: 0.3rem;
}

.zone.self .exposed,
.zone.across .exposed,
.zone.right .exposed {
  align-items: flex-end;
}

.zone.left .exposed {
  align-items: flex-start;
}

.zone.self .exposed {
  grid-column: 1;
  justify-self: end;
  flex-direction: row;
}

.zone.right .exposed,
.zone.left .exposed {
  flex-direction: column;
  grid-area: exposed;
}

.zone.left .exposed {
  flex-direction: column-reverse;
}

.zone.across .exposed {
  grid-area: exposed;
  flex-direction: row;
  align-self: end;
}

.flowers,
.melds,
.meld,
.river,
.river-row {
  display: flex;
  gap: 1px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.melds,
.zone.self .exposed,
.zone.across .exposed {
  gap: 0.35rem;
}

.holding {
  display: flex;
  min-width: 0;
  min-height: 0;
}

.zone.self .holding {
  grid-column: 2;
  justify-self: center;
  flex-direction: column;
  align-items: center;
  gap: 0.25rem;
}

.zone.right .holding,
.zone.left .holding,
.zone.across .holding {
  display: contents;
}

.river {
  grid-area: river;
}

.zone.self .river {
  flex-direction: column-reverse;
  align-items: center;
}

.zone.right .river {
  flex-direction: row-reverse;
  align-items: flex-end;
  align-self: center;
}

.zone.left .river {
  flex-direction: row;
  align-items: flex-start;
  align-self: center;
}

.zone.across .river {
  flex-direction: column;
  align-items: center;
  margin-top: 0.3rem;
}

.zone.self .river-row,
.zone.across .river-row {
  flex-direction: row;
}

.zone.right .river-row,
.zone.left .river-row {
  flex-direction: column;
}

.latest :deep(.tile-plate) {
  outline: 2px solid var(--color-accent);
  outline-offset: 1px;
}

.zone.right :deep(.river .tile-plate),
.zone.left :deep(.river .tile-plate) {
  position: relative;
  width: var(--tile-h);
  height: var(--tile-w);
}

.zone.right :deep(.river .tile-face),
.zone.left :deep(.river .tile-face) {
  position: absolute;
  width: var(--tile-w);
  height: var(--tile-h);
}

.zone.right :deep(.river .tile-face) {
  transform: rotate(-90deg);
}

.zone.left :deep(.river .tile-face) {
  transform: rotate(90deg);
}

.zone.across :deep(.river .tile-face) {
  transform: rotate(180deg);
}

.zone :deep(.wall) {
  grid-area: tiles;
}

.zone.right :deep(.wall),
.zone.left :deep(.wall) {
  flex-direction: column;
  align-self: center;
  height: 100%;
  width: calc(var(--tile-w) * 26 / 19);
  gap: 1px;
  justify-content: center;
}

.zone.right :deep(.wall) {
  justify-self: end;
}

.zone.left :deep(.wall) {
  justify-self: start;
}

.zone.right :deep(.wall li),
.zone.left :deep(.wall li) {
  position: relative;
  flex: 1 1 var(--tile-w);
  min-height: 0;
  max-height: var(--tile-w);
  width: 100%;
  container-type: size;
}

.zone.right :deep(.wall .cover),
.zone.left :deep(.wall .cover) {
  position: absolute;
  top: 50%;
  left: 50%;
  width: 100cqb;
  height: 100cqi;
  max-width: none;
  object-fit: fill;
}

.zone.right :deep(.wall .cover) {
  transform: translate(-50%, -50%) rotate(-90deg);
}

.zone.left :deep(.wall .cover) {
  transform: translate(-50%, -50%) rotate(90deg);
}

.zone.across .exposed {
  margin-left: 0.35rem;
}

.zone.right .exposed {
  margin-top: 0.25rem;
}

.zone.across :deep(.wall) {
  flex-direction: row;
  justify-content: center;
}
</style>
