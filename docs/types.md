# Server enums (planning)

Closed value sets are TypeScript **`enum`s** under **`src/types/server`**. The enums stored on `game.*` columns are implemented. API, auth, profile, Redis, and socket enums below are still planning. Client HTTP and socket payloads are **whitelisted** against these enums at the boundary. Zod **schemas** live in `src/model/server` ([`docs/client.md`](client.md)); `*Logic` / socket handlers / `ApiClient` **call** parse. Membership is not re-decided in `*Logic` after a successful parse.

Enum **values** are the JSON/API values (**camelCase**). PostgreSQL **stores** snake_case text (`hong_kong`, `in_progress`). **Drizzle** maps enum ↔ SQL text and camelCase fields ↔ snake_case columns **when it builds the query**. `*Logic` and `*Repo` only see camelCase + TypeScript enums. Repos do not map by hand.

`type` is still used for open shapes (ids, records, envelopes). `enum` is only for static sets.

---

## Files

Column enums used by `db/schema.ts` are written. The other files are not.

| Path | Enums | Status |
| --- | --- | --- |
| `src/types/server/api.ts` | `ApiStatus`, `ApiError`, `HttpStatus` | not written |
| `src/types/server/auth.ts` | `CookieName` | not written |
| `src/types/server/profile.ts` | `UserAttributeName`, `UserFigureName`, `UserFigureJsonKey` | not written |
| `src/types/server/redis.ts` | `RedisKeyPrefix` | not written |
| `src/types/server/ruleset.ts` | `Ruleset` | written |
| `src/types/server/scoreUnit.ts` | `ScoreUnit` | written |
| `src/types/server/discardWinPayer.ts` | `DiscardWinPayer` | written |
| `src/types/server/claimWindowMs.ts` | `ClaimWindowMs` | written |
| `src/types/server/gameStatus.ts` | `GameStatus` | written |
| `src/types/server/prevailingWind.ts` | `PrevailingWind` | written |
| `src/types/server/roundStatus.ts` | `RoundStatus` | written |
| `src/types/server/roundPhase.ts` | `RoundPhase` | written |
| `src/types/server/roundResultType.ts` | `RoundResultType` | written |
| `src/types/server/winKind.ts` | `WinKind` | written |
| `src/types/server/meldType.ts` | `MeldType` | written |
| `src/types/server/socketEvent.ts` | `SocketEvent` | written |
| `src/types/server/socketError.ts` | `SocketError` | written |
| `src/types/server/emitTarget.ts` | `EmitTarget` | written |
| `src/types/server/claimAnswerKind.ts` | `ClaimAnswerKind` | written |
| `src/types/server/tile.ts` | `TileKind`, `TileSuit`, `WindTile`, `DragonTile`, `FlowerTile`, `SeasonTile` | written |
| `src/types/server/scoringPattern.ts` | `ScoringPattern` | written |
| `src/types/server/payoutKind.ts` | `PayoutKind` | written |
| `src/types/server/gameChannelEvent.ts` | `GameChannelEvent` (`gameAborted`, `gameChanged`, `nextWind`) | written |

---

## Values (JSON / enum)

### Create-game whitelist (`POST /api/games`)

Required:

| Field | Enum | Values |
| --- | --- | --- |
| `ruleset` | `Ruleset` | `hongKong`, `taiwan` |

Optional overrides. Omitted → preset defaults in `GamesLogic` (not Zod defaults). Present → must be in the enum (or `null` where listed).

| Field | Enum / note | Values |
| --- | --- | --- |
| `scoreUnit` | `ScoreUnit` | `fan`, `tai` |
| `discardWinPayer` | `DiscardWinPayer` | `discarder`, `allThree` |
| `claimWindowMs` | `ClaimWindowMs` or JSON `null` | `5000`, `10000`; **`null` = unlimited** (not an enum member) |
| `autoDraw` | boolean, not an enum | |
| `bonusTilesEnabled` | boolean, not an enum | |
| `chowOnlyFromPrevious` | boolean, not an enum | |
| `handTileCount` | integer, not an enum | domain in `GamesLogic` |
| `winMeldCount` | integer, not an enum | domain in `GamesLogic` |
| `minScoreUnits` | number, not an enum | domain in `GamesLogic` |

