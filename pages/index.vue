<script setup lang="ts">
import { useLocale } from "../src/logic/client/locale/useLocale";
import { MessageKey } from "../src/types/client/messageKey";

const locale = useLocale();
</script>

<template>
  <main class="redirect">
    <p class="status" aria-live="polite">{{ locale.text(MessageKey.Redirecting) }}</p>
  </main>
</template>

<style scoped>
.redirect {
  display: grid;
  place-items: center;
  padding: 2cqh;
}
</style>
