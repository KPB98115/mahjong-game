import { type PlayResult } from "@app/model/server/playResult";
import { SocketEvent } from "@app/types/server/socketEvent";
import { type Scheduler, type TimerHandle } from "./gameSocket.js";

const closingEvents = new Set<SocketEvent>([
  SocketEvent.Turn,
  SocketEvent.Claimed,
  SocketEvent.RoundEnded,
]);

export class ClaimWindowCoordinator {
  private timers = new Map<string, TimerHandle>();
  private running = new Set<Promise<void>>();

  constructor(
    private schedule: Scheduler,
    private onTimeout: (gameId: string) => Promise<void>,
  ) {}

  open(gameId: string, timeoutMs: number | null): void {
    this.cancel(gameId);
    if (timeoutMs == null) {
      return;
    }
    const handle = this.schedule(() => {
      this.timers.delete(gameId);
      const run = this.onTimeout(gameId).finally(() => {
        this.running.delete(run);
      });
      this.running.add(run);
    }, timeoutMs);
    this.timers.set(gameId, handle);
  }

  cancel(gameId: string): void {
    this.timers.get(gameId)?.cancel();
    this.timers.delete(gameId);
  }

  isOpen(gameId: string): boolean {
    return this.timers.has(gameId);
  }

  sync(result: PlayResult): void {
    for (const emit of result.emits) {
      if (emit.event === SocketEvent.ClaimWindow) {
        this.open(result.gameId, emit.payload.timeoutMs);
        return;
      }
    }
    if (result.emits.some((emit) => closingEvents.has(emit.event))) {
      this.cancel(result.gameId);
    }
  }

  async settled(): Promise<void> {
    await Promise.all(this.running);
  }
}
