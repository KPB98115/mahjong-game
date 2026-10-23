import { type SnapshotRepos } from "@app/logic/server/game/loadGameSnapshot";
import { type RoundsLogic } from "@app/logic/server/game/roundsLogic";
import { BotDriver } from "./botDriver.js";
import { ClaimWindowCoordinator } from "./claimWindowCoordinator.js";
import { GameActionQueue } from "./gameActionQueue.js";
import { type Clock, type GameServer, type Scheduler } from "./gameSocket.js";
import { ClaimHandler } from "./handler/claimHandler.js";
import { DeclareWinHandler } from "./handler/declareWinHandler.js";
import { DisconnectHandler } from "./handler/disconnectHandler.js";
import { DiscardHandler } from "./handler/discardHandler.js";
import { DrawHandler } from "./handler/drawHandler.js";
import { GameFanoutHandler } from "./handler/gameFanoutHandler.js";
import { JoinGameHandler } from "./handler/joinGameHandler.js";
import { PassClaimHandler } from "./handler/passClaimHandler.js";
import { PingHandler } from "./handler/pingHandler.js";
import { SocketAuthHandler, type TakeTicket } from "./handler/socketAuthHandler.js";
import { PlayActions } from "./playActions.js";
import { PlayEmitter } from "./playEmitter.js";

export type SocketHandlerDeps = {
  roundsLogic: RoundsLogic;
  repos: SnapshotRepos;
  server: GameServer;
  localServer: GameServer;
  scheduler: Scheduler;
  clock: Clock;
  takeTicket: TakeTicket;
};

export type SocketHandlers = {
  auth: SocketAuthHandler;
  ping: PingHandler;
  joinGame: JoinGameHandler;
  draw: DrawHandler;
  discard: DiscardHandler;
  claim: ClaimHandler;
  passClaim: PassClaimHandler;
  declareWin: DeclareWinHandler;
  disconnect: DisconnectHandler;
  fanout: GameFanoutHandler;
  coordinator: ClaimWindowCoordinator;
};

export function createSocketHandlers(deps: SocketHandlerDeps): SocketHandlers {
  const { roundsLogic, repos, server, clock } = deps;
  const queue = new GameActionQueue();
  const emitter = new PlayEmitter(server);
  // advanceBots and actions are forward-referenced via closures; assign after construction.
  let advanceBots: (gameId: string) => void = () => undefined;
  const coordinator: ClaimWindowCoordinator = new ClaimWindowCoordinator(deps.scheduler, (gameId) =>
    actions.perform(undefined, gameId, () => roundsLogic.passUnanswered({ gameId, now: clock() })),
  );
  const actions = new PlayActions(queue, emitter, coordinator, clock, (gameId) =>
    advanceBots(gameId),
  );
  const botDriver = new BotDriver(repos, roundsLogic, actions, clock);
  advanceBots = (gameId: string): void => {
    void botDriver.advance(gameId).catch((e) => console.error(e));
  };
  const joinGame = new JoinGameHandler(roundsLogic, actions, emitter, coordinator);
  return {
    auth: new SocketAuthHandler(deps.takeTicket),
    ping: new PingHandler(),
    joinGame,
    draw: new DrawHandler(roundsLogic, actions),
    discard: new DiscardHandler(roundsLogic, actions),
    claim: new ClaimHandler(roundsLogic, actions),
    passClaim: new PassClaimHandler(roundsLogic, actions),
    declareWin: new DeclareWinHandler(roundsLogic, actions),
    disconnect: new DisconnectHandler(server, emitter),
    fanout: new GameFanoutHandler(
      deps.localServer,
      roundsLogic,
      new PlayEmitter(deps.localServer),
      coordinator,
      joinGame,
      advanceBots,
    ),
    coordinator,
  };
}
