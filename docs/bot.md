# Bot Players

A three-difficulty bot player implemented as pure server-side logic. Bots integrate with `RoundsLogic` in-process (no Socket.IO or HTTP required), making them usable for integration testing and — with a future socket-server adapter — for filling empty seats in real games.

## Files

| File | Role |
| --- | --- |
| `src/types/server/botDifficulty.ts` | `BotDifficulty` enum (`low`, `medium`, `smart`) |
| `src/logic/server/game/bot/botPlayer.ts` | Decision logic: types + `chooseTurnAction` + `chooseClaimAction` |
| `scripts/playBotHand.ts` | Integration script (two scenarios; in-memory, no DB) |
| `scripts/tsconfig.json` | tsx path aliases (`void/db` → `scripts/shims/voidDb.ts`) |
| `scripts/shims/voidDb.ts` | Void runtime shim for script use |

---

## BotContext

Assembled by the caller before each decision. All fields are read from repos; the bot itself is pure.

```ts
type BotContext = {
  hand: HandTileRow[];         // concealed tiles (id, tileCode, isDrawn)
  exposedMelds: ExposedMeld[]; // committed melds (meldType, isConcealed, tileCodes)
  discardCode: string | null;  // tile being claimed; null on the bot's own discard turn
  discardSeatIndex: number | null;
  seatIndex: number;
  dealerSeatIndex: number;
  winMeldCount: number;
  chowOnlyFromPrevious: boolean;
  bonusTilesEnabled: boolean;
  prevailingWind: PrevailingWind;
  flowerCodes: string[];
  chart: ScoringChart;         // from scoringChartFor(game.ruleset, game.scoringVersion)
  wallEmpty: boolean;
  isRobKong: boolean;
};
```

Build it from the repos:

```ts
const meldRows = await meldsRepo.findByRoundIdAndSeatIndex(round.id, seatIndex);
const exposedMelds = await Promise.all(
  meldRows.map(async (meld) => {
    const tiles = await meldTilesRepo.findByMeldId(meld.id);
    return { meldType: meld.meldType, isConcealed: meld.isConcealed, tileCodes: tiles.map(t => t.tileCode) };
  }),
);
const flowers = await flowerTilesRepo.findByRoundIdAndSeatIndex(round.id, seatIndex);
const wall    = await wallTilesRepo.findByRoundId(round.id);
const chart   = scoringChartFor(game.ruleset, game.scoringVersion);
```

---

## Exported API

### `chooseTurnAction(context, difficulty): BotTurnAction`

Called when `phase === RoundPhase.Discard` and it is the bot's turn.

```ts
type BotTurnAction =
  | { action: "win" }
  | { action: "discard"; tileId: string };
```

If the action is `"win"`, the caller should call `RoundsLogic.declareWin`. If the server rejects it, fall back to discarding the drawn tile.

### `chooseClaimAction(context, difficulty): BotClaimAction`

Called when `phase === RoundPhase.Claim` or `RoundPhase.RobKong` for every non-discarder seat.

```ts
type BotClaimAction =
  | { action: "win" }
  | { action: "claim"; kind: MeldType; tileIds: string[] }
  | { action: "pass" };
```

`tileIds` are the IDs of tiles in the bot's **concealed hand** that combine with the discarded tile to form the meld (2 for chow, 2 for pong, 3 for kong).

---

## Difficulty Levels

### Low

| Phase | Behaviour |
| --- | --- |
| Discard | Always discard the drawn tile (`isDrawn === true`); fallback to last tile. |
| Claim window | Always pass. |

Low bots never win off a discard and never declare a self-draw win. A game with four Low bots always ends on an empty wall (exhaustive draw).

### Medium

| Phase | Behaviour |
| --- | --- |
| Discard | Win by self-draw if the hand is complete. Otherwise prefer discarding isolated (count = 1) tiles — honors first, then suited. Fallback: drawn tile. |
| Claim window | Pong or kong if the discard matches 2 or 3 tiles in hand. Never declares win off a discard. |

### Smart

| Phase | Behaviour |
| --- | --- |
| Discard | Win by self-draw if `evaluateWin` returns a score. Otherwise pick the discard that maximises the remaining hand's set-strength score (greedy pong-then-chow count × 3 + pair count). |
| Claim window | Declares win first (via `evaluateWin` with `discardCode` added to the concealed hand). Then pong/kong if matching tiles exist. Then chow if `chowOnlyFromPrevious` permits. Otherwise pass. During `robKong`, only win or pass are valid. |

**Set-strength score** used by Smart's discard picker:

```
1. Extract pongs greedily (sorted by tileCode).
2. Extract chows greedily.
3. score = sets × 3 + remaining_pairs
```

This is a heuristic, not an optimal search, but reliably outperforms Medium.

---

## Integration Script

`scripts/playBotHand.ts` runs two scenarios in-memory with no external services.

```
npm run bot:play
```

Under the hood: `tsx --tsconfig scripts/tsconfig.json scripts/playBotHand.ts`

The `scripts/tsconfig.json` overrides the `void/db` path alias to `scripts/shims/voidDb.ts` so tsx can resolve it without a live Void runtime. All game state is in-memory via `createPlayWorld`.

### Scenario 1 — Deterministic Win

```
wall: { hands: [["man_1","man_2","man_3","man_4","man_5","man_6","east"]], draws: ["east"] }
ruleset: hongKong, handTileCount: 7, winMeldCount: 2, dealerSeatIndex: 0
```

Seat 0 is dealt two chows and a lone east tile. `autoDraw=true` immediately draws the second east as the first wall tile, giving seat 0 a complete winning hand (two chows + east pair) before the first discard. The Smart bot detects this via `evaluateWin` and calls `declareWin`.

Expected: seat 0 wins on turn 1.

### Scenario 2 — Random Play to Completion

```
ruleset: hongKong, four Low bots, no stacked wall
```

Low bots discard the drawn tile and pass every claim window. No one ever wins off a discard. The game ends when the wall is empty (result: `draw`).

Expected: game completes within 300 turns.

---

## Future: Socket Server Integration

To expose bots as a real feature (player selects "fill with bots" when creating a game) the following additions are needed:

**1. Data model** — store bot difficulty per seat, for example:

```sql
ALTER TABLE game.seats ADD COLUMN bot_difficulty text;  -- null = human
```

Or a new `game.bot_seats` table keyed on `(game_id, seat_index)` with a `difficulty` column.

**2. API** — extend `POST /api/games` body to accept `{ botSeats: { seatIndex: number, difficulty: BotDifficulty }[] }` and pre-fill those seats with bot user-rows.

**3. Socket server adapter** — after each `PlayOutcome` that contains a `turn` or `drew` emit, check if `nextSeat` is a bot seat. If so, enqueue a bot action through `GameActionQueue`:

```ts
// Pseudocode in PlayActions.perform (after emit)
if (isBotSeat(nextSeatIndex)) {
  queue.enqueue(gameId, async () => {
    const context = await buildBotContext(repos, gameId, nextSeatIndex, ...);
    const action = chooseTurnAction(context, difficulty);
    await playActions.perform(gameId, botUserId, action);
  });
}
```

The same `chooseTurnAction` / `chooseClaimAction` functions are used unchanged; only the surrounding I/O (repo reads, queue) lives in the socket server.

**4. Claim window** — when a discard opens a claim window, iterate bot seats and enqueue their `chooseClaimAction` results immediately (or after a short artificial delay for realism).
