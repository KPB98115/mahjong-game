# Game tables: repos and logic (planning)

Not implemented. Table definitions: [`docs/database.md`](database.md). HTTP: [`docs/api.md`](api.md). Socket events: [`docs/socket.md`](socket.md). Auth layering: [`docs/auth.md`](auth.md). Enums / request whitelist: [`docs/types.md`](types.md).

Same split as auth/user: **one repo class and one logic class per `game.*` table**.

**No business logic in a repo.** A repo only inserts, finds, updates, and deletes rows for its table (optional transaction). It does not validate, score, pick dealers, move tiles between meanings, decide status/`phase`, or know claim-window / auto-draw / chow rules. It does not call logic classes, other repos, or Redis.

Logic classes own rules for that table and may call sibling **logic** when that table’s rules apply, or any **repo** for raw I/O. No SQL inside logic.

Redis round/hand cache is not a repo (same as session cache). Play still writes **Postgres first**, then cache, then broadcast.

Classes live under `src/logic/server/game/`. File names are camelCase; class names are PascalCase from the table name.

---

## Pair per table (locked)

| Table | Repo | Logic | Files |
| --- | --- | --- | --- |
| `game.games` | `GamesRepo` | `GamesLogic` | `gamesRepo.ts`, `gamesLogic.ts` |
| `game.seats` | `SeatsRepo` | `SeatsLogic` | `seatsRepo.ts`, `seatsLogic.ts` |
| `game.rounds` | `RoundsRepo` | `RoundsLogic` | `roundsRepo.ts`, `roundsLogic.ts` |
| `game.hands` | `HandsRepo` | `HandsLogic` | `handsRepo.ts`, `handsLogic.ts` |
| `game.hand_tiles` | `HandTilesRepo` | `HandTilesLogic` | `handTilesRepo.ts`, `handTilesLogic.ts` |
| `game.wall_tiles` | `WallTilesRepo` | `WallTilesLogic` | `wallTilesRepo.ts`, `wallTilesLogic.ts` |
| `game.discard_tiles` | `DiscardTilesRepo` | `DiscardTilesLogic` | `discardTilesRepo.ts`, `discardTilesLogic.ts` |
| `game.flower_tiles` | `FlowerTilesRepo` | `FlowerTilesLogic` | `flowerTilesRepo.ts`, `flowerTilesLogic.ts` |
| `game.melds` | `MeldsRepo` | `MeldsLogic` | `meldsRepo.ts`, `meldsLogic.ts` |
| `game.meld_tiles` | `MeldTilesRepo` | `MeldTilesLogic` | `meldTilesRepo.ts`, `meldTilesLogic.ts` |
| `game.round_scores` | `RoundScoresRepo` | `RoundScoresLogic` | `roundScoresRepo.ts`, `roundScoresLogic.ts` |
| `game.score_payments` | `ScorePaymentsRepo` | `ScorePaymentsLogic` | `scorePaymentsRepo.ts`, `scorePaymentsLogic.ts` |

There is no `game.sittings` table and no sitting repo.

---

## Repo methods (locked)

I/O only. Optional `tx` on every method so `*Logic` can share one transaction. Repos accept/return **camelCase** fields and TypeScript enums. Drizzle turns those into snake_case SQL **before the query is sent**. Repos do not map strings by hand and do not interpret min/max wall as draw vs tail.

No `exists…` helpers that encode rules. Callers use `find*` and treat missing as empty.

### `GamesRepo`

| Method | I/O |
| --- | --- |
| `insert` | `INSERT` `game.games` |
| `findById` | `SELECT` by `id` |
| `findByReferenceCode` | `SELECT` by `reference_code` |
| `update` | `UPDATE` columns the caller passes (`status`, `completedAt`, `updatedAt`, …) |
| `delete` | `DELETE` by `id` (CASCADE children) |
| `listCompletedBefore` | `SELECT` where `completed_at` is not null and `<` the timestamp the caller passes |

