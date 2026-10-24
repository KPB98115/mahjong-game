<script setup lang="ts">
import { type RegisterViewModel } from "../../model/client/registerViewModel";
import { useLocale } from "../../logic/client/locale/useLocale";
import { MessageKey } from "../../types/client/messageKey";

const props = defineProps<{
  model: RegisterViewModel;
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
  <form class="card display-name-form scroll-region" @submit.prevent="submit">
    <label class="field">
      {{ locale.text(MessageKey.DisplayName) }}
      <input
        v-model="props.model.displayName"
        name="displayName"
        maxlength="32"
        autocomplete="nickname"
      />
    </label>
    <p v-if="props.model.error" class="error" role="alert">
      {{ locale.errorLabel(props.model.error) }}
    </p>
    <button class="btn btn-accent" type="submit" :disabled="props.model.pending">
      {{ locale.text(props.model.pending ? MessageKey.Saving : MessageKey.SaveName) }}
    </button>
  </form>
</template>

<style scoped>
.display-name-form {
  display: grid;
  gap: var(--space-lg);
  align-content: start;
  width: min(100%, 28rem);
  justify-self: center;
}
</style>
