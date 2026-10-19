# Client pages (planning)

Not implemented. HTTP: [`docs/api.md`](api.md). Socket: [`docs/socket.md`](socket.md). Enums: [`docs/types.md`](types.md). Vue stays view-only ([`.cursor/skills/coding-style/SKILL.md`](../.cursor/skills/coding-style/SKILL.md)).

Two UI routes. Mutations go through `/api/*` and Socket.IO, **not** Void page `action`s. Pages do not call repos or server `*Logic` except the loader **redirect** path below.

## Routes (locked)

| URL | Files | UI |
| --- | --- | --- |
| `/register` | `pages/register.vue`, `pages/register.server.ts` | Name, create table, join by `referenceCode` |
| `/game/[uuid]` | `pages/game/[uuid].vue`, `pages/game/[uuid].server.ts` | Waiting table, play, round result. Param `uuid` is `game.games.id` (`gameId` on the wire). |

`/` is **not** a third screen. `pages/index.server.ts` always `redirect`s to `/register`. Keep a minimal `pages/index.vue` so Void has a page file.

Client navigation uses `@void/vue` `Link` / `useRouter().visit`. After create, join, or next-wind, visit `/game/{gameId}`. Invite is the **5-digit `referenceCode`**, not the game URL (unseated `/game/{uuid}` redirects to `/register` and drops the uuid).

```text
GET /                → /register
GET /register        → /game/{id} if cookie session has currentGame
GET /game/{uuid}     → /register if no live session
                     → /game/{currentGame.gameId} if seated elsewhere
                     → /register if session but not seated (must join first)
```

Loaders **do not mint** identity (`POST /api/session` only). First visit: no cookie, register SSR, client `AuthLogic.ensureSession()` after mount.

## SSR then hydrate (locked)

Loaders return **static** props only: enum option lists, create-game defaults, `socketOrigin`, and on the game page the path `uuid`. No hands, discards, seats, or profile in props.

Live data loads **after mount** through client `*Logic` + `fetch` / socket. Parse every request body and every response / event with Zod schemas in **`src/model/server`**.

Vue `hydrated` stays false until that bootstrap finishes, then a lazy panel mounts (`v-if="hydrated"`). That avoids SSR mismatch and keeps the first HTML to chrome + labels.

Default Void `ssr` stays **on** for that chrome. Do not set `ssr = false` on these routes.

### Register loader props

From `src/types/server` enums (not from Postgres):

- `rulesets`: `hongKong`, `taiwan`
- `claimWindowMsOptions`: `5000`, `10000`, `null` (unlimited)
- `scoreUnits`: `fan`, `tai`
- `discardWinPayers`: `discarder`, `allThree`
- `defaults`: `{ autoDraw: true, claimWindowMs: 5000 }` (same presets as `GamesLogic`)

### Game loader props

- `uuid` from the route param
- `socketOrigin` from env (Void `:5173` vs Socket.IO `:3001`)
- Same enum lists as register so waiting/result labels do not hard-code strings

Loader redirect may use **server** `AuthLogic.resolveSession({ createIfMissing: false })` + `UserLogic.loadProfile` when those exist. It still must not put the game snapshot on the page props.

## Layering (locked)

```text
pages/*.vue  (view only)
  → page *Logic class
      → AuthLogic / GamesLogic / SocketLogic / PlayLogic
          → ApiClient (fetch, cookie)
          → socket.io-client
          → src/model/server  (Zod parse in and out)
      → src/model/client  (read-only model or interactive view model)
  → lazy src/component/*  (view only)
```

- **No business rules in `.vue`.** No `fetch`, no Zod, no socket subscribe in a component.
- **No client repos.** HTTP and the socket are the I/O.
- Client `*Logic` does not emit DOM events and does not import `.vue` files.
- Closed field values stay the **server enums**. Client logic does not re-whitelist after a successful parse.

## Client logic classes (locked)

