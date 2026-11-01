<script setup lang="ts">
import { onMounted, provide, reactive } from "vue";
import TableMenu from "../src/component/game/tableMenu.vue";
import { DevModeLogic, storedDevMode } from "../src/logic/client/dev/devModeLogic";
import { devModeStateKey } from "../src/logic/client/dev/useDevMode";
import { tableActionsKey, type TableActions } from "../src/logic/client/game/tableActions";
import { LocaleLogic, storedLocale } from "../src/logic/client/locale/localeLogic";
import { localeStateKey } from "../src/logic/client/locale/useLocale";
import { registerServiceWorker } from "../src/logic/client/pwa/registerServiceWorker";
import { MessageKey } from "../src/types/client/messageKey";
import "../src/static/theme.css";

const locale = reactive(new LocaleLogic());
const devMode = reactive(new DevModeLogic());
const tableActions = reactive<TableActions>({ abort: null, pending: false });
provide(localeStateKey, locale);
provide(devModeStateKey, devMode);
provide(tableActionsKey, tableActions);

onMounted(() => {
  devMode.load(storedDevMode(localStorage));
  locale.bootstrap(storedLocale(localStorage));
  applyDocumentLocale();
  registerServiceWorker(navigator.serviceWorker);
});

function applyDocumentLocale() {
  document.documentElement.lang = locale.locale;
  document.title = locale.text(MessageKey.AppTitle);
}

function abortTable() {
  tableActions.abort?.();
}
</script>

<template>
  <div class="app-shell">
    <div class="app-frame">
      <div class="app-stage">
        <slot />
      </div>
      <TableMenu
        :show-abort="tableActions.abort != null"
        :abort-pending="tableActions.pending"
        @abort="abortTable"
      />
    </div>
    <p class="rotate-gate" role="status">{{ locale.text(MessageKey.RotateToLandscape) }}</p>
  </div>
</template>
