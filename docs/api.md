# HTTP API (planning)

Not implemented. Void file-based routes under `routes/`. Logic in `src/logic/server`. Zod at the boundary; domain rules in logic.

JSON property names are **camelCase**. Cookie session: **mint** only on `POST /api/session`; other routes **require** a live session. Auth logic: [`docs/auth.md`](auth.md). Game repos/logic: [`docs/game.md`](game.md). Closed request values: [`docs/types.md`](types.md).

## Envelope

Success:

```json
{ "status": "success", "data": { } }
```

Failure:

```json
{ "status": "failed", "error": "unauthorized" }
```

`error` is an enum string (not a free-text message). HTTP status still reflects the class of failure:

| HTTP | `error` |
| --- | --- |
| 401 | `unauthorized` |
| 404 | `gameNotFound` |
| 409 | `alreadySeated`, `gameFull`, `gameNotWaiting`, `gameNotCompleted`, `northComplete`, `gameNotAbortable` |
| 422 | `invalidBody`, `rulesetUnknown`, `invalidClaimWindow` |
| 403 | `notSeated` |
| 503 | `redisUnavailable` |

## HTTP vs Socket.IO

| Channel | Activities |
| --- | --- |
| **Void HTTP** | Session, profile, create/join table, hydrate/reconnect snapshot, agree next wind, **abort**, socket ticket |
| **Socket.IO** | Draw, discard, claim (chow/pong/kong), 补花, declare win, turn/claim presence, **`gameAborted` fan-out** |
| **Cron / worker** | Delete `game.games` where `completed_at` is older than 1 hour |

Live tile moves stay off HTTP so each discard is not a Workers round-trip; Postgres is still written by the **socket-server** (source of truth), then Redis cache, then broadcast.

## Auth on every route

1. Read httpOnly cookie `session`.
2. `POST /api/session`: resolve or **create** `profile.users` + `auth.sessions` (see [`docs/auth.md`](auth.md)).
3. Every other route: resolve only. Missing or dead session → `unauthorized`.
4. If the user has a `game.seats` row, do not rotate identity.

---

## Endpoints (locked)

### Session and profile

| Method | Route file | Purpose |
| --- | --- | --- |
| `POST` | `routes/api/session.ts` → `/api/session` | Ensure cookie + profile; return `userId` |
| `GET` | `routes/api/me.ts` → `/api/me` | Profile: `userId`, attributes, figures, **current game** if seated |
| `PATCH` | `routes/api/me.ts` → `/api/me` | Upsert attributes. Body: `{ "attributes": { "displayName": "…" } }`. **`displayName` is the locked profile attribute key.** |
| `POST` | `routes/api/socket-ticket.ts` → `/api/socket-ticket` | Mint Redis ticket (TTL 60s) for Socket.IO handshake |

`GET /api/me` `data.currentGame`: `null` or `{ gameId, referenceCode, status, prevailingWind, ruleset, seatIndex }` so a refresh can resume.

### Games (lobby and sitting)

| Method | Route file | Purpose |
| --- | --- | --- |
| `POST` | `routes/api/games/index.ts` → `/api/games` | Create `waiting` east game. Body: `{ "ruleset": "hongKong" \| "taiwan" }` plus optional rule overrides. Creator is seated at the next `seatIndex`. Returns `gameId`, `referenceCode`, rules, seats. |
| `POST` | `routes/api/games/join.ts` → `/api/games/join` | Body: `{ "referenceCode": "04217" }` — **string of exactly 5 digits `0`–`9`**. Insert seat. If this is the **fourth** player: random dealer, `in_progress`, deal. Returns same snapshot as GET. |
| `GET` | `routes/api/games/[gameId].ts` → `/api/games/:gameId` | Hydrate. **Caller must be seated.** No snapshot by `referenceCode` without `POST /api/games/join`. Own concealed hand only. Public: discards, melds, flowers, wall **count**, scores, `nextWindAgreed`, other seats’ `displayName`. |
| `POST` | `routes/api/games/[gameId]/next-wind.ts` → `/api/games/:gameId/next-wind` | This seat agrees to the next wind (`nextWindAgreed`). If all four and not north: create next wind, delete old game, return **new** `gameId`. If north: `error: northComplete`. |
| `POST` | `routes/api/games/[gameId]/abort.ts` → `/api/games/:gameId/abort` | **Any seated player** (not creator-only); `waiting` or `inProgress` only. Marks `aborted`, publishes Redis, **deletes** the game (CASCADE seats). Body empty. `data`: `{ aborted: true }`. `completed` → `gameNotAbortable`. |

`ruleset` in JSON is **camelCase** (`hongKong`, `taiwan`). SQL stores `hong_kong` / `taiwan`; **Drizzle** maps at query time. Closed fields are **enums** under `src/types/server`; Zod whitelists the body against those enums ([`docs/types.md`](types.md)).

