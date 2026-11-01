<script setup lang="ts">
import { computed } from "vue";
import { type TableSide } from "../../logic/client/game/tableLayout";
import { useLocale } from "../../logic/client/locale/useLocale";
import { MessageKey } from "../../types/client/messageKey";
import { type PrevailingWind } from "../../types/server/prevailingWind";

const props = defineProps<{
  roundWind: PrevailingWind;
  wallRemaining: number;
  timerSeconds: number | null;
  currentSide: TableSide | null;
  markers: { side: TableSide; wind: PrevailingWind }[];
}>();

const locale = useLocale();
const label = computed(() => {
  const wind = locale.windName(props.roundWind);
  const count = String(props.wallRemaining);
  if (props.timerSeconds == null) {
    return locale.text(MessageKey.CompassStatus, { wind, count });
  }
  return locale.text(MessageKey.CompassTimed, {
    wind,
    count,
    seconds: String(props.timerSeconds),
  });
});
</script>

<template>
  <div
    class="compass"
    :class="currentSide == null ? undefined : `turn-${currentSide}`"
    role="status"
    :aria-label="label"
  >
    <span
      v-for="marker in markers"
      :key="marker.side"
      class="mark"
      :class="[marker.side, { turn: marker.side === currentSide }]"
      :aria-current="marker.side === currentSide ? 'true' : undefined"
    >
      {{ locale.windMark(marker.wind) }}
    </span>
    <p class="round-wind" aria-hidden="true">{{ locale.windGlyph(roundWind) }}</p>
    <p class="wall-count" aria-hidden="true">{{ wallRemaining }}</p>
    <p v-if="timerSeconds != null" class="timer" aria-hidden="true">{{ timerSeconds }}</p>
  </div>
</template>

<style scoped>
.compass {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.15rem;
  width: clamp(6.75rem, 30cqh, 8.75rem);
  height: clamp(6.75rem, 30cqh, 8.75rem);
  border-radius: 1.1rem;
  background: radial-gradient(circle at 50% 42%, rgb(36 110 68 / 0.95), rgb(6 36 22 / 0.96) 72%);
  border: 3px solid var(--color-border);
  box-shadow: var(--shadow-md);
}

.turn-self {
  border-bottom-color: var(--color-accent);
}

.turn-right {
  border-right-color: var(--color-accent);
}

.turn-across {
  border-top-color: var(--color-accent);
}

.turn-left {
  border-left-color: var(--color-accent);
}

.round-wind {
  margin: 0;
  color: var(--color-accent);
  font-family: var(--font-heading);
  font-size: clamp(1.8rem, 8cqh, 2.6rem);
  font-weight: 700;
  line-height: 1;
}

.wall-count,
.timer {
  margin: 0;
  font-variant-numeric: tabular-nums;
  line-height: 1.1;
}

.wall-count {
  color: var(--color-foreground);
  font-size: clamp(0.95rem, 3.4cqh, 1.15rem);
  font-weight: 700;
}

.timer {
  color: var(--color-accent);
  font-size: clamp(0.8rem, 2.8cqh, 0.95rem);
  font-weight: 700;
}

.mark {
  position: absolute;
  color: var(--color-foreground);
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0.04em;
  border: 2px solid transparent;
  border-radius: 999px;
  padding: 0.05rem 0.28rem;
}

.mark.turn {
  border-color: var(--color-accent);
  color: var(--color-accent);
}

.self {
  bottom: 0.4rem;
  left: 50%;
  transform: translateX(-50%);
}

.right {
  right: 0.45rem;
  top: 50%;
  transform: translateY(-50%);
}

.across {
  top: 0.4rem;
  left: 50%;
  transform: translateX(-50%);
}

.left {
  left: 0.45rem;
  top: 50%;
  transform: translateY(-50%);
}
</style>