Classes under `src/logic/client/`. Construct on the client after mount (not in the loader).

| Class | File | Owns |
| --- | --- | --- |
| `ApiClient` | `http/apiClient.ts` | `fetch` with `credentials: "include"`. Parse envelope with `src/model/server`. Map HTTP status + `error` enum. No domain rules. |
| `AuthLogic` | `auth/authLogic.ts` | `POST /api/session`, `GET/PATCH /api/me`, `POST /api/socket-ticket`. Parse with server models. Fill `PlayerProfileModel`. |
| `GamesLogic` | `game/gamesLogic.ts` | `POST /api/games`, `POST /api/games/join`, `GET /api/games/:gameId`, `POST .../next-wind`, `POST .../abort`. Parse snapshot / errors. |
| `SocketLogic` | `game/socketLogic.ts` | Ticket handshake `auth: { ticket }`, `joinGame`, emit play events, subscribe. Parse payloads with server models. Does not decide legal moves. |
| `PlayLogic` | `game/playLogic.ts` | Apply `publicState` / `selfHand` / `drew` / `discarded` / `claimWindow` / `claimed` / `turn` / `roundEnded` / `presence` onto client models. Map UI intent → socket payload (`tileId`, `kind`, `tileIds`). Local enable/disable (phase + seat) for buttons; **server stays authoritative**. |
| `RegisterLogic` | `register/registerLogic.ts` | Register page flow: ensure session, require `displayName` before create/join, call `GamesLogic`, tell the page to `visit` `/game/{gameId}`. |
| `GamePageLogic` | `game/gamePageLogic.ts` | Game page flow: `GET /api/me` then snapshot, pick panel from `GameStatus`, connect socket when `waiting` or `inProgress`, reconnect, next-wind then `visit` the new uuid, **abort** then `visit` `/register`. On `gameAborted`, `gameNotFound`, `notSeated`, or `staleGame`: `visit` `/register`. Skip socket when `completed`. |

`RegisterLogic` / `GamePageLogic` are the only types pages construct. They hold the other classes.

Page bootstrap (both routes):

1. `AuthLogic.ensureSession()` (`POST /api/session`).
2. `AuthLogic.loadProfile()` (`GET /api/me`).
3. Register: stop if no `displayName`; otherwise create/join as the player submits. If `currentGame` is set, `visit` that game (covers a loader that could not redirect).
4. Game: `GamesLogic.loadSnapshot(uuid)`. Mismatch / `notSeated` / `unauthorized` → `visit` `/register` or the seated `gameId`. Then `PlayLogic.applySnapshot` and, if not `completed`, ticket + `SocketLogic.connect` + `joinGame`.

## Wire models (`src/model/server`)

Source of truth for **request and response** JSON (HTTP and socket). Client send path: view model → `*Logic` builds a payload → Zod parse → `fetch` / emit. Receive path: unknown JSON → Zod parse → `*Logic` maps into `src/model/client`.

Do not duplicate these shapes under `src/model/client`. Client models are for UI, not for the wire.

| File | Guards |
| --- | --- |
| `envelope.ts` | `{ status: success, data }` / `{ status: failed, error: ApiError }` |
| `session.ts` | `POST /api/session` success `data` (`userId`) |
| `me.ts` | `GET/PATCH /api/me` body + `data` (profile, `currentGame`) |
| `socketTicket.ts` | `POST /api/socket-ticket` `data` (`ticket`) |
| `createGame.ts` | `POST /api/games` body (enum whitelist + optional overrides) |
| `joinGame.ts` | `POST /api/games/join` body (`referenceCode` string) |
| `gameSnapshot.ts` | create / join / GET / next-wind `data` |
| `nextWind.ts` | next-wind success (new snapshot) vs `northComplete` |
| `abortGame.ts` | `POST .../abort` success `{ aborted: true }` |
| `socket/joinGame.ts` | `{ gameId }` |
| `socket/discard.ts` | `{ gameId, tileId }` |
| `socket/claim.ts` | `{ gameId, kind: MeldType, tileIds }` |
| `socket/selfHand.ts` | `selfHand` tiles |
| `socket/drew.ts` | private draw |
| `socket/publicState.ts` | room snapshot minus other hands |
| `socket/actionError.ts` | `{ error: SocketError }` |
| `socket/…` | remaining events in [`docs/socket.md`](socket.md) |

