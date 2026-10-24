<script setup lang="ts">
import { computed } from "vue";
import { type RoundModel } from "../../model/client/roundModel";
import { useLocale } from "../../logic/client/locale/useLocale";
import { MessageKey } from "../../types/client/messageKey";

const props = defineProps<{
  round: RoundModel | null;
  selfSeatIndex: number | null;
  turnRemainingMs: number | null;
}>();

const locale = useLocale();
const turnSeconds = computed(() =>
  props.turnRemainingMs == null ? null : Math.ceil(props.turnRemainingMs / 1000),
);
</script>

<template>
  <p v-if="round" class="turn-banner" :class="{ yours: selfSeatIndex === round.currentSeatIndex }">
    {{ locale.text(MessageKey.Phase) }} {{ locale.phaseLabel(round.phase) }} ·
    {{ locale.text(MessageKey.SeatWord) }} {{ round.currentSeatIndex }}
    <span v-if="selfSeatIndex === round.currentSeatIndex">{{
      locale.text(MessageKey.YourTurn)
    }}</span>
    <span v-if="turnSeconds != null">
      · {{ locale.text(MessageKey.TurnSeconds, { seconds: String(turnSeconds) }) }}</span
    >
    · {{ locale.text(MessageKey.Wall) }} {{ round.wallRemainingCount }}
  </p>
</template>

<style scoped>
.turn-banner {
  margin: 0;
  padding: var(--space-lg) var(--space-xl);
  border-radius: var(--radius-lg);
  background: var(--color-muted);
  border: 1px solid var(--color-border);
  color: var(--color-muted-foreground);
}

.yours {
  color: var(--color-foreground);
  border-color: var(--color-accent);
  background: rgb(217 119 6 / 0.16);
}
</style>
