<script setup lang="ts">
import { type JoinGameViewModel } from "../../model/client/joinGameViewModel";
import { useLocale } from "../../logic/client/locale/useLocale";
import { MessageKey } from "../../types/client/messageKey";

const props = defineProps<{
  model: JoinGameViewModel;
  pending: boolean;
}>();

const emit = defineEmits<{
  submit: [];
}>();

const locale = useLocale();

function submit() {
  emit("submit");
}
</script>

<template>
  <form class="card join-game-form scroll-region" @submit.prevent="submit">
    <h2>{{ locale.text(MessageKey.JoinTable) }}</h2>
    <label class="field">
      {{ locale.text(MessageKey.InvitationCode) }}
      <input
        v-model="props.model.referenceCode"
        class="code-input"
        name="referenceCode"
        maxlength="5"
        inputmode="numeric"
        autocomplete="off"
      />
    </label>
    <p v-if="props.model.error" class="error" role="alert">
      {{ locale.errorLabel(props.model.error) }}
    </p>
    <button class="btn btn-accent" type="submit" :disabled="pending">
      {{ locale.text(pending ? MessageKey.Joining : MessageKey.Join) }}
    </button>
  </form>
</template>

<style scoped>
.join-game-form {
  display: grid;
  gap: var(--space-lg);
  align-content: start;
}

.code-input {
  letter-spacing: 0.4em;
  font-size: 1.35rem;
  font-variant-numeric: tabular-nums;
  text-align: center;
}
</style>
