<script setup lang="ts">
import { type Props } from "./[uuid].server";
import { defineAsyncComponent, onMounted, onUnmounted, reactive, ref } from "vue";
import { useRouter } from "@void/vue";
import { AuthLogic } from "../../src/logic/client/auth/authLogic";
import { GamePageLogic } from "../../src/logic/client/game/gamePageLogic";
import { GamesLogic } from "../../src/logic/client/game/gamesLogic";
import { ioSocketFactory } from "../../src/logic/client/game/ioSocketFactory";
import { SocketLogic } from "../../src/logic/client/game/socketLogic";
import { ApiClient } from "../../src/logic/client/http/apiClient";
import { useLocale } from "../../src/logic/client/locale/useLocale";
import { GamePanel } from "../../src/types/client/gamePanel";
import { MessageKey } from "../../src/types/client/messageKey";
import { type MeldType } from "../../src/types/server/meldType";

const props = defineProps<Props>();
const router = useRouter();
const locale = useLocale();
const WaitingTable = defineAsyncComponent(
  () => import("../../src/component/game/waitingTable.vue"),
);
const PlayTable = defineAsyncComponent(() => import("../../src/component/game/playTable.vue"));
const RoundResult = defineAsyncComponent(() => import("../../src/component/game/roundResult.vue"));
const api = new ApiClient();
const auth = new AuthLogic(api);
const games = new GamesLogic(api);
let pageLogic: GamePageLogic;
const socket = new SocketLogic(
  props.socketOrigin,
  {
    onJoined(payload) {
      pageLogic.onJoined(payload.gameId);
    },
    onPublicState(payload) {
      pageLogic.applyPublicState(payload);
    },
    onPresence(payload) {
      pageLogic.applyPresence(payload.seatIndex, payload.connected);
    },
    onGameAborted() {
      pageLogic.onGameAborted();
    },
    onSelfHand(payload) {
      pageLogic.applySelfHand(payload);
    },
    onDrew(payload) {
      pageLogic.applyDrew(payload);
    },
    onDiscarded(payload) {
      pageLogic.applyDiscarded(payload);
    },
    onClaimWindow(payload) {
      pageLogic.applyClaimWindow(payload);
    },
    onClaimed(payload) {
      pageLogic.applyClaimed(payload);
    },
    onTurn(payload) {
      pageLogic.applyTurn(payload);
    },
    onRoundEnded(payload) {
      pageLogic.applyRoundEnded(payload);
    },
    onActionError(payload) {
      pageLogic.applyActionError(payload);
    },
  },
  ioSocketFactory,
);
pageLogic = reactive(
  new GamePageLogic(
    props.uuid,
    auth,
    games,
    {
      visit(path) {
        router.visit(path);
      },
    },
    socket,
  ),
);
const hydrated = ref(false);

onMounted(async () => {
  await pageLogic.bootstrap();
  hydrated.value = true;
});

onUnmounted(() => {
  pageLogic.play.release();
});

function markCopied() {
  pageLogic.markCodeCopied();
}

function addBot() {
  return pageLogic.addBot();
}

function abortGame() {
  return pageLogic.abort();
}

function toggleTile(tileId: string) {
  pageLogic.play.toggleTile(tileId);
}

function drawTile() {
  pageLogic.draw();
}

function discardTile() {
  pageLogic.discard();
}

function claimMeld(kind: MeldType) {
  pageLogic.claim(kind);
}

function passClaim() {
  pageLogic.passClaim();
}

function declareWin() {
  pageLogic.declareWin();
}

function agreeNextWind() {
  return pageLogic.agreeNextWind();
}
</script>

<template>
  <main class="game-page">
    <header class="hero">
      <p class="kicker">{{ locale.text(MessageKey.LiveTable) }}</p>
      <h1>{{ locale.text(MessageKey.AppTitle) }}</h1>
    </header>
    <p v-if="!hydrated" class="status" aria-live="polite">
      {{ locale.text(MessageKey.OpeningTable) }}
    </p>
    <section v-else-if="pageLogic.snapshot">
      <WaitingTable
        v-if="pageLogic.panel === GamePanel.Waiting"
        :snapshot="pageLogic.snapshot"
        :model="pageLogic.waiting"
        @copied="markCopied"
        @add-bot="addBot"
        @abort="abortGame"
      />
      <PlayTable
        v-else-if="pageLogic.panel === GamePanel.Play"
        :snapshot="pageLogic.snapshot"
        :play="pageLogic.play"
        @toggle-tile="toggleTile"
        @draw="drawTile"
        @discard="discardTile"
        @claim="claimMeld"
        @pass="passClaim"
        @win="declareWin"
        @abort="abortGame"
      />
      <RoundResult
        v-else-if="pageLogic.panel === GamePanel.Result && pageLogic.scoreboard"
        :snapshot="pageLogic.snapshot"
        :scoreboard="pageLogic.scoreboard"
        :model="pageLogic.result"
        @next-wind="agreeNextWind"
      />
    </section>
  </main>
</template>

<style scoped>
.game-page {
  display: grid;
  grid-template-rows: auto minmax(0, 1fr);
  gap: 1cqh;
  padding: 0 2cqw 1.5cqh;
}

.game-page > section {
  min-height: 0;
}

.hero {
  display: grid;
  gap: 0.3cqh;
}

.kicker {
  color: var(--color-accent);
  font-size: 1.8cqh;
  font-weight: 700;
  letter-spacing: 0.14em;
  text-transform: uppercase;
}
</style>
