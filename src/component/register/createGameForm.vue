<script setup lang="ts">
import { type CreateGameViewModel } from "../../model/client/createGameViewModel";
import { type ClaimWindowMs } from "../../types/server/claimWindowMs";
import { type DiscardWinPayer } from "../../types/server/discardWinPayer";
import { type Ruleset } from "../../types/server/ruleset";
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
  props.model.chowTouched = true;
  props.model.chowOnlyFromPrevious = value;
}

function setOptionalNumber(
  field: "handTileCount" | "winMeldCount" | "minScoreUnits",
  value: string,
) {
  props.model[field] = value === "" ? undefined : Number(value);
}

function claimWindowLabel(value: ClaimWindowMs | null): string {
  return locale.claimWindowLabel(value);
}
</script>

<template>
  <form class="card create-game-form scroll-region" @submit.prevent="submit">
    <h2>{{ locale.text(MessageKey.CreateTable) }}</h2>
    <label class="field">
      {{ locale.text(MessageKey.Ruleset) }}
      <select v-model="props.model.ruleset">
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
      <select v-model="props.model.scoreUnit">
        <option :value="undefined">{{ locale.text(MessageKey.Preset) }}</option>
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
        @change="setChowOnlyFromPrevious(($event.target as HTMLInputElement).checked)"
      />
      {{ locale.text(MessageKey.ChowOnlyFromPrevious) }}
    </label>
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
    <p v-if="error" class="error" role="alert">{{ locale.errorLabel(error) }}</p>
    <button class="btn" type="submit" :disabled="pending">
      {{ locale.text(pending ? MessageKey.Creating : MessageKey.CreateTableAction) }}
    </button>
  </form>
</template>

<style scoped>
.create-game-form {
  display: grid;
  gap: var(--space-lg);
  align-content: start;
}
</style>
