<script setup lang="ts">
import { computed } from "vue";
import { tileFaceSrc } from "../../logic/client/game/tileFace";

const props = defineProps<{
  tileCode: string;
}>();

const src = computed(() => tileFaceSrc(props.tileCode));
</script>

<template>
  <span class="tile-plate">
    <img v-if="src" class="tile-face" :src="src" :alt="tileCode" width="44" height="58" />
    <span v-else class="tile-face">{{ tileCode }}</span>
  </span>
</template>

<style scoped>
.tile-plate {
  display: inline-flex;
  isolation: isolate;
  border-radius: var(--radius-sm);
  background: var(--color-tile);
  box-shadow: var(--shadow-sm);
}

.tile-face {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: var(--tile-w, clamp(1.5rem, 7cqh, 2.35rem));
  height: var(--tile-h, clamp(2.05rem, 9.2cqh, 3.1rem));
  object-fit: contain;
  padding: 0.15rem;
  border: 1px solid #e4dfd4;
  border-radius: var(--radius-sm);
  background: #ffffff;
  color: var(--color-tile-ink);
  font-size: 0.7rem;
}
</style>
