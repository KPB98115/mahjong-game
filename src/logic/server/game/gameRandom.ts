export type GameRandom = {
  referenceCode(): string;
  dealerSeatIndex(): number;
  shuffle<T>(items: T[]): T[];
};

export function defaultGameRandom(): GameRandom {
  return {
    referenceCode() {
      const bytes = new Uint32Array(1);
      crypto.getRandomValues(bytes);
      const value = (bytes[0] ?? 0) % 100000;
      return value.toString().padStart(5, "0");
    },
    dealerSeatIndex() {
      const bytes = new Uint8Array(1);
      crypto.getRandomValues(bytes);
      return (bytes[0] ?? 0) % 4;
    },
    shuffle(items) {
      const copy = items.slice();
      for (let index = copy.length - 1; index > 0; index -= 1) {
        const bytes = new Uint32Array(1);
        crypto.getRandomValues(bytes);
        const swapIndex = (bytes[0] ?? 0) % (index + 1);
        const current = copy[index];
        const swapped = copy[swapIndex];
        if (current === undefined || swapped === undefined) {
          throw new Error("shuffle index is missing");
        }
        copy[index] = swapped;
        copy[swapIndex] = current;
      }
      return copy;
    },
  };
}
