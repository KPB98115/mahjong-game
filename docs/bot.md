# Bot Players

A three-difficulty bot player implemented as pure server-side logic. Bots integrate with `RoundsLogic` in-process (no Socket.IO or HTTP required) for integration tests, and with the socket server’s **`BotDriver`** when filling seats at a live table.

## Files

| File | Role |
| --- | --- |
| `src/types/server/botDifficulty.ts` | `BotDifficulty` enum (`low`, `medium`, `smart`) |
| `src/logic/server/game/bot/botPlayer.ts` | Decision logic: types + `chooseTurnAction` + `chooseClaimAction` |
| `src/logic/server/game/bot/botContext.ts` | Builds `BotContext` from repos |
| `socket-server/src/logic/server/botDriver.ts` | After each play action (and on `joinGame` / `gameChanged`), plays the current bot seat |
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

## Socket server (`BotDriver`)

`POST /api/games/:gameId/bot` seats a bot (`seats.bot_difficulty`). The fourth seat starts the round on the Void HTTP process. Bots have no browser socket, so **`BotDriver`** in `socket-server` must play their turns.

`PlayActions` calls `kickBots` after every committed play action, after Redis `gameChanged` (HTTP deal / add-bot), and when a human **`joinGame`s**. That last kick matters: the HTTP deal auto-draws for the dealer, then nothing else happens until someone joins the socket room.

The running Socket.IO process must be built from this repo (`docker compose up -d --build socket-server`, or `npm run socket:dev`). An old image on `:3001` can accept tickets and still never discard for a bot.

`BotDriver` uses the same `chooseTurnAction` / `chooseClaimAction` as the in-process script, through `GameActionQueue` and `PlayActions`.
