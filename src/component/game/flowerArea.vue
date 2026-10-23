<script setup lang="ts">
import { type PublicTilesModel } from "../../model/client/publicTilesModel";
import { useLocale } from "../../logic/client/locale/useLocale";
import { MessageKey } from "../../types/client/messageKey";
import TileFace from "./tileFace.vue";

defineProps<{
  flowers: PublicTilesModel["flowerTiles"];
}>();

const locale = useLocale();
</script>

<template>
  <section class="area">
    <h2 class="section-title">{{ locale.text(MessageKey.Flowers) }}</h2>
    <ul class="tiles">
      <li v-for="(tile, index) in flowers" :key="`${tile.seatIndex}-${tile.sortIndex}-${index}`">
        <TileFace :tile-code="tile.tileCode" />
      </li>
    </ul>
  </section>
</template>

<style scoped>
.area {
  display: grid;
  gap: var(--space-md);
}

.tiles {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-sm);
  min-height: 3.6rem;
  margin: 0;
  padding: var(--space-md);
  list-style: none;
  background: rgb(22 101 52 / 0.18);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
}
</style>
