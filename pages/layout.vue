<script setup lang="ts">
import { onMounted, provide, reactive } from "vue";
import { LocaleLogic, rememberLocale, storedLocale } from "../src/logic/client/locale/localeLogic";
import { localeStateKey } from "../src/logic/client/locale/useLocale";
import { registerServiceWorker } from "../src/logic/client/pwa/registerServiceWorker";
import { Locale } from "../src/types/client/locale";
import { MessageKey } from "../src/types/client/messageKey";
import "../src/static/theme.css";

const locale = reactive(new LocaleLogic());
provide(localeStateKey, locale);

onMounted(() => {
  locale.bootstrap(storedLocale(localStorage));
  applyDocumentLocale();
  registerServiceWorker(navigator.serviceWorker);
});

function chooseLocale(next: Locale) {
  locale.choose(next);
  rememberLocale(localStorage, next);
  applyDocumentLocale();
}

function applyDocumentLocale() {
  document.documentElement.lang = locale.locale;
  document.title = locale.text(MessageKey.AppTitle);
}
</script>

<template>
  <div class="app-shell">
    <div class="app-frame">
      <header class="app-bar">
        <p class="app-mark">{{ locale.text(MessageKey.AppTitle) }}</p>
        <div class="locale-switch" role="group" :aria-label="locale.text(MessageKey.Language)">
          <button
            type="button"
            class="btn btn-ghost locale-option"
            :aria-pressed="locale.locale === Locale.ZhTw"
            @click="chooseLocale(Locale.ZhTw)"
          >
            繁體中文
          </button>
          <button
            type="button"
            class="btn btn-ghost locale-option"
            :aria-pressed="locale.locale === Locale.EnUs"
            @click="chooseLocale(Locale.EnUs)"
          >
            English
          </button>
        </div>
      </header>
      <div class="app-stage">
        <slot />
      </div>
    </div>
    <p class="rotate-gate" role="status">{{ locale.text(MessageKey.RotateToLandscape) }}</p>
  </div>
</template>
