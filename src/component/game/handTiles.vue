<script setup lang="ts">
import { type HandTileModel } from "../../model/client/handTileModel";
import { computed } from "vue";
import { sortedHandTiles } from "../../logic/client/game/handOrder";
import { useLocale } from "../../logic/client/locale/useLocale";
import { MessageKey } from "../../types/client/messageKey";
import TileFace from "./tileFace.vue";

const props = defineProps<{
  tiles: HandTileModel[];
  selectedTileIds: string[];
}>();

const emit = defineEmits<{
  toggle: [tileId: string];
  discardTile: [tileId: string];
}>();

const locale = useLocale();
const concealedTiles = computed(() => sortedHandTiles(props.tiles.filter((tile) => !tile.isDrawn)));
const drawnTiles = computed(() => props.tiles.filter((tile) => tile.isDrawn));

function toggle(tileId: string) {
  emit("toggle", tileId);
}

function discardTile(tileId: string) {
  emit("discardTile", tileId);
}
</script>

<template>
  <section class="hand">
    <h2 class="section-title">{{ locale.text(MessageKey.YourHand) }}</h2>
    <ul class="hand-tiles">
      <li v-for="tile in concealedTiles" :key="tile.id">
        <button
          type="button"
          class="tile-button"
          :class="{ selected: selectedTileIds.includes(tile.id) }"
          :aria-pressed="selectedTileIds.includes(tile.id)"
          @click="toggle(tile.id)"
          @dblclick="discardTile(tile.id)"
        >
          <TileFace :tile-code="tile.tileCode" />
        </button>
      </li>
      <li v-for="(tile, index) in drawnTiles" :key="tile.id" :class="{ drawn: index === 0 }">
        <button
          type="button"
          class="tile-button"
          :class="{ selected: selectedTileIds.includes(tile.id) }"
          :aria-pressed="selectedTileIds.includes(tile.id)"
          @click="toggle(tile.id)"
          @dblclick="discardTile(tile.id)"
        >
          <TileFace :tile-code="tile.tileCode" />
        </button>
      </li>
    </ul>
  </section>
</template>

<style scoped>
.hand {
  position: relative;
  display: grid;
  width: 100%;
  min-width: 0;
}

.hand .section-title {
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

.hand-tiles {
  display: flex;
  flex-wrap: nowrap;
  align-items: flex-end;
  width: max-content;
  max-width: 100%;
  min-width: 0;
  overflow-x: auto;
  overscroll-behavior: contain;
  touch-action: pan-x;
  gap: 1px;
  margin: 0;
  padding: 1rem 0.55rem 0;
  list-style: none;
  --tile-w: var(--hand-tile-w, 2.15rem);
  --tile-h: var(--hand-tile-h, 2.9rem);
}

.tile-button {
  border: none;
  background: none;
  padding: 0;
  min-width: var(--tile-w);
  min-height: var(--tile-h);
  border-radius: var(--radius-sm);
  transition: transform var(--duration) ease;
}

.tile-button.selected {
  position: relative;
  z-index: 1;
  transform: translateY(-0.45rem);
}

.selected :deep(.tile-plate) {
  outline: 3px solid var(--color-accent);
  outline-offset: 2px;
}

.drawn {
  margin-left: 0.4rem;
}

.drawn :deep(.tile-plate) {
  background: #ffe1b5;
}
</style>
