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
const hydrated = ref(false);

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
</script>

<template>
  <main class="register-page">
    <header class="hero">
      <p class="kicker">{{ locale.text(MessageKey.HongKongAndTaiwan) }}</p>
      <h1>{{ locale.text(MessageKey.AppTitle) }}</h1>
      <p>{{ locale.text(MessageKey.ChooseNameLead) }}</p>
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
        <JoinGameForm
          :model="logic.joinGame"
          :pending="logic.register.pending"
          @submit="joinGame"
        />
      </div>
    </section>
  </main>
</template>

<style scoped>
.register-page {
  display: grid;
  grid-template-rows: auto minmax(0, 1fr);
  gap: 1.2cqh;
  padding: 0 2cqw 1.5cqh;
}

.hero {
  display: grid;
  gap: 0.4cqh;
}

.kicker {
  color: var(--color-accent);
  font-size: 1.8cqh;
  font-weight: 700;
  letter-spacing: 0.14em;
  text-transform: uppercase;
}

.hero p:last-child {
  color: var(--color-muted-foreground);
  font-size: 2.2cqh;
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
  grid-template-columns: minmax(0, 1.15fr) minmax(0, 0.85fr);
  gap: 2cqw;
}
</style>
