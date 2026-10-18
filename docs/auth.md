# Auth and player identity (planning)

Not implemented. Tables: [`docs/database.md`](database.md). HTTP shapes: [`docs/api.md`](api.md). This document locks **server logic** for register, session resolve, profile, and socket tickets.

Routes stay thin. Postgres I/O lives in **repo classes**. Domain rules live in **logic classes**. Zod parses unknown input at boundaries (HTTP body, Redis JSON). Domain rules are not Zod refinements.

This slice uses **classes** for the four types below. Cookie/envelope helpers stay small functions under `src/logic/server/http/` (called from routes). Wire Zod schemas live in `src/model/server`; logic **calls** parse.

---

## Layering (locked)

| Class | Path | Owns |
| --- | --- | --- |
| `AuthRepo` | `src/logic/server/auth/authRepo.ts` | Postgres I/O for `auth.sessions` only |
| `UserRepo` | `src/logic/server/user/userRepo.ts` | Postgres I/O for `profile.users`, `profile.user_attributes`, `profile.user_figures` |
| `AuthLogic` | `src/logic/server/auth/authLogic.ts` | Token mint/hash, identity window, resolve/create session, socket ticket, seated exception |
| `UserLogic` | `src/logic/server/user/userLogic.ts` | Load profile, upsert attributes, display-name / attribute rules, map figures to JSON |

```text
route
  → AuthLogic / UserLogic
      → AuthRepo / UserRepo   (Postgres)
      → Redis helpers         (cache / ticket; not a repo)
```

- **No business logic in a repo.** Repos only insert, find, update, and delete rows. They do not decide expiry, seating, display-name rules, or cookie/Redis policy. They do not call logic classes, other repos, or Redis.
- Logic classes do **not** embed SQL or Drizzle table access. They call repos (and Redis helpers).
- Redis is cache, not source of truth. Session cache and socket tickets are used by `AuthLogic`, not `AuthRepo`.
- HTTP cookie read/write stays in `src/logic/server/http/sessionCookie.ts` (route adapter). Logic receives a raw token string and returns whether to set a cookie.

Construct per request (Workers): `new AuthLogic(authRepo, userRepo)` and `new UserLogic(userRepo)`. Pass a Redis client into `AuthLogic` (or a thin redis helper) for cache and tickets.

`game.seats` is not a user/auth table. `AuthLogic.userIsSeated` uses `SeatsRepo.findByUserId` (empty list = not seated). `UserRepo` does not query seats. Game class list: [`docs/game.md`](game.md).

---

## Who mints identity

| Route | Calls | Session behavior |
| --- | --- | --- |
| `POST /api/session` | `AuthLogic.resolveSession({ createIfMissing: true })` | **Create or resolve.** No cookie, dead cookie, or expired identity → insert user + session, set cookie, return `userId`. Valid cookie → same `userId`, rewrite cookie max-age. |
| `GET /api/me` | `AuthLogic.resolveSession({ createIfMissing: false })` then `UserLogic.loadProfile` | **Require.** Missing or dead session → `unauthorized` (401). Do not mint. |
| `PATCH /api/me` | Same require, then `UserLogic.upsertAttributes` | |
| `POST /api/socket-ticket` | Same require, then `AuthLogic.mintSocketTicket` | |
| Later game routes | Same require path | |

`POST /api/session` is the only register path. First visit in the client workflow is always that call.

---

## Planned files (not written)

| Path | Role |
| --- | --- |
| `src/types/server/api.ts` | `ApiStatus`, `ApiError`, `HttpStatus`, envelope types |
| `src/types/server/auth.ts` | Cookie name, resolve input/result |
| `src/types/server/profile.ts` | `displayName`, figure name mapping, `ProfileResponse` |
| `src/types/server/redis.ts` | Redis key prefixes |
| `src/model/server/sessionCache.ts` | Cached `{ userId, sessionId }` |
| `src/model/server/playerProfile.ts` | User + attribute rows + figure rows before API mapping |
| `src/logic/server/auth/authRepo.ts` | `class AuthRepo` |
| `src/logic/server/auth/authLogic.ts` | `class AuthLogic` |
| `src/logic/server/user/userRepo.ts` | `class UserRepo` |
| `src/logic/server/user/userLogic.ts` | `class UserLogic` |
| `src/logic/server/http/sessionCookie.ts` | Read/write the httpOnly cookie |
| `src/logic/server/http/envelope.ts` | Success / failed JSON |
| `src/logic/server/http/readJsonBody.ts` | Parse JSON or `invalidBody` |
| `src/logic/server/redis/client.ts` | Redis commands used by the Worker |
| `src/logic/server/redis/sessionCache.ts` | `GET` / `SET EX` / `DEL` `auth:session:{tokenHash}` |
| `src/logic/server/redis/socketTicket.ts` | `SET EX` `auth:socket_ticket:{ticket}` |
| `routes/api/session.ts` | `POST` only |
| `routes/api/me.ts` | `GET` + `PATCH` |
| `routes/api/socket-ticket.ts` | `POST` only |

