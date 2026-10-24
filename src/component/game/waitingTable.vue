<script setup lang="ts">
import { type GameSnapshotModel } from "../../model/client/gameSnapshotModel";
import { type WaitingViewModel } from "../../model/client/waitingViewModel";
import { useLocale } from "../../logic/client/locale/useLocale";
import { MessageKey } from "../../types/client/messageKey";
import { BotDifficulty } from "../../types/server/botDifficulty";

const props = defineProps<{
  snapshot: GameSnapshotModel;
  model: WaitingViewModel;
}>();

const emit = defineEmits<{
  copied: [];
  addBot: [];
  abort: [];
}>();

const locale = useLocale();
const botDifficulties = [BotDifficulty.Low, BotDifficulty.Medium, BotDifficulty.Smart];

async function copyCode() {
  await navigator.clipboard.writeText(props.snapshot.game.referenceCode);
  emit("copied");
}

function addBot() {
  emit("addBot");
}

function abort() {
  emit("abort");
}
</script>

<template>
  <section class="waiting-table">
    <header class="card invite">
      <h2>{{ locale.text(MessageKey.WaitingForPlayers) }}</h2>
      <p class="code">
        <span>{{ locale.text(MessageKey.InvitationCode) }}</span>
        <strong>{{ snapshot.game.referenceCode }}</strong>
        <button class="btn btn-accent" type="button" @click="copyCode">
          {{ locale.text(MessageKey.Copy) }}
        </button>
        <span v-if="model.copied" class="copied">{{ locale.text(MessageKey.Copied) }}</span>
      </p>
    </header>
    <ul class="seats">
      <li v-for="index in 4" :key="index" class="card seat">
        <template v-if="snapshot.seats[index - 1]">
          <span>{{
            locale.playerLabel(snapshot.seats[index - 1]?.displayName ?? null, index - 1)
          }}</span>
          <span :class="snapshot.seats[index - 1]?.connected ? 'online' : 'away'">
            {{
              locale.text(
                snapshot.seats[index - 1]?.connected ? MessageKey.Connected : MessageKey.Away,
              )
            }}
          </span>
        </template>
        <span v-else class="empty">{{
          locale.text(MessageKey.EmptySeat, { seat: String(index - 1) })
        }}</span>
      </li>
    </ul>
    <dl class="card rules scroll-region">
      <dt>{{ locale.text(MessageKey.Ruleset) }}</dt>
      <dd>{{ locale.rulesetLabel(snapshot.game.ruleset) }}</dd>
      <dt>{{ locale.text(MessageKey.ClaimWindow) }}</dt>
      <dd>{{ locale.claimWindowLabel(snapshot.game.claimWindowMs) }}</dd>
      <dt>{{ locale.text(MessageKey.ScoreUnit) }}</dt>
      <dd>{{ locale.scoreUnitLabel(snapshot.game.scoreUnit) }}</dd>
      <dt>{{ locale.text(MessageKey.DiscardWinPayer) }}</dt>
      <dd>{{ locale.payerLabel(snapshot.game.discardWinPayer) }}</dd>
      <dt>{{ locale.text(MessageKey.AutoDraw) }}</dt>
      <dd>{{ locale.boolLabel(snapshot.game.autoDraw) }}</dd>
      <dt>{{ locale.text(MessageKey.BonusTiles) }}</dt>
      <dd>{{ locale.boolLabel(snapshot.game.bonusTilesEnabled) }}</dd>
      <dt>{{ locale.text(MessageKey.ChowOnlyFromPrevious) }}</dt>
      <dd>{{ locale.boolLabel(snapshot.game.chowOnlyFromPrevious) }}</dd>
      <dt>{{ locale.text(MessageKey.HandTileCount) }}</dt>
      <dd>{{ snapshot.game.handTileCount }}</dd>
      <dt>{{ locale.text(MessageKey.WinMeldCount) }}</dt>
      <dd>{{ snapshot.game.winMeldCount }}</dd>
      <dt>{{ locale.text(MessageKey.MinScoreUnits) }}</dt>
      <dd>{{ snapshot.game.minScoreUnits }}</dd>
    </dl>
    <form class="card bots" @submit.prevent="addBot">
      <label class="field">
        {{ locale.text(MessageKey.BotDifficulty) }}
        <select v-model="model.botDifficulty">
          <option v-for="difficulty in botDifficulties" :key="difficulty" :value="difficulty">
            {{ locale.difficultyLabel(difficulty) }}
          </option>
        </select>
      </label>
      <button class="btn" type="submit" :disabled="model.pending || snapshot.seats.length >= 4">
        {{ locale.text(model.pending ? MessageKey.Adding : MessageKey.AddBot) }}
      </button>
      <button class="btn btn-danger" type="button" :disabled="model.pending" @click="abort">
        {{ locale.text(MessageKey.AbortTable) }}
      </button>
    </form>
    <p v-if="model.error" class="error" role="alert">{{ locale.errorLabel(model.error) }}</p>
  </section>
</template>

<style scoped>
.waiting-table {
  height: 100%;
  min-height: 0;
  display: grid;
  grid-template-columns: minmax(0, 1.1fr) minmax(0, 0.9fr);
  grid-template-rows: auto auto minmax(0, 1fr) auto;
  gap: 1.2cqh 1.5cqw;
}

.invite,
.seats,
.error {
  grid-column: 1 / -1;
}

.code {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--space-md);
  margin-top: 0.8cqh;
  color: var(--color-muted-foreground);
}

.code strong {
  font-size: 4cqh;
  letter-spacing: 0.28em;
  color: var(--color-accent);
  font-variant-numeric: tabular-nums;
}

.copied {
  color: #86efac;
  font-weight: 600;
}

.seats {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: var(--space-md);
  margin: 0;
  padding: 0;
  list-style: none;
  grid-column: 1 / -1;
}

.seat {
  display: flex;
  justify-content: space-between;
  gap: var(--space-md);
  padding: var(--space-lg);
}

.online {
  color: #86efac;
}

.away,
.empty {
  color: var(--color-muted-foreground);
}

.rules {
  display: grid;
  grid-template-columns: minmax(6rem, 1fr) minmax(0, 1fr);
  gap: var(--space-sm) var(--space-lg);
  align-content: start;
}

.rules dt {
  color: var(--color-muted-foreground);
}

.rules dd {
  margin: 0;
}

.bots {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-md);
  align-items: end;
}

.bots .field {
  min-width: 10rem;
  flex: 1;
}
</style>