`ApiClient` always parses the envelope first, then the `data` schema for that route. Socket handlers parse with the event schema; fail → ignore that event (do not crash the table).

## Client models vs view models (`src/model/client`)

**Model** = read-only. Replace on hydrate / socket apply. Vue binds it; the player does not edit it in place.

**View model** = interactive. Inputs, selection, pending, local field errors. Logic writes it; Vue binds it.

| Kind | Type | File |
| --- | --- | --- |
| Model | `PlayerProfileModel` | `playerProfileModel.ts` |
| Model | `GameSnapshotModel` | `gameSnapshotModel.ts` |
| Model | `SeatModel` | `seatModel.ts` |
| Model | `HandTileModel` | `handTileModel.ts` |
| Model | `PublicTilesModel` | `publicTilesModel.ts` |
| Model | `RoundModel` | `roundModel.ts` |
| Model | `ScoreboardModel` | `scoreboardModel.ts` |
| View model | `RegisterViewModel` | `registerViewModel.ts` |
| View model | `CreateGameViewModel` | `createGameViewModel.ts` |
| View model | `JoinGameViewModel` | `joinGameViewModel.ts` |
| View model | `WaitingViewModel` | `waitingViewModel.ts` |
| View model | `PlayViewModel` | `playViewModel.ts` |
| View model | `RoundResultViewModel` | `roundResultViewModel.ts` |

`CreateGameViewModel` starts from loader `defaults`. Optional overrides are omitted on the wire until the player changes them (server applies presets).

`PlayViewModel` holds `selectedTileIds`, pending action, and a **display** countdown for `claimWindow.timeoutMs` (5000 / 10000). `null` timeout → no local timer. Expiry is still the socket server; the countdown is UX only.

`RegisterLogic` does not create/join until `displayName` is saved (`PATCH /api/me`, length 1–32 after trim — same rule as `UserLogic`, no regex).

`JoinGameViewModel` holds a 5-character string. `RegisterLogic` allows send only when length is 5 and every character is `0`–`9` (char range, **no regex**). Wire value stays a string (`"04217"`). Format fail stays local until send; if the server still rejects, `invalidBody` or `gameNotFound` lands on the view model.

Create-form optional numbers (`handTileCount`, `winMeldCount`, `minScoreUnits`) are omitted on the wire until the player changes them. Client Zod checks JSON type (`number`) only. Min/max stay in server `GamesLogic` (still open there). No `pages/layout.vue` this slice.

Show `ApiError` / `SocketError` enum strings on the view model (`error`). Do not invent parallel UI error codes.

## Pages and lazy components (locked)

`pages/*.vue`: props, construct page logic, `hydrated` / panel refs, watchers, handlers that only call logic. Templates bind models and view models.

Lazy-load panels with Vue `defineAsyncComponent` + dynamic `import()`. Nested table widgets are lazy from `PlayTable`, not from the page.

### `/register`

Always-visible chrome from SSR (title, name field labels). After hydrate:

| When | Lazy component |
| --- | --- |
| Session ready, no `displayName` | `src/component/register/displayNameForm.vue` |
| `displayName` set, no `currentGame` | `createGameForm.vue` and `joinGameForm.vue` |

Submit name → `RegisterLogic.saveDisplayName`. Create → `createGame` then `visit`. Join → `joinGame` then `visit`.

### `/game/[uuid]`

SSR: table chrome, `uuid` unused in the visible tree until hydrate. Panel from `GameStatus`:

| `GameStatus` | Panel enum (`src/types/client`) | Lazy component |
| --- | --- | --- |
| `waiting` | `GamePanel.Waiting` | `src/component/game/waitingTable.vue` |
| `inProgress` | `GamePanel.Play` | `playTable.vue` |
| `completed` | `GamePanel.Result` | `roundResult.vue` |

`northComplete` stays on result with next-wind disabled. `aborted` is not a panel: the row is deleted; the page `visit`s `/register`.

`waitingTable.vue` shows the 5-digit `referenceCode`, seats, `displayName`s, presence. Copy code is view-model state. **Abort** (not leave-one-seat) calls `GamesLogic.abort` and dissolves the table for everyone.

`playTable.vue` lazy-loads:

- `handTiles.vue` — own concealed hand (`HandTileModel`). Face is the **`tileCode` text** (`bam_5`, `east`, …), not an image.
- `discardArea.vue`
- `meldArea.vue`
- `flowerArea.vue`
- `claimBar.vue` — claim / pass / hu during the window
- `turnBanner.vue`
- `seatRail.vue` — four seats, scores, presence

Play actions (only through `PlayLogic` → `SocketLogic`): `draw` if `autoDraw === false`, `discard`, `claim`, `passClaim`, `declareWin`. `discard` / `claim` always include `gameId` (the page `uuid`). **Abort** on the play table is HTTP (`GamesLogic.abort`), same as waiting.

`roundResult.vue`: `ScoreboardModel`, next-wind control. All four agree → response has a **new** `gameId` → `GamePageLogic` `visit`s `/game/{newId}` (socket leaves the old room on the next page’s `joinGame`).

## Client types (`src/types/client`)

UI-only. Do not copy server enums.

| Enum / type | Use |
| --- | --- |
| `GamePanel` | `waiting` / `play` / `result` |
| Panel/input helpers | selected-tile lists, pending flags |

Wire enums stay in `src/types/server` and are imported by client logic and `src/model/server` Zod schemas.

## Files (not written)

```text
pages/index.server.ts              # redirect / → /register
pages/register.vue
pages/register.server.ts
pages/game/[uuid].vue
pages/game/[uuid].server.ts

src/logic/client/http/apiClient.ts
src/logic/client/auth/authLogic.ts
src/logic/client/game/gamesLogic.ts
src/logic/client/game/socketLogic.ts
src/logic/client/game/playLogic.ts
src/logic/client/game/gamePageLogic.ts
src/logic/client/register/registerLogic.ts

src/model/server/…                 # HTTP + socket Zod
src/model/client/…                 # models + view models

src/component/register/…
src/component/game/…

src/types/client/gamePanel.ts
```

Tile faces are `tileCode` text on every tile widget (hand, discard, meld, flower, draw). Image art under `src/static/` is later; do not block play on it.

## Locked (this slice)

- Two UI pages: `/register` and `/game/[uuid]`. `/` redirects to `/register`.
- SSR = static options + chrome. Live profile/game/tiles hydrate on the client.
- Loaders may redirect from the session cookie; they do not mint a session and do not pass snapshots as props.
- Client uses **logic classes** under `src/logic/client`. Vue does not fetch, parse, or speak socket.
- Guard send and receive with Zod in `src/model/server`.
- Read-only UI data = **model**; forms/selection/pending = **view model**; both under `src/model/client`.
- Feature panels and play widgets are **lazy** `defineAsyncComponent`s under `src/component/`.
- Join still happens on `/register` (`POST /api/games/join`). The game page is seated-only.
- `referenceCode` is a 5-digit `0`–`9` string (client and server; no regex).
- One seat per user (server). Abort on waiting and play dissolves the table (`POST .../abort`); no single-player leave.
- Tile widgets render `tileCode` as text.
- No root `pages/layout.vue` this slice.
- Create-form integers: type only on the client; domain limits stay in `GamesLogic`.

## Open (client)

- Tile **image** art under `src/static/` (text faces until then).