SQL schemas stay in `db/` when implementation starts. Redis **infra** stays in `redis/`; the client stays under `src/logic/server`.

---

## Class methods (locked)

Method names are camelCase. Bodies are not implemented.

### `AuthRepo`

Postgres `auth.sessions` only. Optional transaction so `AuthLogic` can insert user + session atomically. **I/O only** — `AuthLogic` chooses when to write `isExpired` or `lastSeenAt`.

| Method | I/O |
| --- | --- |
| `insert` | `INSERT` session row |
| `findById` | `SELECT` by `id` |
| `findByTokenHash` | `SELECT` by `token_hash` |
| `update` | `UPDATE` columns the caller passes (`isExpired`, `lastSeenAt`, `updatedAt`, …) |

### `UserRepo`

Postgres `profile.*` only. Same optional transaction. **I/O only** — no trim/length checks, no figure JSON keys, no `game.seats`.

| Method | I/O |
| --- | --- |
| `insert` | `INSERT` `profile.users` |
| `findByUuid` | `SELECT` by `uuid` |
| `listAttributes` | `SELECT` `user_attributes` for `user_id` |
| `listFigures` | `SELECT` `user_figures` for `user_id` |
| `upsertAttribute` | `INSERT` … `ON CONFLICT (user_id, name) DO UPDATE value` |

### `AuthLogic`

Depends on `AuthRepo`, `UserRepo`, Redis helpers. Seated exception: `SeatsRepo`.

| Method | Behavior |
| --- | --- |
| `resolveSession({ rawToken, createIfMissing, now })` | Cookie → live session, or mint if allowed (see below) |
| `mintSocketTicket(userId)` | Random ticket, Redis `SET EX 60`; `undefined` / fail → `redisUnavailable` |
| `createPlayer(now)` | Private. One transaction: `userRepo.insert` then `authRepo.insert` |
| `hashToken` / `randomToken` | Private. SHA-256 hex; 32-byte base64url |
| `isPastIdentityWindow` / `sessionTtlSeconds` | Private. 1 day from `users.created_at`; 3600s if seated past deadline |
| `userIsSeated(userId)` | Private. `SeatsRepo.findByUserId`; non-empty = seated |

### `UserLogic`

Depends on `UserRepo`. `currentGame` uses `SeatsLogic` (and game mapping in that logic) when those tables exist. Do not read `GamesRepo` from `UserLogic`.

| Method | Behavior |
| --- | --- |
| `loadProfile(userId)` | Attributes map, camelCase figures, `currentGame` (`null` until game tables) |
| `upsertAttributes(userId, attributes)` | `normalizeAttributes` first, then `userRepo.upsertAttribute` per entry; return `loadProfile` |
| `normalizeAttributes` | Private. `displayName` trim 1–32; other names 1–64 / values 1–256 |

---

## Token and cookie

The server mints the token (`AuthLogic`). Never accept a client-invented token as identity.

| Item | Locked value |
| --- | --- |
| Raw token | 32 random bytes, **base64url** (cookie-safe) |
| Stored credential | SHA-256 of the raw token, lowercase hex, column `auth.sessions.token_hash` |
| Cookie name | `session` |
| Cookie flags | `HttpOnly`; `Path=/`; `SameSite=Lax`; `Secure` only on `https` |
| Cookie `Max-Age` | Seconds left until `users.created_at + 1 day`, or **3600** if still seated after that deadline |

One session per user (`UNIQUE user_id`). Insert user first, then session, in one transaction owned by `AuthLogic`.

---

## `AuthLogic.resolveSession`

Input: raw cookie string (maybe missing), `createIfMissing`, `now`.

### Valid existing token

1. Hash the raw token.
2. `GET` Redis `auth:session:{tokenHash}`. Value is JSON `{ userId, sessionId }` (camelCase). Parse with Zod. Corrupt value = miss.
3. Redis hit: `authRepo.findById` + `userRepo.findByUuid`. Require `token_hash` and `user_id` to match. Mismatch = dead.
4. Redis miss: `authRepo.findByTokenHash`, then `userRepo.findByUuid`.
5. If `is_expired` is true: drop Redis key; treat as dead.
6. If `now >= created_at + 1 day` **and** not seated: `authRepo.update({ isExpired: true })`, drop Redis key; treat as dead.
7. If past the 1-day window **and** seated: keep this uuid; do not set `is_expired`; `refreshCookie = true`; TTL 3600 seconds.
8. Else: still valid. `authRepo.update({ lastSeenAt: now })`. Refill Redis with TTL = seconds left in the window (at least 1). `refreshCookie` is false unless step 7.

