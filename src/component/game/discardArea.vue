<script setup lang="ts">
import { type PublicTilesModel } from "../../model/client/publicTilesModel";
import { useLocale } from "../../logic/client/locale/useLocale";
import { MessageKey } from "../../types/client/messageKey";
import TileFace from "./tileFace.vue";

defineProps<{
  discards: PublicTilesModel["discards"];
}>();

const locale = useLocale();
</script>

<template>
  <section class="area">
    <h2 class="section-title">{{ locale.text(MessageKey.Discards) }}</h2>
    <ul class="tiles">
      <li v-for="(tile, index) in discards" :key="`${tile.seatIndex}-${tile.sortIndex}-${index}`">
        <TileFace :tile-code="tile.tileCode" />
      </li>
    </ul>
  </section>
</template>

<style scoped>
.area {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  gap: 0.5cqw;
  align-items: start;
  min-height: 0;
}

.tiles {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-sm);
  min-height: clamp(2.4rem, 8cqh, 3.6rem);
  margin: 0;
  padding: var(--space-md);
  list-style: none;
  background: rgb(8 64 38 / 0.4);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
}
</style>
