export class GameActionQueue {
  private tails = new Map<string, Promise<void>>();

  run<T>(gameId: string, work: () => Promise<T>): Promise<T> {
    const previous = this.tails.get(gameId) ?? Promise.resolve();
    const result = previous.then(work);
    const tail = result.then(
      () => undefined,
      () => undefined,
    );
    this.tails.set(gameId, tail);
    void tail.then(() => {
      if (this.tails.get(gameId) === tail) {
        this.tails.delete(gameId);
      }
    });
    return result;
  }
}