Create body: `{ "ruleset": Ruleset }` plus optional overrides. Enum-backed: `scoreUnit` (`ScoreUnit`), `discardWinPayer` (`DiscardWinPayer`), `claimWindowMs` (`ClaimWindowMs` or `null`). Booleans: `bonusTilesEnabled`, `chowOnlyFromPrevious`, `autoDraw`. Open numbers (logic, not enums): `handTileCount`, `winMeldCount`, `minScoreUnits`. Omitted fields take the preset (`autoDraw: true`, `claimWindowMs: 5000`). `scoringVersion` is set from the static JSON file, not the client.

### Not HTTP (Socket.IO)

See [`docs/socket.md`](socket.md). Client may `GET /api/games/:gameId` after reconnect, then `joinGame`.

### Errors (initial set)

| `error` | When |
| --- | --- |
| `unauthorized` | Require-session route with no live session |
| `invalidBody` | Zod parse fail, attribute domain fail, or `referenceCode` not exactly 5 digits `0`–`9` |
| `redisUnavailable` | Socket ticket could not be written to Redis |
| `gameNotFound` | Unknown `gameId` or `referenceCode` |
| `gameNotWaiting` | Join when not `waiting` |
| `alreadySeated` | Create or join while this user already has a seat (this table or another) |
| `gameFull` | Fifth player |
| `notSeated` | GET, `next-wind`, or `abort` without a seat |
| `gameNotAbortable` | Abort while `completed` (or game already gone) |
| `gameNotCompleted` | Agree next wind while still playing |
| `northComplete` | Agree after north |
| `rulesetUnknown` | Create with a bad preset |
| `invalidClaimWindow` | `claimWindowMs` not 5000, 10000, or null |

---

## Snapshot shape (GET game / join / create)

`data` includes:

- `game`: id, referenceCode, status, prevailingWind, ruleset, rule columns, scoringVersion, completedAt, dealerSeatIndex (from the round when in play)
- `seats`: seatIndex, userId, displayName, runningScore, nextWindAgreed
- `round`: null if `waiting`; else phase, currentSeatIndex, resultType, winKind, wall remaining count
- `self`: `{ seatIndex, handTiles[] }` or null if not seated
- `publicTiles`: discards, melds, flowerTiles (all seats)
- `scores`: roundScores + scorePayments when the round is finished

Wall tile **codes** are never sent to clients.

---

## Workflow (locked HTTP)

UI is two pages (`/register`, `/game/[uuid]`): [`docs/client.md`](client.md). Cookie from `POST /api/session` is sent on every later call. The host shares the 5-digit `referenceCode` outside the API (chat, QR), **not** the `/game/{uuid}` URL. Tile moves are Socket.IO.

1. **Arrive** — Each player `POST /api/session`, then `PATCH /api/me` with `displayName`.
2. **Host opens the table** — P1 `POST /api/games` `{ "ruleset": "hongKong" }` (or `taiwan`). Gets `gameId`, `referenceCode`, `status: waiting`, seated at index 0.
3. **Others join** — P2–P4 `POST /api/games/join` `{ "referenceCode" }`. Until join succeeds they **cannot** `GET /api/games/:gameId` (`notSeated`).
4. **Fourth join starts East** — Join response includes `status: inProgress`, a round, dealt `self.handTiles`. Random `dealerSeatIndex`.
5. **Play** — Each `POST /api/socket-ticket`, connect Socket.IO. Discards/claims/hu are socket events. Reconnect: `GET /api/me` → `GET /api/games/:gameId` → new ticket → socket.
6. **Hand over** — `GET /api/games/:gameId` shows scores. Game stays `completed` so players can read it.
7. **Next wind (not North)** — Each `POST /api/games/:gameId/next-wind`. When all four have agreed: response `data` is the **new** game snapshot; old `gameId` is deleted.
8. **Abort** — Any seated player `POST /api/games/:gameId/abort` while `waiting` or `inProgress`. Table is deleted; everyone returns to `/register`. `completed` → `gameNotAbortable`.
9. **North** — `POST .../next-wind` returns `northComplete`. Cron deletes the row 1 hour after `completedAt`.
10. **Refresh any time** — `GET /api/me`. If `currentGame` is set, hydrate with `GET /api/games/:gameId`.

```text
P1: POST /api/session → PATCH /api/me → POST /api/games
P2–P4: POST /api/session → PATCH /api/me → POST /api/games/join
P4 join deals East
all: POST /api/socket-ticket → (socket play) → GET /api/games/:gameId
all: POST /api/games/:gameId/next-wind   (repeat south, west)
North: next-wind → northComplete
```

## Locked (this slice)

- Attribute key for the player name is `displayName`.
- Must **join** (`POST /api/games/join`) before seeing the waiting table. `GET /api/games/:gameId` requires a seat.
- Next wind path is `POST /api/games/:gameId/next-wind`.
- `referenceCode` is a JSON **string** of exactly 5 digits (`"00000"`–`"99999"`). Bad format → `invalidBody`; unknown code → `gameNotFound`.
- One seat per user. Create/join while seated → `alreadySeated`.
- Abort path is `POST /api/games/:gameId/abort` (`waiting` / `inProgress` only). Dissolves the table; no single-player leave.

## Open (API)

- None on the HTTP slice. Live events: [`docs/socket.md`](socket.md).
