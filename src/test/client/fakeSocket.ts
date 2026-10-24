export class FakeGameSocket {
  connects: { ticket: string; gameId: string }[] = [];
  disconnected = 0;

  async connect(ticket: string, gameId: string): Promise<void> {
    this.connects.push({ ticket, gameId });
  }

  disconnect(): void {
    this.disconnected += 1;
  }

  draw(): void {}

  discard(): void {}

  claim(): void {}

  passClaim(): void {}

  declareWin(): void {}
}
