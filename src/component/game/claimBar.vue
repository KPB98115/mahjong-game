<script setup lang="ts">
import { useLocale } from "../../logic/client/locale/useLocale";
import { MessageKey } from "../../types/client/messageKey";
import { MeldType } from "../../types/server/meldType";

defineProps<{
  canClaim: boolean;
  canPass: boolean;
  canDeclareWin: boolean;
  claimTimeoutMs: number | null;
}>();

const emit = defineEmits<{
  claim: [kind: MeldType];
  pass: [];
  win: [];
}>();

const locale = useLocale();

function claim(kind: MeldType) {
  emit("claim", kind);
}

function pass() {
  emit("pass");
}

function win() {
  emit("win");
}
</script>

<template>
  <section class="claim-bar" aria-label="Claim actions">
    <p v-if="claimTimeoutMs != null" class="window">
      {{ locale.text(MessageKey.ClaimWindowOpen, { ms: String(claimTimeoutMs) }) }}
    </p>
    <button class="btn" type="button" :disabled="!canClaim" @click="claim(MeldType.Chow)">
      {{ locale.text(MessageKey.Chow) }}
    </button>
    <button class="btn" type="button" :disabled="!canClaim" @click="claim(MeldType.Pong)">
      {{ locale.text(MessageKey.Pong) }}
    </button>
    <button class="btn" type="button" :disabled="!canClaim" @click="claim(MeldType.Kong)">
      {{ locale.text(MessageKey.Kong) }}
    </button>
    <button class="btn btn-ghost" type="button" :disabled="!canPass" @click="pass">
      {{ locale.text(MessageKey.Pass) }}
    </button>
    <button class="btn btn-accent" type="button" :disabled="!canDeclareWin" @click="win">
      {{ locale.text(MessageKey.Hu) }}
    </button>
  </section>
</template>

<style scoped>
.claim-bar {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 0.6cqw;
  align-items: center;
  padding: 0.6cqh 0.8cqw;
  background: var(--color-card);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
}

.window {
  grid-column: 1 / -1;
  margin: 0;
  color: var(--color-muted-foreground);
  font-size: clamp(0.75rem, 2.4cqh, 0.9rem);
  font-variant-numeric: tabular-nums;
}
</style>