The 1-day clock is **`profile.users.created_at`**. It does not slide on activity.

### Dead or missing token

- `createIfMissing` false → `{ error: unauthorized, status: 401 }`.
- `createIfMissing` true → `createPlayer`, write Redis, `refreshCookie` true.

Redis failure on session cache must **not** fail HTTP. Postgres is source of truth. Skip cache read/write and continue.

---

## Profile (`UserLogic`)

### `GET /api/me`

After a required session:

- `userId`
- `attributes`: map of stored `name` → `value` (includes `displayName` when set)
- `figures`: only locked names, **camelCase in JSON**
  - `games_played` → `gamesPlayed`
  - `wins` → `wins`
  - `running_score` → `runningScore`
  - numeric strings from Postgres become JSON numbers; missing keys omitted
- `currentGame`: `null` if not in `game.seats`; else `{ gameId, referenceCode, status, prevailingWind, ruleset, seatIndex }` with `ruleset` camelCase (`hongKong` / `taiwan`). At most **one** seat per user (`UNIQUE user_id`).

### `PATCH /api/me`

Body (Zod, structure only): `{ "attributes": { "<name>": "<value>" } }`.

Domain rules in `UserLogic.normalizeAttributes`:

| Key | Rule |
| --- | --- |
| `displayName` | Trim. Length **1–32**. Store trimmed value. |
| Any other name | Names stay open. Name length 1–64. Value length 1–256. Store as sent. |
| Fail any rule | `invalidBody` (422). No extra error code. |

Upsert on `(user_id, name)` via `UserRepo`. Empty `attributes` object is a no-op success. Response is the same shape as GET.

Do not use regex for display names.

---

## Socket ticket (`AuthLogic.mintSocketTicket`)

After a required session:

1. Mint a new random token (same generator as the session token; this is **not** the session cookie).
2. `SET` Redis `auth:socket_ticket:{ticket}` = `userId` (uuid string), `EX 60`.
3. Return `{ ticket }`.

Socket.IO later `GETDEL`s that key (see [`docs/socket.md`](socket.md)).

If Redis cannot store the ticket: `redisUnavailable` (503). Session HTTP still works without Redis; the handshake cannot.

---

## Envelope and errors (this slice)

Routes return:

```json
{ "status": "success", "data": { } }
```

```json
{ "status": "failed", "error": "unauthorized" }
```

| `error` | HTTP | When |
| --- | --- | --- |
| `unauthorized` | 401 | Require-session path, no live session |
| `invalidBody` | 422 | Zod fail, or attribute domain fail |
| `redisUnavailable` | 503 | Socket ticket could not be written |

`redisUnavailable` is new on the HTTP error list (ticket only). Other API errors stay as in [`docs/api.md`](api.md).

---

## Redis keys (auth)

| Key | Value | TTL |
| --- | --- | --- |
| `auth:session:{tokenHash}` | JSON `{ "userId", "sessionId" }` | Remaining identity window, or 3600s if seated past 1 day |
| `auth:socket_ticket:{ticket}` | `userId` uuid string | 60s |

---

## Worker constraint (when implementing)

Void HTTP runs on Cloudflare Workers. The Redis client in `src/logic/server/redis` must work in workerd (TCP via `cloudflare:sockets`, or equivalent). The Node `redis` package in `socket-server/` is for the Socket.IO process only.

`nodejs_compat` on the Worker is expected for that client.

---

## Locked (this slice)

- Four classes: `AuthRepo`, `UserRepo`, `AuthLogic`, `UserLogic`. **Repos have no business logic** — Postgres I/O only. Logic = rules and orchestration.
- Redis cache/tickets are used by `AuthLogic`, not stored in `AuthRepo`.
- `game.seats` is not queried by `UserRepo`. Seated check is `AuthLogic` → `SeatsRepo`.
- Register is `POST /api/session` only. Other routes require a live session.
- Cookie name is `session`.
- Raw token is 32-byte base64url; Postgres stores SHA-256 hex only.
- Identity window is 1 day from `profile.users.created_at`, unless `game.seats` still has this user.
- Seated past that window: keep uuid, refresh cookie, Redis TTL 3600s.
- `displayName` is 1–32 after trim.
- Figure JSON keys are camelCase; SQL `name` values stay `games_played` / `wins` / `running_score`.
- Redis down: session still resolves from Postgres; socket ticket fails with `redisUnavailable`.

## Open (auth)

- Cleanup of expired users who are not seated (already open on the database slice).
- Exact Redis client library for Workers (sockets vs REST) — pick at implementation time.
