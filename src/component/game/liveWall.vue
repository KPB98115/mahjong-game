<script setup lang="ts">
import { computed } from "vue";
import { tileCoverSrc } from "../../logic/client/game/tileFace";
import { placeLiveWall } from "../../logic/client/game/wallLayout";

const props = defineProps<{
  selfSeatIndex: number;
  dealerSeatIndex: number;
  handTileCount: number;
  wallHeadSortIndex: number | null;
  wallTailSortIndex: number | null;
}>();

const coverSrc = tileCoverSrc();
const sides = computed(() =>
  placeLiveWall({
    selfSeatIndex: props.selfSeatIndex,
    dealerSeatIndex: props.dealerSeatIndex,
    handTileCount: props.handTileCount,
    wallHeadSortIndex: props.wallHeadSortIndex,
    wallTailSortIndex: props.wallTailSortIndex,
  }),
);
</script>

<template>
  <div v-if="coverSrc" class="live-wall" aria-hidden="true">
    <div class="frame">
      <ol v-for="side in sides" :key="side.side" class="side" :class="side.side">
        <li
          v-for="stack in side.stacks"
          :key="stack.stackIndex"
          class="stack"
          :class="{ gap: stack.standingCount === 0 }"
        >
          <img v-if="stack.lowerStanding" class="cover lower" :src="coverSrc" alt="" />
          <img v-if="stack.upperStanding" class="cover upper" :src="coverSrc" alt="" />
        </li>
      </ol>
    </div>
  </div>
</template>

<style scoped>
.live-wall {
  position: absolute;
  z-index: 0;
  pointer-events: none;
  display: grid;
  place-items: center;
  left: max(2.6rem, 9%);
  right: max(2.6rem, 9%);
  top: 4.7rem;
  bottom: calc(var(--hand-tile-h) + 2.15rem);
  container-type: size;
}

.frame {
  --wall-ratio: 1.368;
  --wall-lift-ratio: 0.26;
  --wall-block: calc(var(--wall-ratio) + var(--wall-lift-ratio));
  --tile-w: min(
    1.05rem,
    calc((100cqi - 17px) / 18),
    calc((100cqb - 17px) / (18 + 2 * var(--wall-block)))
  );
  --tile-h: calc(var(--tile-w) * var(--wall-ratio));
  --lift: calc(var(--tile-w) * var(--wall-lift-ratio));
  --end: calc(var(--tile-h) + var(--lift));
  --row: calc(18 * var(--tile-w) + 17px);
  --col: calc(var(--row) + 2 * var(--end));
  position: relative;
  width: var(--row);
  height: var(--col);
}

.side {
  position: absolute;
  display: flex;
  gap: 1px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.side.self {
  left: 0;
  right: 0;
  bottom: 0;
  height: var(--end);
  justify-content: center;
}

.side.across {
  left: 0;
  right: 0;
  top: 0;
  height: var(--end);
  flex-direction: row-reverse;
  justify-content: center;
}

.side.right {
  top: var(--end);
  bottom: var(--end);
  right: 0;
  width: var(--end);
  flex-direction: column-reverse;
  justify-content: center;
}

.side.left {
  top: var(--end);
  bottom: var(--end);
  left: 0;
  width: var(--end);
  flex-direction: column;
  justify-content: center;
}

.stack {
  position: relative;
  flex: 0 0 var(--tile-w);
  width: var(--tile-w);
  height: var(--end);
}

.side.right .stack,
.side.left .stack {
  width: var(--end);
  height: var(--tile-w);
}

.stack.gap {
  visibility: hidden;
}

.cover {
  position: absolute;
  display: block;
  width: var(--tile-w);
  height: var(--tile-h);
  object-fit: fill;
}

.cover.lower {
  left: 0;
  bottom: 0;
}

.cover.upper {
  left: calc(var(--tile-w) * 0.08);
  bottom: var(--lift);
}

.side.across .cover.lower {
  left: 0;
  top: var(--lift);
  bottom: auto;
}

.side.across .cover.upper {
  left: calc(var(--tile-w) * 0.08);
  top: 0;
  bottom: auto;
}

.side.right .cover,
.side.left .cover {
  top: 50%;
  left: 50%;
}

.side.right .cover.lower {
  transform: translate(-50%, -50%) rotate(-90deg);
}

.side.right .cover.upper {
  transform: translate(-62%, -58%) rotate(-90deg);
}

.side.left .cover.lower {
  transform: translate(-50%, -50%) rotate(90deg);
}

.side.left .cover.upper {
  transform: translate(-38%, -42%) rotate(90deg);
}
</style>
