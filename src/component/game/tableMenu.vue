<script setup lang="ts">
import { onMounted, onUnmounted, ref } from "vue";
import { rememberDevMode } from "../../logic/client/dev/devModeLogic";
import { useDevMode } from "../../logic/client/dev/useDevMode";
import { rememberLocale } from "../../logic/client/locale/localeLogic";
import { useLocale } from "../../logic/client/locale/useLocale";
import { Locale } from "../../types/client/locale";
import { MessageKey } from "../../types/client/messageKey";

defineProps<{
  showAbort: boolean;
  abortPending: boolean;
}>();

const emit = defineEmits<{
  abort: [];
}>();

const locale = useLocale();
const devMode = useDevMode();
const open = ref(false);
const root = ref<HTMLElement | null>(null);

onMounted(() => {
  document.addEventListener("pointerdown", onPointerDown);
  document.addEventListener("keydown", onKeyDown);
});

onUnmounted(() => {
  document.removeEventListener("pointerdown", onPointerDown);
  document.removeEventListener("keydown", onKeyDown);
});

function toggle() {
  open.value = !open.value;
}

function close() {
  open.value = false;
}

function chooseLocale(next: Locale) {
  locale.choose(next);
  rememberLocale(localStorage, next);
  document.documentElement.lang = locale.locale;
  document.title = locale.text(MessageKey.AppTitle);
  close();
}

function toggleDevMode() {
  rememberDevMode(localStorage, devMode.toggle());
}

function abort() {
  close();
  emit("abort");
}

function onPointerDown(event: PointerEvent) {
  const target = event.target;
  if (root.value != null && target instanceof Node && root.value.contains(target)) {
    return;
  }
  close();
}

function onKeyDown(event: KeyboardEvent) {
  if (event.key === "Escape") {
    close();
  }
}
</script>

<template>
  <div ref="root" class="menu">
    <button
      class="btn btn-ghost gear"
      type="button"
      :aria-expanded="open"
      aria-haspopup="menu"
      :aria-label="locale.text(MessageKey.Settings)"
      @click="toggle"
    >
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path
          fill="none"
          stroke="currentColor"
          stroke-width="1.8"
          stroke-linecap="round"
          stroke-linejoin="round"
          d="M12 15.2a3.2 3.2 0 1 0 0-6.4 3.2 3.2 0 0 0 0 6.4Z"
        />
        <path
          fill="none"
          stroke="currentColor"
          stroke-width="1.8"
          stroke-linecap="round"
          stroke-linejoin="round"
          d="M19.4 13.5a7.7 7.7 0 0 0 .1-1.5 7.7 7.7 0 0 0-.1-1.5l2-1.6-2-3.4-2.4 1a7.6 7.6 0 0 0-2.6-1.5L14 2h-4l-.4 2.5a7.6 7.6 0 0 0-2.6 1.5l-2.4-1-2 3.4 2 1.6a7.7 7.7 0 0 0 0 3l-2 1.6 2 3.4 2.4-1a7.6 7.6 0 0 0 2.6 1.5L10 22h4l.4-2.5a7.6 7.6 0 0 0 2.6-1.5l2.4 1 2-3.4-2-1.6Z"
        />
      </svg>
    </button>
    <div v-if="open" class="panel" role="menu">
      <button
        v-if="showAbort"
        class="btn btn-danger item"
        type="button"
        role="menuitem"
        :disabled="abortPending"
        @click="abort"
      >
        {{ locale.text(MessageKey.AbortTable) }}
      </button>
      <div class="locales" role="group" :aria-label="locale.text(MessageKey.Language)">
        <button
          class="btn btn-ghost item"
          type="button"
          role="menuitemradio"
          :aria-checked="locale.locale === Locale.ZhTw"
          @click="chooseLocale(Locale.ZhTw)"
        >
          繁體中文
        </button>
        <button
          class="btn btn-ghost item"
          type="button"
          role="menuitemradio"
          :aria-checked="locale.locale === Locale.EnUs"
          @click="chooseLocale(Locale.EnUs)"
        >
          English
        </button>
      </div>
      <button
        class="btn btn-ghost item"
        type="button"
        role="menuitemcheckbox"
        :aria-checked="devMode.enabled"
        @click="toggleDevMode"
      >
        {{ locale.text(MessageKey.DevMode) }}
      </button>
    </div>
  </div>
</template>

<style scoped>
.menu {
  position: absolute;
  z-index: 8;
  right: 0.35rem;
  bottom: 0.35rem;
}

.gear {
  width: 2.75rem;
  padding: 0;
  background: rgb(6 32 20 / 0.82);
}

.gear svg {
  width: 1.35rem;
  height: 1.35rem;
}

.panel {
  position: absolute;
  right: 0;
  bottom: calc(100% + 0.35rem);
  display: grid;
  gap: var(--space-md);
  min-width: 11rem;
  padding: 0.55rem;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  background: rgb(6 32 20 / 0.96);
  box-shadow: var(--shadow-md);
}

.locales {
  display: grid;
  gap: var(--space-md);
}

.item {
  width: 100%;
  justify-content: flex-start;
}

.item[aria-checked="true"] {
  background: var(--color-accent);
  color: var(--color-on-accent);
  border-color: transparent;
}
</style>