### `SeatsRepo`

| Method | I/O |
| --- | --- |
| `insert` | `INSERT` `game.seats` |
| `findById` | `SELECT` by `id` |
| `findByGameId` | `SELECT` all seats for `game_id`, order by `seat_index` |
| `findByGameIdAndUserId` | `SELECT` one seat |
| `findByUserId` | `SELECT` seats for `user_id` (auth sitting check uses this list) |
| `update` | `UPDATE` columns the caller passes (`runningScore`, `nextWindAgreed`, …) |

### `RoundsRepo`

| Method | I/O |
| --- | --- |
| `insert` | `INSERT` `game.rounds` |
| `findById` | `SELECT` by `id` |
| `findByGameId` | `SELECT` rounds for `game_id`, order by `round_index` |
| `update` | `UPDATE` columns the caller passes (`phase`, `currentSeatIndex`, `resultType`, `winKind`, `winnerSeatIndex`, `discardFromSeatIndex`, `status`, `updatedAt`, …) |

### `HandsRepo`

| Method | I/O |
| --- | --- |
| `insert` | `INSERT` `game.hands` |
| `findById` | `SELECT` by `id` |
| `findByRoundId` | `SELECT` by `round_id` |
| `findByRoundIdAndSeatIndex` | `SELECT` one hand |

### `HandTilesRepo`

| Method | I/O |
| --- | --- |
| `insert` | `INSERT` one `game.hand_tiles` |
| `insertMany` | `INSERT` several |
| `findById` | `SELECT` by `id` |
| `findByHandId` | `SELECT` by `hand_id`, order by `sort_index` |
| `update` | `UPDATE` columns the caller passes (`sortIndex`, `isDrawn`, …) |
| `deleteById` | `DELETE` by `id` |

### `WallTilesRepo`

| Method | I/O |
| --- | --- |
| `insertMany` | `INSERT` wall rows |
| `findById` | `SELECT` by `id` |
| `findByRoundId` | `SELECT` by `round_id`, order by `sort_index` |
| `deleteById` | `DELETE` by `id` |

`WallTilesLogic` picks the first or last row of `findByRoundId` for draw vs tail.

### `DiscardTilesRepo`

| Method | I/O |
| --- | --- |
| `insert` | `INSERT` `game.discard_tiles` |
| `findById` | `SELECT` by `id` |
| `findByRoundId` | `SELECT` by `round_id`, order by `sort_index` |
| `deleteById` | `DELETE` by `id` (claimed discard) |

### `FlowerTilesRepo`

| Method | I/O |
| --- | --- |
| `insert` | `INSERT` `game.flower_tiles` |
| `findByRoundId` | `SELECT` by `round_id` |
| `findByRoundIdAndSeatIndex` | `SELECT` for one seat, order by `sort_index` |

### `MeldsRepo`

| Method | I/O |
| --- | --- |
| `insert` | `INSERT` `game.melds` |
| `findById` | `SELECT` by `id` |
| `findByRoundId` | `SELECT` by `round_id` |
| `findByRoundIdAndSeatIndex` | `SELECT` for one seat, order by `sort_index` |

### `MeldTilesRepo`

| Method | I/O |
| --- | --- |
| `insert` | `INSERT` one `game.meld_tiles` |
| `insertMany` | `INSERT` several |
| `findByMeldId` | `SELECT` by `meld_id`, order by `sort_index` |

### `RoundScoresRepo`

| Method | I/O |
| --- | --- |
| `insert` | `INSERT` one `game.round_scores` |
| `insertMany` | `INSERT` four seats |
| `findByRoundId` | `SELECT` by `round_id`, order by `seat_index` |

### `ScorePaymentsRepo`

| Method | I/O |
| --- | --- |
| `insert` | `INSERT` one `game.score_payments` |
| `insertMany` | `INSERT` several |
| `findByRoundId` | `SELECT` by `round_id` |

