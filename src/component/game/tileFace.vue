<script setup lang="ts">
import { computed } from "vue";
import { tileFaceSrc } from "../../logic/client/game/tileFace";

const props = defineProps<{
  tileCode: string;
}>();

const src = computed(() => tileFaceSrc(props.tileCode));
</script>

<template>
  <img v-if="src" class="tile-face" :src="src" :alt="tileCode" width="44" height="58" />
  <span v-else class="tile-face">{{ tileCode }}</span>
</template>

<style scoped>
.tile-face {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 2.75rem;
  height: 3.6rem;
  object-fit: contain;
  padding: 0.15rem;
  border: 1px solid #d6c7a1;
  border-radius: var(--radius-sm);
  background: var(--color-tile);
  color: var(--color-tile-ink);
  box-shadow: var(--shadow-sm);
  font-size: 0.7rem;
}
</style>
