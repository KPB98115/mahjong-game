<script setup lang="ts">
import { type SeatModel } from "../../model/client/seatModel";
import { useLocale } from "../../logic/client/locale/useLocale";
import { MessageKey } from "../../types/client/messageKey";

defineProps<{
  seats: SeatModel[];
  currentSeatIndex: number | null;
}>();

const locale = useLocale();
</script>

<template>
  <ul class="seat-rail">
    <li
      v-for="seat in seats"
      :key="seat.seatIndex"
      class="card"
      :class="{ current: currentSeatIndex === seat.seatIndex }"
    >
      <strong>{{ locale.playerLabel(seat.displayName, seat.seatIndex) }}</strong>
      <span class="score">{{ seat.runningScore }}</span>
      <span :class="seat.connected ? 'online' : 'away'">
        {{ locale.text(seat.connected ? MessageKey.Connected : MessageKey.Away) }}
      </span>
    </li>
  </ul>
</template>

<style scoped>
.seat-rail {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: var(--space-md);
  margin: 0;
  padding: 0;
  list-style: none;
}

li {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 0.4cqw;
  padding: 0.45cqh 0.8cqw;
  font-size: clamp(0.75rem, 2.8cqh, 0.95rem);
}

li strong {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.score {
  font-variant-numeric: tabular-nums;
  font-size: inherit;
}

.current {
  outline: 2px solid var(--color-accent);
  outline-offset: 2px;
}

.online {
  color: #86efac;
}

.away {
  color: var(--color-muted-foreground);
}
</style>
