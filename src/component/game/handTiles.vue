<script setup lang="ts">
import { type HandTileModel } from "../../model/client/handTileModel";
import { useLocale } from "../../logic/client/locale/useLocale";
import { MessageKey } from "../../types/client/messageKey";
import TileFace from "./tileFace.vue";

defineProps<{
  tiles: HandTileModel[];
  selectedTileIds: string[];
}>();

const emit = defineEmits<{
  toggle: [tileId: string];
}>();

const locale = useLocale();

function toggle(tileId: string) {
  emit("toggle", tileId);
}
</script>

<template>
  <section class="hand">
    <h2 class="section-title">{{ locale.text(MessageKey.YourHand) }}</h2>
    <ul class="hand-tiles">
      <li v-for="tile in tiles" :key="tile.id">
        <button
          type="button"
          class="tile-button"
          :class="{ selected: selectedTileIds.includes(tile.id), drawn: tile.isDrawn }"
          :aria-pressed="selectedTileIds.includes(tile.id)"
          @click="toggle(tile.id)"
        >
          <TileFace :tile-code="tile.tileCode" />
        </button>
      </li>
    </ul>
  </section>
</template>

<style scoped>
.hand {
  display: grid;
  gap: var(--space-md);
}

.hand-tiles {
  display: flex;
  flex-wrap: nowrap;
  overflow-x: auto;
  overscroll-behavior: contain;
  touch-action: pan-x;
  gap: var(--space-md);
  margin: 0;
  padding: var(--space-lg);
  list-style: none;
  background: rgb(22 101 52 / 0.28);
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

.tile-button:hover:not(:disabled) :deep(.tile-face) {
  box-shadow: var(--shadow-md);
}

.selected :deep(.tile-face) {
  outline: 3px solid var(--color-accent);
  outline-offset: 2px;
}

.drawn :deep(.tile-face) {
  background: #fff7d6;
}
</style>
