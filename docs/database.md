# Database schema

Table definitions are implemented in `db/schema.ts` (split under `db/schema/`). Closed enum columns use the TypeScript enums in `src/types/server` and store snake_case text.

HTTP API planning: [`docs/api.md`](api.md). Auth logic: [`docs/auth.md`](auth.md). Game repos/logic: [`docs/game.md`](game.md). Enums: [`docs/types.md`](types.md).

PostgreSQL **schema**, **table**, and **column** names stay **snake_case**. Application code (logic, repos, JSON) is **camelCase**. **Drizzle** (Void `db/schema.ts`) is the only conversion: TS fields and enum values in memory, snake_case identifiers and enum **text** on the wire to Postgres. Mapping happens in the ORM **before the query is sent**, not in `*Logic` and not by hand in a repo. See [ORM mapping](#orm-mapping-locked).

## Storage split

| Store | Source of truth for |
| --- | --- |
| PostgreSQL | Identity, profiles, sessions (hashed), matches, seats, rounds, hands, wall, discards, melds, scores |
| Redis | Cache of sessions and of the current round/hands (never the source of truth) |
| Socket.IO | Transport only |

---

## Schema `profile` (locked)

Player identity and facts. Not Void email/password auth.

Attribute names stay open except **`displayName`** (player name). Figure names used at end of a hand are locked: `games_played`, `wins`, `running_score`. Other names may be added later.

### `profile.users`

Durable player identity. Other game tables reference `uuid`. The session token does **not** live on this table.

| Column | Type | Constraints | Role |
| --- | --- | --- | --- |
| `uuid` | uuid | PRIMARY KEY | Stable player id |
| `created_at` | timestamptz | NOT NULL DEFAULT now() | First insert; start of the 1-day identity window |
| `updated_at` | timestamptz | NOT NULL DEFAULT now() | Last write to this row |

### `profile.user_attributes`

Named string facts for a user (display name, locale, and so on).

| Column | Type | Constraints |
| --- | --- | --- |
| `id` | uuid | PRIMARY KEY |
| `user_id` | uuid | NOT NULL, FK → `profile.users.uuid` ON DELETE CASCADE |
| `name` | text | NOT NULL |
| `value` | text | NOT NULL |

UNIQUE (`user_id`, `name`). Index on `user_id`.

### `profile.user_figures`

Named numeric facts for a user (rating, wins, currency, and so on).

| Column | Type | Constraints |
| --- | --- | --- |
| `id` | uuid | PRIMARY KEY |
| `user_id` | uuid | NOT NULL, FK → `profile.users.uuid` ON DELETE CASCADE |
| `name` | text | NOT NULL |
| `value` | numeric | NOT NULL |

UNIQUE (`user_id`, `name`). Index on `user_id`.

### Locked decisions (profile)

- Identity table is `profile.users` (not `profile.user`).
- No `session_id` on `profile.users`.
- `profile.user_figures.value` is `numeric`.
- Attribute `displayName` is locked; other attribute names stay open.
- End-of-hand figures: `games_played`, `wins`, `running_score`.
- SQL schema, table, and column names stay snake_case.

If `now() >= created_at + 1 day` but this `uuid` still appears in `game.seats`, **do not rotate identity**. Keep this uuid and refresh the cookie. After that game row is deleted, the next resolve may mint a new profile.

---

## Schema `auth` (locked)

The client presents a session token in an **httpOnly cookie**. **`POST /api/session`** is the only mint: no cookie or dead token → new `profile.users` + `auth.sessions` + cookie. Other HTTP routes require a live session (`unauthorized` if missing). Later visits with that cookie load the existing profile.

`profile.users` is the player. `auth.sessions` is the credential. Redis is a cache of the credential, not the source of truth.

Insert order: `profile.users`, then `auth.sessions` with `user_id` = that `uuid`.

One session per user (`UNIQUE user_id`).

### `auth.sessions`

Table name stays plural (`sessions`) to match `profile.users`.

| Column | Type | Constraints | Role |
| --- | --- | --- | --- |
| `id` | uuid | PRIMARY KEY | Session row id |
| `user_id` | uuid | NOT NULL UNIQUE, FK → `profile.users.uuid` | Player this token authenticates |
| `token_hash` | text | NOT NULL UNIQUE | SHA-256 of the raw token |
| `is_expired` | boolean | NOT NULL DEFAULT false | Set true when the identity window has ended |
| `created_at` | timestamptz | NOT NULL DEFAULT now() | Session issued |
| `updated_at` | timestamptz | NOT NULL DEFAULT now() | Last session-row write |
| `last_seen_at` | timestamptz | NOT NULL DEFAULT now() | Last successful resolve while still valid |

Do **not** store the raw token in Postgres. Set it on the cookie at creation. Lookup: hash the cookie token, then match `token_hash`.

### Expiry (1 day, from user creation)

The identity lives **one day from `profile.users.created_at`**. That clock does not slide on activity.

On every resolve:

1. Load the session (Redis, then Postgres).
2. If `is_expired` is already true, treat the token as dead.
3. If `now() >= profile.users.created_at + interval '1 day'` **and** this `user_id` is **not** in any `game.seats` row, set `auth.sessions.is_expired = true`, delete the Redis key, and treat the token as dead.
4. If the 1-day window has passed **but** the user still occupies a seat, keep this uuid, do not set `is_expired`, and refresh the cookie so the sitting can finish.

A dead token follows the first-visit path: new `profile.users`, new `auth.sessions`, new cookie. The old rows stay in Postgres with `is_expired = true`.

No `expires_at` column. The deadline is always `profile.users.created_at + 1 day`. `is_expired` is the stored flag after that deadline has been observed.

### Redis cache

| Item | Value |
| --- | --- |
| Key | `auth:session:{tokenHash}` |
| Value | `user_id` and `session_id` (`auth.sessions.id`) |
| TTL | Time left until `profile.users.created_at + 1 day` |
| Miss | Read `auth.sessions` (and the user), SET only if the session is still valid (including seated past 1 day) |
| `auth:socket_ticket:{ticket}` | One-time handshake ticket → `user_id`. TTL 60 seconds. `GETDEL` on Socket.IO connect. |

Postgres is durable. If Redis restarts, sessions still resolve until the 1-day window ends (or until a seated game is deleted).

**Why a socket ticket, not the cookie on Socket.IO:** Void (port 5173 / Cloudflare Workers) and `socket-server` (port 3001 / Node) are **different origins**. The browser will not send the httpOnly cookie to the socket origin. Putting the session token in JavaScript or localStorage would undo httpOnly. The web API (which *does* get the cookie) mints a short-lived Redis ticket; the client uses that only on the socket handshake, then it is deleted. Same-origin reverse proxy would also work and would not need a ticket; two-port Compose and a separate socket process do.

### Resolve flow

1. Read the raw token from the **httpOnly cookie**. First visit may have none.
2. If a token is present, hash it. `GET` Redis `auth:session:{tokenHash}`.
3. Redis miss: `SELECT` `auth.sessions` where `token_hash` matches. On hit, load `profile.users`.
4. If the session is missing, `is_expired` is true, or the 1-day window has passed **and** this user is not in `game.seats`: mark `is_expired` if needed, drop the Redis key, treat as dead. **`POST /api/session`** then inserts a new user and session and sets a new cookie. Other routes return `unauthorized`.
5. Otherwise: load attributes and figures, bump `last_seen_at`, refresh the cookie if seated past 1 day, refill Redis.

The server mints the token. Do not persist a client-invented token as identity.

### Cookie

| Attribute | Value |
| --- | --- |
| Storage | httpOnly cookie (not URL, not sessionStorage, not localStorage) |
| Lifetime | 1 day from `created_at`, or refreshed while this user still has a `game.seats` row |
| Flags | `HttpOnly`; `Secure` in production; `SameSite=Lax` |

### Locked decisions (auth)

- Table is `auth.sessions`; token is not stored on `profile.users`.
- One session per user (`UNIQUE user_id`).
- Client storage is an httpOnly cookie.
- Identity expires one day after `profile.users.created_at`, unless the user still occupies a `game.seats` row.
- On that deadline (and not seated), set `auth.sessions.is_expired` to true (lazy, on resolve).
- Store `token_hash` in Postgres, never the raw token.
- Socket.IO authenticates with a one-time Redis ticket minted by the cookie-authenticated HTTP API.

---

## Schema `game` (locked)

Each `game.*` table has a matching `*Repo` (Postgres I/O only — **no business logic**) and `*Logic` (rules). See [`docs/game.md`](game.md).

**PostgreSQL is the source of truth** for player hands, wall, discards, melds, and round information. Every draw, discard, and claim commits to Postgres first. Redis may cache the current round for Socket.IO fan-out. If Redis is empty, rebuild from Postgres. The hand continues after a Redis wipe.

Write path: Socket.IO event → Postgres transaction → update Redis cache → broadcast.

SQL stays snake_case. Insert `game.rounds`, four `game.hands`, 144 `game.wall_tiles`, and dealt `game.hand_tiles` when the hand starts (`in_progress`). Deal **13** tiles per seat for `hong_kong`, **16** for `taiwan`.

Tiles move between child tables in that transaction (wall → hand on draw, hand → discard on discard, hand + last discard → meld on claim, wall → `flower_tiles` + tail replacement on 补花). There is no jsonb tile blob on `game.rounds`.

### `game.games`

One hand / one prevailing wind. A complete sitting is four of these rows in sequence (east → south → west → north), but only one exists at a time.

| Column | Type | Constraints | Role |
| --- | --- | --- | --- |
| `id` | uuid | PRIMARY KEY | Match id |
| `reference_code` | text | NOT NULL UNIQUE | Invitation code: **exactly 5 characters, each `0`–`9`** (leading zeros kept). JSON is a string (`"04217"`), not a number. |
| `status` | text | NOT NULL | `waiting` / `in_progress` / `completed` / `aborted` |
| `prevailing_wind` | text | NOT NULL | `east` / `south` / `west` / `north` |
| `ruleset` | text | NOT NULL | Preset name `hong_kong` or `taiwan`; fills the rule columns below |
| `starting_score` | numeric | NOT NULL DEFAULT 0 | Opening `running_score`; locked at **0** |
| `hand_tile_count` | integer | NOT NULL | Concealed tiles after deal (before the extra draw) |
| `win_meld_count` | integer | NOT NULL | Melds required plus one pair |
| `score_unit` | text | NOT NULL | `fan` or `tai` (label for `round_scores.score_units`) |
| `bonus_tiles_enabled` | boolean | NOT NULL | If true, 补花 into `game.flower_tiles` |
| `chow_only_from_previous` | boolean | NOT NULL | Chow only from the previous seat |
| `min_score_units` | numeric | NOT NULL DEFAULT 0 | Minimum fan/tai to win |
| `discard_win_payer` | text | NOT NULL | `discarder` (v1) or `all_three` (future) |
| `auto_draw` | boolean | NOT NULL DEFAULT true | If true, server draws when `phase` becomes `draw`; if false, client emits `draw` |
| `claim_window_ms` | integer | NULL, DEFAULT 5000, CHECK (`claim_window_ms` IS NULL OR `claim_window_ms` IN (5000, 10000)) | `5000`, `10000`, or **NULL = unlimited** |
| `scoring_version` | text | NOT NULL | Pin to the static scoring file `version` at create |
| `completed_at` | timestamptz | NULL | Set when status becomes `completed` |
| `created_at` | timestamptz | NOT NULL DEFAULT now() | Match created |
| `updated_at` | timestamptz | NOT NULL DEFAULT now() | Last match write |

Index on `completed_at` for the 1-hour cleanup.

Play **logic reads these columns**, not `if ruleset == taiwan`. `ruleset` is only the preset used at create (and shown in UI). The next wind copies `reference_code`, `ruleset`, `starting_score`, `scoring_version`, and **all rule columns**.

### `game.seats`

Players at the table. Rows are inserted as players **join** with `reference_code` (not four empty chairs). Next wind copies the four seated players.

| Column | Type | Constraints | Role |
| --- | --- | --- | --- |
| `id` | uuid | PRIMARY KEY | Seat row |
| `game_id` | uuid | NOT NULL, FK → `game.games.id` ON DELETE CASCADE | Match |
| `seat_index` | integer | NOT NULL | 0–3 |
| `user_id` | uuid | NOT NULL, FK → `profile.users.uuid` ON DELETE RESTRICT | Player |
| `running_score` | numeric | NOT NULL | Score after finished hands |
| `next_wind_agreed` | boolean | NOT NULL DEFAULT false | True when this player agrees to the next wind |
| `created_at` | timestamptz | NOT NULL DEFAULT now() | Joined |

UNIQUE (`game_id`, `seat_index`). **UNIQUE (`user_id`)** — one seat in the whole `game.seats` table (one live game per player). `UNIQUE (game_id, user_id)` is implied and not a separate constraint.

`next_wind_agreed` is only meaningful while `game.games.status` is `completed`. When all four seats are true, create the next wind and delete this game. Copied seats on the new game start with `next_wind_agreed = false`.

When the **fourth** player joins (`waiting`, four seats): pick `dealer_seat_index` **at random** among 0–3, set `status` to `in_progress`, create the round with `current_seat_index = dealer_seat_index` and `phase = draw`, and deal. If `auto_draw` is true, the server immediately draws for the dealer. If false, the dealer must emit socket `draw`. No host and no ready flag. For later winds, rotate dealer: `(previous_dealer_seat_index + 1) % 4`.

### `game.rounds`

Round information (source of truth). Turn and winds live here. Tiles live in child tables. Score *why* lives here; score *amounts* live in the score tables.

| Column | Type | Constraints | Role |
| --- | --- | --- | --- |
| `id` | uuid | PRIMARY KEY | Round id |
| `game_id` | uuid | NOT NULL, FK → `game.games.id` ON DELETE CASCADE | Match |
| `round_index` | integer | NOT NULL | Deal order in the match (0 for this one-hand game) |
| `status` | text | NOT NULL | `in_progress` / `completed` / `aborted` |
| `dealer_seat_index` | integer | NOT NULL | 0–3 |
| `prevailing_wind` | text | NOT NULL | Copied from `game.games.prevailing_wind` |
| `current_seat_index` | integer | NOT NULL | Whose turn |
| `phase` | text | NOT NULL | `draw` / `discard` / `claim` |
| `result_type` | text | NULL | `win` / `draw` / `abort` when finished |
| `win_kind` | text | NULL | `self_draw` / `discard` when `result_type` is `win` |
| `winner_seat_index` | integer | NULL | Winner when `result_type` is `win` |
| `discard_from_seat_index` | integer | NULL | Who discarded the winning tile (`win_kind = discard`) |
| `created_at` | timestamptz | NOT NULL DEFAULT now() | Hand started |
| `updated_at` | timestamptz | NOT NULL DEFAULT now() | Last round write |

UNIQUE (`game_id`, `round_index`).

### `game.hands`

One concealed hand per seat per round.

| Column | Type | Constraints | Role |
| --- | --- | --- | --- |
| `id` | uuid | PRIMARY KEY | Hand row |
| `round_id` | uuid | NOT NULL, FK → `game.rounds.id` ON DELETE CASCADE | Round |
| `seat_index` | integer | NOT NULL | 0–3 |
| `created_at` | timestamptz | NOT NULL DEFAULT now() | Deal |
| `updated_at` | timestamptz | NOT NULL DEFAULT now() | Last tile change |

UNIQUE (`round_id`, `seat_index`).

### `game.hand_tiles`

Each tile in a concealed hand.

| Column | Type | Constraints | Role |
| --- | --- | --- | --- |
| `id` | uuid | PRIMARY KEY | Tile instance |
| `hand_id` | uuid | NOT NULL, FK → `game.hands.id` ON DELETE CASCADE | Hand |
| `tile_code` | text | NOT NULL | Tile identity (e.g. `bam_5`, `east`) |
| `sort_index` | integer | NOT NULL | Order in the hand |
| `is_drawn` | boolean | NOT NULL DEFAULT false | The extra tile just drawn |

UNIQUE (`hand_id`, `sort_index`). Index on `hand_id`.

### `game.wall_tiles`

Remaining wall. The next draw is **MIN(`sort_index`)** (not always 0 after the first take). The highest index is the tail (kong replacement).

| Column | Type | Constraints | Role |
| --- | --- | --- | --- |
| `id` | uuid | PRIMARY KEY | Tile instance |
| `round_id` | uuid | NOT NULL, FK → `game.rounds.id` ON DELETE CASCADE | Round |
| `tile_code` | text | NOT NULL | Tile identity |
| `sort_index` | integer | NOT NULL | Order in the wall |

UNIQUE (`round_id`, `sort_index`). Index on `round_id`.

### `game.discard_tiles`

Public discards in chronological order. The last discarded tile is the row with the max `sort_index` for that `round_id`.

| Column | Type | Constraints | Role |
| --- | --- | --- | --- |
| `id` | uuid | PRIMARY KEY | Tile instance |
| `round_id` | uuid | NOT NULL, FK → `game.rounds.id` ON DELETE CASCADE | Round |
| `seat_index` | integer | NOT NULL | Who discarded (0–3) |
| `tile_code` | text | NOT NULL | Tile identity |
| `sort_index` | integer | NOT NULL | Order in this round (0…) |

UNIQUE (`round_id`, `sort_index`). Index on (`round_id`, `seat_index`).

### `game.flower_tiles`

Bonus tiles (flowers and seasons) exposed in front of a seat. Both rulesets use the 8 bonus tiles. Drawing one is 补花: move it here, then take a replacement from the wall **tail** (`MAX(sort_index)`).

| Column | Type | Constraints | Role |
| --- | --- | --- | --- |
| `id` | uuid | PRIMARY KEY | Tile instance |
| `round_id` | uuid | NOT NULL, FK → `game.rounds.id` ON DELETE CASCADE | Round |
| `seat_index` | integer | NOT NULL | Owner 0–3 |
| `tile_code` | text | NOT NULL | One of the 8 bonus codes |
| `sort_index` | integer | NOT NULL | Order in front of this seat |

UNIQUE (`round_id`, `seat_index`, `sort_index`). Index on (`round_id`, `seat_index`).

### `game.melds`

Exposed (or concealed kong) sets in front of a seat: pong, kong, chow.

| Column | Type | Constraints | Role |
| --- | --- | --- | --- |
| `id` | uuid | PRIMARY KEY | Meld row |
| `round_id` | uuid | NOT NULL, FK → `game.rounds.id` ON DELETE CASCADE | Round |
| `seat_index` | integer | NOT NULL | Owner (0–3) |
| `meld_type` | text | NOT NULL | `pong` / `kong` / `chow` |
| `is_concealed` | boolean | NOT NULL DEFAULT false | Concealed kong |
| `from_seat_index` | integer | NULL | Seat whose discard was claimed |
| `sort_index` | integer | NOT NULL | Order of melds in front of this seat |
| `created_at` | timestamptz | NOT NULL DEFAULT now() | Claimed or declared |

UNIQUE (`round_id`, `seat_index`, `sort_index`). Index on (`round_id`, `seat_index`).

### `game.meld_tiles`

Tiles that make up a meld (3 for pong/chow, 4 for kong).

| Column | Type | Constraints | Role |
| --- | --- | --- | --- |
| `id` | uuid | PRIMARY KEY | Tile instance |
| `meld_id` | uuid | NOT NULL, FK → `game.melds.id` ON DELETE CASCADE | Meld |
| `tile_code` | text | NOT NULL | Tile identity |
| `sort_index` | integer | NOT NULL | Order inside the meld |
| `is_claimed` | boolean | NOT NULL DEFAULT false | The tile taken from a discard |

UNIQUE (`meld_id`, `sort_index`). Index on `meld_id`.

### Score tables (locked shape, some values open)

Written in the same transaction as the last move, **before** `status = completed`. The result screen reads these rows for up to one hour (or until the next wind is created). Then CASCADE delete with the game. Durable totals are upserted onto `profile.user_figures` in that same end-of-hand transaction.

#### `game.round_scores`

One row per seat: net change and running total after this hand.

| Column | Type | Constraints | Role |
| --- | --- | --- | --- |
| `id` | uuid | PRIMARY KEY | Score row |
| `round_id` | uuid | NOT NULL, FK → `game.rounds.id` ON DELETE CASCADE | Round |
| `seat_index` | integer | NOT NULL | 0–3 |
| `user_id` | uuid | NOT NULL, FK → `profile.users.uuid` ON DELETE RESTRICT | Player |
| `score_delta` | numeric | NOT NULL | Net this hand (sum of payments in/out) |
| `score_after` | numeric | NOT NULL | `running_score` after applying `score_delta` |
| `score_units` | numeric | NULL | Winner’s **fan** (`hong_kong`) or **tai** (`taiwan`); null for others |
| `is_winner` | boolean | NOT NULL DEFAULT false | True for the winning seat |

UNIQUE (`round_id`, `seat_index`).

After insert, copy `score_after` onto `game.seats.running_score` for that seat.

#### `game.score_payments`

Who paid whom this hand. Child rows; no jsonb.

| Column | Type | Constraints | Role |
| --- | --- | --- | --- |
| `id` | uuid | PRIMARY KEY | Payment row |
| `round_id` | uuid | NOT NULL, FK → `game.rounds.id` ON DELETE CASCADE | Round |
| `from_seat_index` | integer | NOT NULL | Payer 0–3 |
| `to_seat_index` | integer | NOT NULL | Receiver 0–3 |
| `amount` | numeric | NOT NULL | Points transferred (positive) |

Index on `round_id`. `from_seat_index` ≠ `to_seat_index` (enforce in logic).

Empty-wall draw: **no payment rows**; all `score_delta` = 0.

Who pays (logic, not extra columns):

- Discard win (**now**): one row, `from_seat_index` = discarder, `to_seat_index` = winner.
- Self-draw (**now**): three rows, each other seat pays the winner.
- Other splits later: add more `score_payments` rows; no table change.

#### Profile figures after a hand

Upsert before the game is deleted:

| `name` | `value` |
| --- | --- |
| `games_played` | increment 1 |
| `wins` | increment 1 if `is_winner` |
| `running_score` | last `score_after` |

### Redis cache (not source of truth)

| Key | Contents |
| --- | --- |
| `game:{gameId}:round` | The `publicState` payload (game, seats, round, public tiles, scores). 24 h TTL. |
| `game:{gameId}:hand:{seat}` | `{ tiles }`: that seat's concealed hand in the `selfHand` shape. 24 h TTL. |
| `game:{gameId}:claimWindow` | Answers for the open claim / rob-kong window (`ClaimWindowState`). Saved inside the locked play transaction, deleted after it resolves. 24 h TTL. |
| Pub/sub `game:{gameId}` | Fan-out from HTTP: `gameAborted`, `gameChanged`, `nextWind` (see [`docs/socket.md`](socket.md#game-channel-redis-pubsub)). |

Write-through: after each play commit, logic writes `round` and every seat's `hand`. Reads (`snapshotForSeat`) use the cache and rebuild from Postgres on a miss. Redis errors on the round cache never fail an action. `gameChanged` deletes the cache keys before publishing. Never treat a Redis value as authoritative.

Every play transaction starts with `SELECT ... FOR UPDATE` on the `game.games` row, so two actions on the same table never interleave.

### Four winds (locked)

A complete sitting is four games: **east → south → west → north**. Each `game.games` row is one hand. No `game.sittings` table. Only one `game.games` row exists at a time.

Join: client sends `reference_code` (5-digit string) while `status` is `waiting`. A seat row is inserted with `running_score = starting_score` (0). Seat index is join order 0–3. Format fail is `invalidBody`; unknown code is `gameNotFound`.

When the fourth player joins: randomly pick `dealer_seat_index`, set `in_progress`, deal. That seat starts East (first to draw).

Next wind: the finished game stays `completed` (result screen). **All four** seats must have `next_wind_agreed = true`. Then, in one transaction (`reference_code` is UNIQUE, so the old row cannot coexist with the new one):

1. Load the finished game (`completed`, not north) and its seats into memory.
2. `DELETE` the finished `game.games`. CASCADE drops old seats, round, tiles, melds, scores, payments. Drop old Redis keys.
3. Insert a new `game.games` with the next `prevailing_wind`, the **same** `reference_code`, copied seats (`user_id`, `seat_index`, `running_score`), `next_wind_agreed = false`, dealer `(previous_dealer_seat_index + 1) % 4`. Return the new `game_id`.

North, or not all four agreed within one hour: no next game; the 1-hour rule deletes the finished row.

### Game lifetime (locked, per wind)

One hand is one `game.games` row (one wind). That game ends when **one player wins** or the **wall has no tiles left**.

Order:

1. Commit the last move. Write `game.round_scores` and `game.score_payments`. Set `win_kind` / `discard_from_seat_index` on the round.
2. Upsert `profile.user_figures` for each seated player.
3. Set `game.games.status` to `completed` and `completed_at = now()`. Broadcast. Clients still read this row. Players may set `next_wind_agreed`.
4. If all four agreed and wind is not north: **delete finished then insert** the next game (does not wait the hour; UNIQUE `reference_code`).
5. Otherwise, when `now() >= completed_at + interval '1 hour'`: `DELETE FROM game.games WHERE id = ?`. CASCADE removes children including score tables. Drop Redis keys.

Do **not** delete in the same transaction as step 1.

### Abort (locked)

A seated player may **abort** while `status` is `waiting` or `in_progress`. **Not creator-only** — any of the 1–4 seated players may call it. `completed` cannot be aborted (`gameNotAbortable`). Abort **dissolves the whole table** (not a single-player leave). There is still no leave-one-seat API.

In one transaction (`GamesLogic.abort`):

1. Caller must have a `game.seats` row for this `game_id` (`notSeated` otherwise).
2. If `in_progress`: set the round `status = aborted`, `result_type = abort`. **No** `round_scores`, **no** `score_payments`, **no** figure upserts.
3. Set `game.games.status = aborted`.
4. Redis `PUBLISH` `game:{gameId}` `{ "event": "gameAborted", "gameId" }` so the socket-server can emit `gameAborted` to room `game:{gameId}`.
5. `DELETE` the game row (CASCADE seats, round, tiles). Drop Redis game cache keys. **Seats are gone so `UNIQUE (user_id)` is free.**

Clients treat abort as “go to `/register`”. The aborted row is not kept for a result screen.

### ORM mapping (locked)

Drizzle tables in `db/schema.ts` (and the same schema imported by `socket-server`) use **camelCase** TypeScript keys. SQL names stay snake_case via the column definition (`referenceCode: text("reference_code")`) or Drizzle `casing: "snake_case"`.

Closed enum columns (`ruleset`, `status`, `phase`, `win_kind`, …) use a Drizzle column type that stores the **SQL text** from [`docs/types.md`](types.md) (`hong_kong`, `in_progress`, …) and returns the **TypeScript enum** (`Ruleset.HongKong`, `GameStatus.InProgress`). Repos insert/update/select those enums. `*Logic` never maps `hongKong` ↔ `hong_kong` or `runningScore` ↔ `running_score`.

Exception: `profile.user_figures.name` / `user_attributes.name` are **stored values** (`games_played`, `displayName`), not column identifiers. Figure **JSON keys** stay mapped in `UserLogic` (`gamesPlayed`).

Redis JSON is camelCase (already in memory). No ORM there; parse with Zod in `src/model/server`.

### Locked decisions (game)

- Postgres is the source of truth for hands and round information.
- Redis is a cache only.
- Open round rows exist from hand start (`in_progress`).
- Tables: `game.games`, `game.seats`, `game.rounds`, `game.hands`, `game.hand_tiles`, `game.round_scores`, `game.score_payments`.
- Wall, discards, and flowers are child tables: `game.wall_tiles`, `game.discard_tiles`, `game.flower_tiles`.
- Melds are `game.melds` + `game.meld_tiles`.
- No jsonb tile columns.
- Child FKs use `ON DELETE CASCADE` from `game.games` and `game.rounds`.
- `game.seats.user_id` is `ON DELETE RESTRICT`.
- Win or empty wall ends the match (one hand per game).
- Four winds = four sequential `game.games` rows; no sitting table.
- `game.games.reference_code` is a 5-digit `0`–`9` string (leading zeros kept); join while `waiting`.
- `game.games.prevailing_wind` is `east` / `south` / `west` / `north`.
- Next wind requires all four `next_wind_agreed`; then create new and delete finished.
- Finished games are deleted when the next wind starts, or **1 hour after `completed_at`**, whichever comes first.
- Write `profile.user_figures` before that delete.
- `win_kind` and `discard_from_seat_index` on `game.rounds`; payments in `game.score_payments`.
- `starting_score` is 0.
- `reference_code` is copied across the four winds. Next wind **deletes then inserts** so UNIQUE holds.
- Fourth join: random `dealer_seat_index`; auto-start East. Later winds rotate dealer.
- `game.rounds.phase` is `draw` / `discard` / `claim`.
- Empty wall: all `score_delta` 0, no payments.
- Discard win: only the discarder pays. Self-draw: the other three pay. Other **payment splits are a future feature** (still just extra `score_payments` rows; no new table now).
- Figure names: `games_played`, `wins`, `running_score`.
- Identity: keep the seated uuid until the game row is deleted; refresh the cookie while seated.
- **One seat per user:** `UNIQUE (game.seats.user_id)`. Create or join while seated → `alreadySeated`.
- **Abort:** any seated player (not creator-only), `waiting` or `in_progress` only; mark aborted; delete immediately; no scores. `completed` → `gameNotAbortable`.
- Column/enum snake_case ↔ camelCase is **Drizzle only**, before SQL is sent.
- Socket.IO: one-time Redis ticket from the cookie-authenticated HTTP API (not the raw cookie on a second origin).
- Wall draw is MIN(`sort_index`); 补花 / kong replacement is MAX(`sort_index`).
- `ruleset` is a **preset** (`hong_kong` or `taiwan`) that fills rule columns on `game.games`.
- Play logic reads `hand_tile_count`, `win_meld_count`, `score_unit`, `bonus_tiles_enabled`, `chow_only_from_previous`, `min_score_units`, `discard_win_payer`, `auto_draw`, `claim_window_ms`, `starting_score`.
- Fan/tai charts: static JSON under `src/static/ruleset/`; pin `scoring_version` on `game.games`.
- Wall is **144** tiles (same `tile_code` list for both presets).
- Each `game.*` table has one repo class and one logic class (`docs/game.md`). Repos have no business logic.

### Rulesets (locked presets)

Chosen when the east game is created. Defaults are written onto `game.games` and may be overridden there. Joiners play whatever is stored on the row.

| Column | `hong_kong` default | `taiwan` default |
| --- | --- | --- |
| `hand_tile_count` | 13 | 16 |
| `win_meld_count` | 4 | 5 |
| `score_unit` | `fan` | `tai` |
| `bonus_tiles_enabled` | true | true |
| `chow_only_from_previous` | true | true |
| `min_score_units` | 0 | 0 |
| `discard_win_payer` | `discarder` | `discarder` |
| `auto_draw` | true | true |
| `claim_window_ms` | 5000 | 5000 |
| `starting_score` | 0 | 0 |

Fan vs tai **charts are not Postgres tables**. They are static files in the Void app (see below). The game row stores `ruleset`, `score_unit`, `min_score_units`, and `scoring_version`. `discard_win_payer = all_three` is stored for the future payment-split feature; v1 still writes one payment from the discarder.

Chow / pong / kong stay on `game.melds`. No second meld schema.

### Scoring charts (static app data, locked)

Fan/tai lists are **reference data**: they change with a release, not with each sitting. Putting them in Postgres would mean migrations for every chart edit and would mix catalog data with live games.

**JSON, not YAML.** Void runs on Cloudflare Workers; JSON can be imported and parsed with **Zod** (schemas in `src/model/server`, parse in scoring logic; no YAML runtime). Comments belong in a short markdown note next to the files, not in the data file. YAML is nicer to type by hand but needs an extra parser and is easier to break on indentation.

Layout (camelCase filenames, per repo style):

- `src/static/ruleset/hongKong.json`
- `src/static/ruleset/taiwan.json`

Each file includes a `version` string (e.g. `2026-10-18`). At east-game create, copy that into `game.games.scoring_version`. End-of-hand logic loads **that** version (shipped files; keep old versions in git if a sitting outlives a deploy). A deploy must not change scoring for a game already in progress.

Logic (not the file) turns a winning hand into `round_scores.score_units` and `score_payments.amount`, using the JSON chart plus the rule columns on `game.games`.

Both files are written (pattern units, `limitUnits`, and `payout`). Hong Kong pays `basePoints × 2^min(fan, capUnits)`; Taiwan pays `base + tai × perUnit`. Self-draw: each of the other three pays that amount. Seven pairs and thirteen orphans only count where the chart lists them.

### `tile_code` (locked)

Not a table. `text` on each tile row. Four copies of each suited/honor kind; **one** of each bonus tile.

| Group | Codes | Copies |
| --- | --- | --- |
| Characters | `man_1` … `man_9` | 4 each |
| Bamboos | `bam_1` … `bam_9` | 4 each |
| Dots | `dot_1` … `dot_9` | 4 each |
| Winds | `east`, `south`, `west`, `north` | 4 each |
| Dragons | `red`, `green`, `white` | 4 each |
| Flowers | `flower_plum`, `flower_orchid`, `flower_chrysanthemum`, `flower_bamboo` | 1 each |
| Seasons | `season_spring`, `season_summer`, `season_autumn`, `season_winter` | 1 each |

Total **144** wall rows at deal.

### Open (later)

- Payment splits other than v1 — future feature.
- Cleanup of expired users who are not in a game.
- Exact fan/tai **JSON contents** (files not written yet).
