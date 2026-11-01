<script setup lang="ts">
import { type ActionSuggestion, SuggestedAction } from "../../logic/client/game/claimSuggestion";
import { useLocale } from "../../logic/client/locale/useLocale";
import { MessageKey } from "../../types/client/messageKey";
import { type MeldType } from "../../types/server/meldType";

const props = defineProps<{
  suggestion: ActionSuggestion;
}>();

const emit = defineEmits<{
  claim: [kind: MeldType, tileIds: string[]];
  pass: [];
  win: [];
}>();

const locale = useLocale();

function claim(kind: MeldType, tileIds: string[]) {
  emit("claim", kind, tileIds);
}

function pass() {
  emit("pass");
}

function win() {
  emit("win");
}

function current(kind: string): "true" | undefined {
  const suggested = props.suggestion.suggested;
  if (suggested == null) {
    return undefined;
  }
  return suggested === kind ? "true" : undefined;
}
</script>

<template>
  <section class="claim-tray" :aria-label="locale.text(MessageKey.ClaimWindow)">
    <button
      v-if="suggestion.showWin"
      class="btn"
      :class="{ 'btn-accent': suggestion.suggested === SuggestedAction.Win }"
      type="button"
      :aria-current="current(SuggestedAction.Win)"
      @click="win"
    >
      {{ locale.text(MessageKey.Hu) }}
    </button>
    <button
      v-for="offer in suggestion.offers"
      :key="offer.kind"
      class="btn"
      :class="{ 'btn-accent': current(offer.kind) === 'true' }"
      type="button"
      :aria-current="current(offer.kind)"
      @click="claim(offer.kind, offer.tileIds)"
    >
      {{ locale.meldLabel(offer.kind) }}
    </button>
    <button v-if="suggestion.showPass" class="btn btn-ghost" type="button" @click="pass">
      {{ locale.text(MessageKey.Pass) }}
    </button>
  </section>
</template>

<style scoped>
.claim-tray {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: var(--space-md);
}

.btn {
  min-width: 4.5rem;
}
</style>
