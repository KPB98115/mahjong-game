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
  display: grid;
  grid-auto-flow: column;
  grid-template-rows: repeat(2, minmax(0, 1fr));
  grid-auto-columns: clamp(1.05rem, 3.6cqh, 1.45rem);
  gap: 0.25cqh;
  height: clamp(2.5rem, 9cqh, 3.4rem);
  margin: 0;
  padding: 0.35cqh;
  overflow-x: auto;
  overflow-y: hidden;
  list-style: none;
  background: rgb(8 48 30 / 0.45);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
}

.cover {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: contain;
}
</style>
