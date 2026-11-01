<script setup lang="ts">
import { selectRuleset, type CreateGameViewModel } from "../../model/client/createGameViewModel";
import { defaultMinScoreUnits } from "../../logic/server/game/rulesetScore";
import { type ClaimWindowMs } from "../../types/server/claimWindowMs";
import { type DiscardWinPayer } from "../../types/server/discardWinPayer";
import { Ruleset } from "../../types/server/ruleset";
import { type ApiError } from "../../types/server/api";
import { useLocale } from "../../logic/client/locale/useLocale";
import { MessageKey } from "../../types/client/messageKey";
import { type ScoreUnit } from "../../types/server/scoreUnit";

const props = defineProps<{
  model: CreateGameViewModel;
  rulesets: Ruleset[];
  claimWindowMsOptions: Array<ClaimWindowMs | null>;
  scoreUnits: ScoreUnit[];
  discardWinPayers: DiscardWinPayer[];
  pending: boolean;
  error: ApiError | undefined;
}>();

const emit = defineEmits<{
  submit: [];
}>();

const locale = useLocale();

function submit() {
  emit("submit");
}

function setClaimWindow(value: string) {
  props.model.claimWindowTouched = true;
  props.model.claimWindowMs = value === "" ? null : Number(value);
}

function setAutoDraw(value: boolean) {
  props.model.autoDrawTouched = true;
  props.model.autoDraw = value;
}

function setBonusTiles(value: boolean) {
  props.model.bonusTilesTouched = true;
  props.model.bonusTilesEnabled = value;
}

function setChowOnlyFromPrevious(value: boolean) {
  if (props.model.ruleset === Ruleset.HongKong) {
    props.model.chowOnlyFromPrevious = true;
    return;
  }
  props.model.chowTouched = true;
  props.model.chowOnlyFromPrevious = value;
}

function chooseRuleset(value: string) {
  if (value === Ruleset.HongKong || value === Ruleset.Taiwan) {
    selectRuleset(props.model, value);
  }
}

function setOptionalNumber(
  field: "handTileCount" | "winMeldCount" | "minScoreUnits",
  value: string,
) {
  if (field === "minScoreUnits" && value === "") {
    props.model.minScoreTouched = false;
    props.model.minScoreUnits = defaultMinScoreUnits(props.model.ruleset);
    return;
  }
  if (field === "minScoreUnits") {
    props.model.minScoreTouched = true;
  }
  props.model[field] = Number(value);
}

function claimWindowLabel(value: ClaimWindowMs | null): string {
  return locale.claimWindowLabel(value);
}
</script>

<template>
  <form class="card create-game-form" @submit.prevent="submit">
    <h2>{{ locale.text(MessageKey.CreateTable) }}</h2>
    <p v-if="error" class="error" role="alert">{{ locale.errorLabel(error) }}</p>
    <label class="field">
      {{ locale.text(MessageKey.Ruleset) }}
      <select
        :value="props.model.ruleset"
        @change="chooseRuleset(($event.target as HTMLSelectElement).value)"
      >
        <option v-for="ruleset in rulesets" :key="ruleset" :value="ruleset">
          {{ locale.rulesetLabel(ruleset) }}
        </option>
      </select>
    </label>
    <label class="field">
      {{ locale.text(MessageKey.ClaimWindow) }}
      <select
        :value="props.model.claimWindowMs ?? ''"
        @change="setClaimWindow(($event.target as HTMLSelectElement).value)"
      >
        <option v-for="option in claimWindowMsOptions" :key="String(option)" :value="option ?? ''">
          {{ claimWindowLabel(option) }}
        </option>
      </select>
    </label>
    <label class="field">
      {{ locale.text(MessageKey.ScoreUnit) }}
      <select class="locked" :value="props.model.scoreUnit" disabled>
        <option v-for="unit in scoreUnits" :key="unit" :value="unit">
          {{ locale.scoreUnitLabel(unit) }}
        </option>
      </select>
    </label>
    <label class="field">
      {{ locale.text(MessageKey.DiscardWinPayer) }}
      <select v-model="props.model.discardWinPayer">
        <option :value="undefined">{{ locale.text(MessageKey.Preset) }}</option>
        <option v-for="payer in discardWinPayers" :key="payer" :value="payer">
          {{ locale.payerLabel(payer) }}
        </option>
      </select>
    </label>
    <div class="checks">
      <label class="checkbox">
        <input
          type="checkbox"
          :checked="props.model.autoDraw"
          @change="setAutoDraw(($event.target as HTMLInputElement).checked)"
        />
        {{ locale.text(MessageKey.AutoDraw) }}
      </label>
      <label class="checkbox">
        <input
          type="checkbox"
          :checked="props.model.bonusTilesEnabled === true"
          @change="setBonusTiles(($event.target as HTMLInputElement).checked)"
        />
        {{ locale.text(MessageKey.BonusTiles) }}
      </label>
      <label class="checkbox">
        <input
          type="checkbox"
          :checked="props.model.chowOnlyFromPrevious === true"
          :disabled="props.model.ruleset === Ruleset.HongKong"
          @change="setChowOnlyFromPrevious(($event.target as HTMLInputElement).checked)"
        />
        {{ locale.text(MessageKey.ChowOnlyFromPrevious) }}
      </label>
    </div>
    <label class="field">
      {{ locale.text(MessageKey.HandTileCount) }}
      <input
        type="number"
        :value="props.model.handTileCount ?? ''"
        @input="setOptionalNumber('handTileCount', ($event.target as HTMLInputElement).value)"
      />
    </label>
    <label class="field">
      {{ locale.text(MessageKey.WinMeldCount) }}
      <input
        type="number"
        :value="props.model.winMeldCount ?? ''"
        @input="setOptionalNumber('winMeldCount', ($event.target as HTMLInputElement).value)"
      />
    </label>
    <label class="field">
      {{ locale.text(MessageKey.MinScoreUnits) }}
      <input
        type="number"
        :value="props.model.minScoreUnits ?? ''"
        @input="setOptionalNumber('minScoreUnits', ($event.target as HTMLInputElement).value)"
      />
    </label>
    <button class="btn" type="submit" :disabled="pending">
      {{ locale.text(pending ? MessageKey.Creating : MessageKey.CreateTableAction) }}
    </button>
  </form>
</template>

<style scoped>
.create-game-form {
  height: 100%;
  min-height: 0;
  display: grid;
  grid-template-columns: max-content minmax(0, 1fr) max-content minmax(0, 1fr);
  grid-template-rows: auto 1fr 1fr auto 1fr auto;
  gap: 0.45cqh 0.8cqw;
  align-items: center;
  overflow: hidden;
}

.create-game-form h2,
.checks,
.create-game-form .error {
  grid-column: 1 / -1;
}

.create-game-form .field {
  display: grid;
  grid-column: span 2;
  grid-template-columns: subgrid;
  align-items: center;
  min-height: 0;
}

.create-game-form .field input,
.create-game-form .field select {
  min-height: 0;
  height: 2.5rem;
}

.create-game-form .locked {
  opacity: 1;
  color: var(--color-foreground);
}

.checks {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 0.8cqw;
  min-height: 0;
}

.checks .checkbox {
  min-height: 2.25rem;
}

.create-game-form .btn {
  grid-column: span 2;
  width: 100%;
  min-height: 2.5rem;
}
</style>
