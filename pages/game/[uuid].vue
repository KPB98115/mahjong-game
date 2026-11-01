<script setup lang="ts">
import { type Props } from "./[uuid].server";
import { defineAsyncComponent, inject, onMounted, onUnmounted, reactive, ref, watchEffect } from "vue";
import { useRouter } from "@void/vue";
import { AuthLogic } from "../../src/logic/client/auth/authLogic";
import { useDevMode } from "../../src/logic/client/dev/useDevMode";
import { GamePageLogic } from "../../src/logic/client/game/gamePageLogic";
import { tableActionsKey } from "../../src/logic/client/game/tableActions";
import { GamesLogic } from "../../src/logic/client/game/gamesLogic";
import { ioSocketFactory } from "../../src/logic/client/game/ioSocketFactory";
import { SocketLogic } from "../../src/logic/client/game/socketLogic";
import { ApiClient } from "../../src/logic/client/http/apiClient";
import { useLocale } from "../../src/logic/client/locale/useLocale";
import { GamePanel } from "../../src/types/client/gamePanel";
import { GameStatus } from "../../src/types/server/gameStatus";
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
const devMode = useDevMode();
const tableActions = inject(tableActionsKey);

watchEffect(() => {
  pageLogic.play.useDevMode(devMode.enabled);
});

watchEffect(() => {
  if (tableActions == null) {
    return;
  }
  const status = pageLogic.snapshot?.game.status;
  const allowed = status === GameStatus.Waiting || status === GameStatus.InProgress;
  tableActions.abort = allowed ? abortGame : null;
  tableActions.pending = pageLogic.waiting.pending;
});

onMounted(async () => {
  await pageLogic.bootstrap();
  hydrated.value = true;
});

onUnmounted(() => {
  if (tableActions != null) {
    tableActions.abort = null;
    tableActions.pending = false;
  }
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

function discardHandTile(tileId: string) {
  pageLogic.discardTile(tileId);
}

function claimMeld(kind: MeldType, tileIds: string[]) {
  pageLogic.claim(kind, tileIds);
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
  <main class="game-page" :class="{ playing: pageLogic.panel === GamePanel.Play }">
    <header v-if="pageLogic.panel !== GamePanel.Play" class="hero">
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
      />
      <PlayTable
        v-else-if="pageLogic.panel === GamePanel.Play"
        :snapshot="pageLogic.snapshot"
        :play="pageLogic.play"
        @toggle-tile="toggleTile"
        @draw="drawTile"
        @discard="discardTile"
        @discard-tile="discardHandTile"
        @claim="claimMeld"
        @pass="passClaim"
        @win="declareWin"
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
  gap: 0.4cqh;
  padding: 0 1.2cqw 0.6cqh;
}

.game-page.playing {
  grid-template-rows: minmax(0, 1fr);
  padding: 0;
}

.game-page > section {
  min-height: 0;
}

.hero {
  position: relative;
  display: flex;
  align-items: baseline;
  min-height: 0;
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
</style>