`scoringVersion` is not client-set.

Parse fail on `ruleset` → `rulesetUnknown`. Parse fail on `claimWindowMs` → `invalidClaimWindow`. Any other enum/boolean/JSON shape fail → `invalidBody`.

### Other request / event whitelists

| Client field | Enum | Values |
| --- | --- | --- |
| `claim.kind` (socket) | `MeldType` | `chow`, `pong`, `kong` |
| socket event name | `SocketEvent` | see [`docs/socket.md`](socket.md) |
| `actionError.error` | `SocketError` | see [`docs/socket.md`](socket.md) |

`PATCH /api/me` attribute **keys** are not a closed whitelist (names stay open) except the locked key `UserAttributeName.DisplayName` (`displayName`). Value rules stay in `UserLogic`.

`POST /api/games/join` `referenceCode` is **not** an enum. Zod keeps it a string. `SeatsLogic` checks exactly 5 characters, each `0`–`9` (loop / char range, **no regex**). Fail → `invalidBody`. `00000` is valid. JSON type is string so leading zeros survive.

### Server/state enums (same JSON on responses)

| Enum | Values | SQL text |
| --- | --- | --- |
| `Ruleset` | `hongKong`, `taiwan` | `hong_kong`, `taiwan` |
| `ScoreUnit` | `fan`, `tai` | `fan`, `tai` |
| `DiscardWinPayer` | `discarder`, `allThree` | `discarder`, `all_three` |
| `ClaimWindowMs` | `5000`, `10000` | `5000`, `10000`; SQL `NULL` = unlimited |
| `GameStatus` | `waiting`, `inProgress`, `completed`, `aborted` | `waiting`, `in_progress`, `completed`, `aborted` |
| `PrevailingWind` | `east`, `south`, `west`, `north` | same |
| `RoundStatus` | `inProgress`, `completed`, `aborted` | `in_progress`, `completed`, `aborted` |
| `RoundPhase` | `draw`, `discard`, `claim`, `robKong` | same (plain text column, no CHECK) |
| `RoundResultType` | `win`, `draw`, `abort` | same |
| `WinKind` | `selfDraw`, `discard` | `self_draw`, `discard` |
| `MeldType` | `pong`, `kong`, `chow` | same |
| `ApiStatus` | `success`, `failed` | n/a |
| `ApiError` | see [`docs/api.md`](api.md) | n/a |
| `CookieName` | `session` | n/a |
| `UserAttributeName` | `displayName` | stored as that name |
| `UserFigureName` | `games_played`, `wins`, `running_score` | stored as that name |
| `UserFigureJsonKey` | `gamesPlayed`, `wins`, `runningScore` | n/a |

---

## How the guard works

1. Route reads JSON.
2. The `src/model/server` Zod schema uses `z.enum(Ruleset)` (and the other request enums). That **is** the whitelist. Logic calls `schema.parse`.
3. On success, `*Logic` receives typed enum values. It does not test “is this a known ruleset?” again.
4. `*Logic` still owns non-set rules (display-name length, `referenceCode` 5 digits, one-seat-per-user, abort vs `completed`, fourth-player start, `notSeated`, claim vs turn). It does **not** map SQL snake_case.

Socket payloads use the same enums (`MeldType` for `claim.kind`).

---

## Locked (this slice)

- Static sets are `enum`s under `src/types/server`.
- Wire Zod schemas live in `src/model/server`; logic/handlers call parse.
- JSON/API uses the enum values (camelCase). SQL snake_case (columns and enum text) is mapped in **Drizzle**, not in `*Logic` or by hand in a repo.
- Client create-game and other closed request fields are whitelisted with those enums.
- `claimWindowMs` whitelist is `ClaimWindowMs` plus `null`.
- Booleans and open numbers are not enums.

## Open (types)

- Exact integer limits for `handTileCount` / `winMeldCount` / `minScoreUnits` (not a closed enum yet).
- `tile_code` list stays in [`docs/database.md`](database.md); not a request whitelist on create.
