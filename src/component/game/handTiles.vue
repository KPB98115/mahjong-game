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
const orderedTiles = computed(() => sortedHandTiles(props.tiles));

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
      <li v-for="tile in orderedTiles" :key="tile.id">
        <button
          type="button"
          class="tile-button"
          :class="{ selected: selectedTileIds.includes(tile.id), drawn: tile.isDrawn }"
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
  overflow-x: auto;
  overscroll-behavior: contain;
  touch-action: pan-x;
  gap: 0.5cqw;
  margin: 0;
  padding: 0.5cqh 0.8cqw;
  list-style: none;
  background: rgb(8 64 38 / 0.55);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
}

.tile-button {
  border: none;
  background: none;
  padding: 0;
  min-width: 2.75rem;
  min-height: 3.5rem;
  border-radius: var(--radius-sm);
  transition: box-shadow var(--duration) ease;
}

.tile-button:active :deep(.tile-plate) {
  transform: translateY(-0.15rem);
}

.selected :deep(.tile-plate) {
  outline: 3px solid var(--color-accent);
  outline-offset: 2px;
}

.drawn :deep(.tile-plate) {
  background: #ffe1b5;
}
</style>
