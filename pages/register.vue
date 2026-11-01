<script setup lang="ts">
import { type Props } from "./register.server";
import { defineAsyncComponent, onMounted, reactive, ref } from "vue";
import { useRouter } from "@void/vue";
import { AuthLogic } from "../src/logic/client/auth/authLogic";
import { GamesLogic } from "../src/logic/client/game/gamesLogic";
import { ApiClient } from "../src/logic/client/http/apiClient";
import { useLocale } from "../src/logic/client/locale/useLocale";
import { RegisterLogic } from "../src/logic/client/register/registerLogic";
import { MessageKey } from "../src/types/client/messageKey";
import { RegisterTab } from "../src/types/client/registerTab";

const props = defineProps<Props>();
const router = useRouter();
const locale = useLocale();
const DisplayNameForm = defineAsyncComponent(
  () => import("../src/component/register/displayNameForm.vue"),
);
const CreateGameForm = defineAsyncComponent(
  () => import("../src/component/register/createGameForm.vue"),
);
const JoinGameForm = defineAsyncComponent(
  () => import("../src/component/register/joinGameForm.vue"),
);
const api = new ApiClient();
const logic = reactive(
  new RegisterLogic(
    new AuthLogic(api),
    new GamesLogic(api),
    {
      visit(path) {
        router.visit(path);
      },
    },
    props.defaults,
  ),
);
const homeKey = "home";
const endKey = "end";
const arrowLeftKey = "arrowleft";
const arrowRightKey = "arrowright";
const hydrated = ref(false);
const tableTab = ref(RegisterTab.Create);
const createTabButton = ref<HTMLButtonElement | null>(null);
const joinTabButton = ref<HTMLButtonElement | null>(null);

onMounted(async () => {
  await logic.bootstrap();
  hydrated.value = true;
});

function saveDisplayName() {
  return logic.saveDisplayName();
}

function createGame() {
  return logic.create();
}

function joinGame() {
  return logic.join();
}

function showTableTab(tab: RegisterTab) {
  tableTab.value = tab;
}

function moveTableTab(event: KeyboardEvent) {
  const next = tableTabAfterKey(tableTab.value, event.key);
  if (next == null) {
    return;
  }
  event.preventDefault();
  tableTab.value = next;
  const button = next === RegisterTab.Create ? createTabButton.value : joinTabButton.value;
  button?.focus();
}

function tableTabAfterKey(current: RegisterTab, key: string): RegisterTab | undefined {
  const normalizedKey = key.toLowerCase();
  if (normalizedKey === homeKey) {
    return RegisterTab.Create;
  }
  if (normalizedKey === endKey) {
    return RegisterTab.Join;
  }
  if (normalizedKey !== arrowLeftKey && normalizedKey !== arrowRightKey) {
    return undefined;
  }
  return current === RegisterTab.Create ? RegisterTab.Join : RegisterTab.Create;
}
</script>

<template>
  <main class="register-page">
    <header class="hero">
      <p class="kicker">{{ locale.text(MessageKey.HongKongAndTaiwan) }}</p>
      <h1>{{ locale.text(MessageKey.AppTitle) }}</h1>
      <p class="lead">{{ locale.text(MessageKey.ChooseNameLead) }}</p>
    </header>
    <p v-if="!hydrated" class="status" aria-live="polite">
      {{ locale.text(MessageKey.OpeningLobby) }}
    </p>
    <section v-else class="stage">
      <DisplayNameForm
        v-if="!logic.hasDisplayName"
        :model="logic.register"
        @submit="saveDisplayName"
      />
      <div v-else class="tables">
        <div class="tablist" role="tablist" @keydown="moveTableTab">
          <button
            id="create-table-tab"
            ref="createTabButton"
            type="button"
            class="tab"
            role="tab"
            :aria-selected="tableTab === RegisterTab.Create"
            :tabindex="tableTab === RegisterTab.Create ? 0 : -1"
            aria-controls="create-table-panel"
            @click="showTableTab(RegisterTab.Create)"
          >
            {{ locale.text(MessageKey.CreateTable) }}
          </button>
          <button
            id="join-table-tab"
            ref="joinTabButton"
            type="button"
            class="tab"
            role="tab"
            :aria-selected="tableTab === RegisterTab.Join"
            :tabindex="tableTab === RegisterTab.Join ? 0 : -1"
            aria-controls="join-table-panel"
            @click="showTableTab(RegisterTab.Join)"
          >
            {{ locale.text(MessageKey.JoinTable) }}
          </button>
        </div>
        <div
          v-if="tableTab === RegisterTab.Create"
          id="create-table-panel"
          class="tab-panel"
          role="tabpanel"
          aria-labelledby="create-table-tab"
        >
          <CreateGameForm
            :model="logic.createGame"
            :rulesets="rulesets"
            :claim-window-ms-options="claimWindowMsOptions"
            :score-units="scoreUnits"
            :discard-win-payers="discardWinPayers"
            :pending="logic.register.pending"
            :error="logic.register.error"
            @submit="createGame"
          />
        </div>
        <div
          v-else
          id="join-table-panel"
          class="tab-panel"
          role="tabpanel"
          aria-labelledby="join-table-tab"
        >
          <JoinGameForm
            :model="logic.joinGame"
            :pending="logic.register.pending"
            @submit="joinGame"
          />
        </div>
      </div>
    </section>
  </main>
</template>

<style scoped>
.register-page {
  display: grid;
  grid-template-rows: auto minmax(0, 1fr);
  gap: 1.2cqh;
  padding: 0.4cqh 3.8rem 1.5cqh 2cqw;
}

.hero {
  position: relative;
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 0.4cqh 1.2cqw;
}

.hero h1 {
  position: absolute;
  width: 1px;
  height: 1px;
  margin: -1px;
  padding: 0;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}

.kicker {
  color: var(--color-accent);
  font-size: clamp(0.8rem, 2.6cqh, 0.95rem);
  font-weight: 700;
  letter-spacing: 0.14em;
  text-transform: uppercase;
}

.lead {
  flex: 1 1 12rem;
  color: var(--color-muted-foreground);
  font-size: clamp(0.85rem, 2.8cqh, 1rem);
}

.stage,
.tables {
  min-height: 0;
}

.stage {
  display: grid;
}

.tables {
  display: grid;
  grid-template-rows: auto minmax(0, 1fr);
  gap: 1cqh;
}

.tablist {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.6cqw;
  padding: 0.35cqh;
  background: rgb(7 32 20 / 0.55);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
}

.tab {
  min-height: var(--target-min);
  margin: 0;
  padding: 0 0.8cqw;
  border: 0;
  border-radius: var(--radius-md);
  background: transparent;
  color: var(--color-muted-foreground);
  font: inherit;
  font-size: clamp(0.95rem, 3.2cqh, 1.1rem);
  font-weight: 700;
}

.tab[aria-selected="true"] {
  background: var(--color-accent);
  color: var(--color-on-accent);
}

.tab-panel {
  min-height: 0;
  display: grid;
}
</style>
