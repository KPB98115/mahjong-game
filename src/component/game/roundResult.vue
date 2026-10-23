<script setup lang="ts">
import { type RoundResultViewModel } from "../../model/client/roundResultViewModel";
import { type ScoreboardModel } from "../../model/client/scoreboardModel";
import { type GameSnapshotModel } from "../../model/client/gameSnapshotModel";
import { useLocale } from "../../logic/client/locale/useLocale";
import { MessageKey } from "../../types/client/messageKey";

defineProps<{
  snapshot: GameSnapshotModel;
  scoreboard: ScoreboardModel;
  model: RoundResultViewModel;
}>();

const emit = defineEmits<{
  nextWind: [];
}>();

const locale = useLocale();

function nextWind() {
  emit("nextWind");
}
</script>

<template>
  <section class="card round-result">
    <h2>{{ locale.text(MessageKey.RoundResult) }}</h2>
    <p class="kind">{{ locale.resultLabel(snapshot.round?.resultType ?? null) }}</p>
    <table>
      <thead>
        <tr>
          <th>{{ locale.text(MessageKey.SeatColumn) }}</th>
          <th>{{ locale.text(MessageKey.PlayerColumn) }}</th>
          <th>{{ locale.text(MessageKey.DeltaColumn) }}</th>
          <th>{{ locale.text(MessageKey.AfterColumn) }}</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="row in scoreboard.roundScores" :key="row.seatIndex">
          <td>{{ row.seatIndex }}</td>
          <td>{{ row.userId }}</td>
          <td>{{ row.scoreDelta }}</td>
          <td>{{ row.scoreAfter }}</td>
        </tr>
      </tbody>
    </table>
    <p v-if="model.error" class="error" role="alert">{{ locale.errorLabel(model.error) }}</p>
    <button
      class="btn btn-accent"
      type="button"
      :disabled="!model.nextWindEnabled || model.pending"
      @click="nextWind"
    >
      {{ locale.text(model.pending ? MessageKey.WaitingNext : MessageKey.NextWind) }}
    </button>
  </section>
</template>

<style scoped>
.round-result {
  height: 100%;
  min-height: 0;
  display: grid;
  grid-template-rows: auto auto minmax(0, 1fr) auto auto;
  gap: var(--space-lg);
  align-content: start;
  overflow: auto;
}

.kind {
  color: var(--color-muted-foreground);
  text-transform: capitalize;
}

table {
  border-collapse: collapse;
  width: 100%;
}

th,
td {
  text-align: left;
  padding: var(--space-md) var(--space-lg);
  border-bottom: 1px solid var(--color-border);
  font-variant-numeric: tabular-nums;
}

th {
  color: var(--color-muted-foreground);
  font-weight: 500;
}
</style>