---

## `RoundsLogic` play methods (called by socket handlers)

| Method | Handler |
| --- | --- |
| `snapshotForSeat({ gameId, userId })` | `JoinGameHandler` |
| `draw({ gameId, userId })` | `DrawHandler`; also `GamesLogic`/`RoundsLogic` when `autoDraw` |
| `discard({ gameId, userId, tileId })` | `DiscardHandler` |
| `claim({ gameId, userId, kind, tileIds })` | `ClaimHandler` |
| `passClaim({ gameId, userId })` | `PassClaimHandler` |
| `passUnanswered({ gameId })` | `ClaimWindowCoordinator` on timeout |
| `declareWin({ gameId, userId })` | `DeclareWinHandler` |

Return `{ ok: true, result }` or `{ ok: false, error: SocketError }`. `result` lists emits; see [`docs/socket.md`](socket.md).

---

## What each pair owns

Repos: insert / find / update / delete rows for **that table**, plus keyed lists (for example all wall rows for a `round_id`, ordered by `sort_index`). Ordering and filters are I/O. Interpreting “min sort_index = next draw” is `WallTilesLogic`, not the repo.

Logic: rules that are about that table’s meaning. Cross-table work is owned by the **root table of the operation**; that logic calls the others inside one transaction.

| Logic | Owns (rules, not SQL) |
| --- | --- |
| `GamesLogic` | Create waiting east game (presets → rule columns, `scoringVersion`, mint `referenceCode`: random 5-digit `0`–`9` string, retry on UNIQUE). **`alreadySeated` if `SeatsRepo.findByUserId` is non-empty.** Status `waiting` / `inProgress` / `completed` / `aborted`. `abort({ gameId, userId })`: waiting or inProgress only; mark aborted; Redis publish; delete. Next wind (copy code + rules + seats, rotate dealer, **delete finished then insert**). 1-hour delete of completed games. |
| `SeatsLogic` | Join by `referenceCode` (format: length 5, each char `0`–`9`, **no regex**; fail → `invalidBody`. Lookup miss → `gameNotFound`). **`alreadySeated` if this user already has any seat** (this game or another). Next `seatIndex` 0–3, `gameFull`, `gameNotWaiting`. `requireSeat(userId, gameId)` / `seatIndexForUser`. `nextWindAgreed`. Fourth join: random dealer, then ask `RoundsLogic` to start. Snapshot `currentGame` for `UserLogic` (at most one seat). |
| `RoundsLogic` | Start hand (insert round, deal). Turn / `phase` (`draw` / `discard` / `claim`). Win / empty-wall results (`winKind`, `discardFromSeatIndex`). On `GamesLogic.abort` while in progress: `status = aborted`, `resultType = abort` (no scores). Orchestrates tile moves by calling the tile/meld logics. |
| `HandsLogic` | One concealed hand per seat per round. |
| `HandTilesLogic` | Concealed tiles: deal, draw (`isDrawn`), remove for discard/claim. |
| `WallTilesLogic` | 144-tile wall. Next draw = `MIN(sort_index)`. 补花 / kong replacement = `MAX(sort_index)`. Empty wall. |
| `DiscardTilesLogic` | Public discards; last discard = max `sort_index` for the round. |
| `FlowerTilesLogic` | Bonus tiles in front of a seat. 补花: move flower here, then replacement from wall tail (only if `bonusTilesEnabled`). |
| `MeldsLogic` | Pong / kong / chow, concealed kong, `fromSeatIndex`, chow-only-from-previous. Claim resolve order **win > kong > pong > chow**. |
| `MeldTilesLogic` | Tiles inside a meld (`isClaimed` on the taken discard). |
| `RoundScoresLogic` | Per-seat `scoreDelta` / `scoreAfter` / `scoreUnits` / `isWinner`. Copy `scoreAfter` onto `seats.runningScore`. Upsert `UserLogic` figures at end of hand. |
| `ScorePaymentsLogic` | Who paid whom. Discard win: discarder → winner. Self-draw: other three → winner. Empty wall: no payment rows. |

