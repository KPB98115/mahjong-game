<script setup lang="ts">
import { type PublicTilesModel } from "../../model/client/publicTilesModel";
import { useLocale } from "../../logic/client/locale/useLocale";
import { MessageKey } from "../../types/client/messageKey";
import TileFace from "./tileFace.vue";

defineProps<{
  melds: PublicTilesModel["melds"];
}>();

const locale = useLocale();
</script>

<template>
  <section class="area">
    <h2 class="section-title">{{ locale.text(MessageKey.Melds) }}</h2>
    <ul class="melds">
      <li v-for="(meld, index) in melds" :key="`${meld.seatIndex}-${meld.sortIndex}-${index}`">
        <span>
          {{ locale.meldLabel(meld.meldType) }} · {{ locale.text(MessageKey.SeatWord) }}
          {{ meld.seatIndex }}
        </span>
        <TileFace
          v-for="(tile, tileIndex) in meld.tiles"
          :key="tileIndex"
          :tile-code="tile.tileCode"
        />
      </li>
    </ul>
  </section>
</template>

<style scoped>
.area {
  display: grid;
  gap: var(--space-md);
}

.melds {
  display: grid;
  gap: var(--space-md);
  margin: 0;
  padding: 0;
  list-style: none;
}

.melds li {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--space-sm);
  color: var(--color-muted-foreground);
}
</style>
