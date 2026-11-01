<script setup lang="ts">
import { tileCoverSrc } from "../../logic/client/game/tileFace";

defineProps<{
  count: number;
}>();

const coverSrc = tileCoverSrc();
</script>

<template>
  <ul v-if="count > 0 && coverSrc" class="wall" aria-hidden="true">
    <li v-for="index in count" :key="index">
      <img class="cover" :src="coverSrc" alt="" />
    </li>
  </ul>
</template>

<style scoped>
.wall {
  display: flex;
  gap: 1px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.cover {
  display: block;
  width: var(--tile-w, 1.35rem);
  height: var(--tile-h, 1.8rem);
  object-fit: contain;
}
</style>