Play logic reads **rule columns on `game.games`**, not `if ruleset == taiwan`. Create-time closed settings (`Ruleset`, `ScoreUnit`, `DiscardWinPayer`, `ClaimWindowMs`) are enums; `GamesLogic` accepts only values that already passed the Zod whitelist.

---

## Cross-table flows (who drives)

| Flow | Driver | Also calls |
| --- | --- | --- |
| `POST /api/games` | `GamesLogic` | `SeatsLogic` (creator sits; reject if already seated) |
| `POST /api/games/join` | `SeatsLogic` | `GamesLogic` (status); reject if already seated; on fourth seat `RoundsLogic` |
| `POST .../abort` | `GamesLogic` | `SeatsLogic.requireSeat`; `RoundsLogic` if in progress; Redis publish; `GamesRepo.delete` |
| Start / deal | `RoundsLogic` | `HandsLogic`, `HandTilesLogic`, `WallTilesLogic`; if `autoDraw`, draw for dealer |
| Draw / 补花 | `RoundsLogic` | `WallTilesLogic`, `HandTilesLogic`, `FlowerTilesLogic` |
| Discard | `RoundsLogic` | `HandTilesLogic`, `DiscardTilesLogic`; then claim window from `games.claimWindowMs` |
| Claim / pass / hu | `RoundsLogic` | `MeldsLogic`, `MeldTilesLogic`, `HandTilesLogic`, `DiscardTilesLogic`; win → scores |
| End hand | `RoundsLogic` | `RoundScoresLogic`, `ScorePaymentsLogic`, `GamesLogic` (completed), `UserLogic` (figures) |
| `POST .../next-wind` | `SeatsLogic` (agree) then `GamesLogic` (when all four, not north) | `SeatsLogic` (copy seats onto new game) |
| `GET /api/games/:gameId` | `GamesLogic` (hydrate if seated) | seats, round, self hand, public tiles, scores |
| Auth seated exception | `AuthLogic` | `SeatsRepo.findByUserId` (row I/O). Whether that keeps identity is `AuthLogic`, not the repo. |

HTTP and Socket.IO call the same logic classes. Socket handlers: [`docs/socket.md`](socket.md). Socket.IO does not talk to repos directly.

---

## Layering

```text
HTTP route / socket handler
  → GamesLogic / SeatsLogic / RoundsLogic / …
      → *Repo (I/O only)
      → sibling *Logic (when that table’s rules apply)
      → Redis cache helpers (not repos)
```

- Handlers never call a repo.
- `AuthLogic.userIsSeated` uses `SeatsRepo.findByUserId` (I/O). The 1-day exception lives in `AuthLogic`.
- `UserLogic.loadProfile.currentGame` uses `SeatsLogic` when those tables exist (assembly is logic, not a repo).
- Child FKs stay `ON DELETE CASCADE` from `games` / `rounds`. `GamesRepo.delete` is a row delete; CASCADE is schema, not repo logic.

---

## Locked (this slice)

- Every `game.*` table has exactly one `*Repo` and one `*Logic`.
- **Repos have no business logic** — that table’s Postgres I/O only. Logic = rules; cross-table flows have one driver (table above).
- No sitting table, no sitting classes.
- Redis is not a game repo.
- Static sets are enums in `src/types/server`; client create/join/play closed fields are whitelisted with those enums ([`docs/types.md`](types.md)).
- Repos speak camelCase + enums; Drizzle maps to SQL snake_case.
- One seat per user. Abort dissolves waiting or in-progress tables.

## Open (game classes)

- Whether socket-server imports these `*Logic` / `*Repo` modules from the Void `src/` tree or a shared package — pick at implementation time.
