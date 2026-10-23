# Socket.IO events (planning)

Not implemented beyond `ping` / `pong`. The Node `socket-server` writes **Postgres first**, then Redis cache, then emits. Clients hydrate with HTTP `GET /api/games/:gameId` after reconnect, then attach here.

JSON fields are **camelCase**. Payloads are Zod-parsed in the **handler** (schemas in `src/model/server`; whitelist enums from [`docs/types.md`](types.md)). Domain rules stay in the `game.*` logic classes ([`docs/game.md`](game.md)). **Handlers never call a repo.** Repos: [`docs/game.md`](game.md#repo-methods-locked).

## Connection

1. HTTP `POST /api/socket-ticket` (cookie) → `{ ticket }`.
2. Connect to Socket.IO with `auth: { ticket }`. Server `GETDEL` Redis `auth:socket_ticket:{ticket}`. Invalid/expired ticket: disconnect.
3. Client emits `joinGame` with `gameId`. User must already be **seated** (HTTP join). Socket room name: `game:{gameId}`.
4. After HTTP `next-wind` returns a new `gameId`, leave the old room and `joinGame` again.

Keep `ping` / `pong` for smoke tests.

## Handlers (locked, not implemented)

Thin classes in `socket-server/src/logic/server/handler/`. One class per client event. Each: parse payload → call `*Logic` → emit from the result. No SQL, no Drizzle, no tile rules.

`SocketEvent` and `SocketError` are enums in `src/types/server` (same whitelist pattern as HTTP).

| Class | File | Client event | Calls |
| --- | --- | --- | --- |
| `SocketAuthHandler` | `socketAuthHandler.ts` | handshake `auth.ticket` | Redis `GETDEL` `auth:socket_ticket:{ticket}`. Invalid → disconnect `unauthorized`. Store `userId` on the socket. |
| `PingHandler` | `pingHandler.ts` | `ping` | Emit `pong`. No logic/repo. |
| `JoinGameHandler` | `joinGameHandler.ts` | `joinGame` | `SeatsLogic.requireSeat(userId, gameId)` → `RoundsLogic.snapshotForSeat`. Join room `game:{gameId}`. Emit `joined`, `selfHand`, `publicState`, `presence`. |
| `DrawHandler` | `drawHandler.ts` | `draw` | `RoundsLogic.draw({ gameId, userId })` |
| `DiscardHandler` | `discardHandler.ts` | `discard` | `RoundsLogic.discard({ gameId, userId, tileId })`. On success, start claim-window timer if `timeoutMs` is 5000 or 10000. |
| `ClaimHandler` | `claimHandler.ts` | `claim` | `RoundsLogic.claim({ gameId, userId, kind, tileIds })` |
| `PassClaimHandler` | `passClaimHandler.ts` | `passClaim` | `RoundsLogic.passClaim({ gameId, userId })` |
| `DeclareWinHandler` | `declareWinHandler.ts` | `declareWin` | `RoundsLogic.declareWin({ gameId, userId })` |
| `DisconnectHandler` | `disconnectHandler.ts` | disconnect | `SeatsLogic.seatIndexForUser` if seated → emit `presence` `{ connected: false }`. Do not remove the seat. |
| `GameFanoutHandler` | `gameFanoutHandler.ts` | Redis pub/sub `game:{gameId}` | Not a client event. On `{ event: gameAborted }`, stop `ClaimWindowCoordinator` for that game, emit `gameAborted` `{ gameId }` to room `game:{gameId}`, leave the room. |

`ClaimWindowCoordinator` (socket-server, not a repo): in-memory answers for the current discard. Timer from `claimWindowMs`. On timeout, call `RoundsLogic.passUnanswered(gameId)` then emit the resolve result. Unlimited (`null`): no timer. Multi-instance Redis for this window is later; v1 is one socket process.

### Handler steps (every play event)

1. Read `userId` from the socket (set at handshake). Missing → `actionError` `unauthorized`.
2. Zod-parse the payload (`gameId` uuid; `tileId` uuid; `kind` = `z.enum(MeldType)`; `tileIds` uuid array). Fail → `actionError` `invalidBody`.
3. Call the `*Logic` method. Logic opens a Postgres transaction, uses repos, commits, then Redis cache.
4. If `{ ok: false, error }` → emit `actionError` to that socket only.
5. If `{ ok: true, result }` → emit the events listed on `result` (private to seats, public to room `game:{gameId}`). Handler does not pick extra events.

`RoundsLogic` (and friends) **do not emit**. They return a result the handler turns into `SocketEvent`s.

### Result → emits

| Logic outcome | Emits |
| --- | --- |
| Join OK | `joined` (self), `selfHand` (self), `publicState` (room), `presence` `{ connected: true }` (room) |
| Draw OK (including 补花) | `drew` (self), `turn` / `publicState` (room) |
| Discard OK | `discarded` (room), `claimWindow` (room), `publicState` (room) |
| Claim window still open (claim/pass/hu recorded, not resolved) | none required; or `publicState` if we show pending — **v1: no extra event** until resolve |
| Claim resolved as meld | `claimed` (room), `selfHand` (claimer), `turn` (room), `publicState` (room) |
| Claim resolved as none | `turn` (room), `publicState` (room); if `autoDraw`, `drew` to the next seat |
| Win or empty wall | `roundEnded` (room), `publicState` (room) |
| `autoDraw` after turn → draw | `drew` to that seat, `publicState` (room) |
| Abort (HTTP `GamesLogic.abort` + Redis publish) | `gameAborted` `{ gameId }` (room), then sockets leave the room |

Wall **codes** never leave logic onto the wire.

### Per-event rules the **logic** owns (handler does not)

| Event | Logic checks (then repos) |
| --- | --- |
| `joinGame` | Seat row exists for `userId` + `gameId`. Else `notSeated`. `staleGame` if id missing. Waiting game may still join the room (spectate own waiting table); play actions need `inProgress`. |
| `draw` | `GameStatus.inProgress`, this seat, `RoundPhase.draw`, `autoDraw === false`. Else `autoDrawEnabled` / `notYourTurn` / `gameNotInProgress`. |
| `discard` | This seat, `RoundPhase.discard`, `tileId` in this hand. Then move tile hand → discard, `phase = claim`, open window. |
| `claim` | `RoundPhase.claim` **or** own turn concealed kong (`RoundPhase.discard`). `tileIds` in hand; form `MeldType`; chow only from previous if `chowOnlyFromPrevious`. Record intent until window resolves, except concealed kong which commits immediately. |
| `passClaim` | `RoundPhase.claim`. Record pass. |
| `declareWin` | Hu on discard (`claim` phase) or self-draw (`discard` phase, before discarding). |

`gameId` on the payload must match the live `game.games.id` for this sitting (`staleGame` after next-wind).

**Draw follows `game.games.auto_draw` (default true).** When `phase` becomes `draw` for a seat: if `auto_draw` is true, the server takes the wall immediately; if false, that seat must emit `draw`. 补花 (flower then tail replacement) is always part of the same draw action, not a separate event.

**Claim window follows `game.games.claim_window_ms`:** only `5000`, `10000`, or **NULL (unlimited)**. Default `5000`. If a number, unanswered seats **pass** when it elapses. If NULL, wait until every other seat has `claim`, `passClaim`, or `declareWin` — no timer.

## Client → server

| Event | Payload | When |
| --- | --- | --- |
| `ping` | none | Smoke test |
| `joinGame` | `{ gameId }` | After connect / after next wind |
| `draw` | `{ gameId }` | `phase === draw`, this seat’s turn, and `auto_draw` is **false** |
| `discard` | `{ gameId, tileId }` | `phase === discard` and it is this seat’s turn. `tileId` is `game.hand_tiles.id` (not `tileCode` alone). |
| `claim` | `{ gameId, kind: MeldType, tileIds: string[] }` | `phase === claim` (or own-turn concealed kong). `kind` is whitelisted with `MeldType` (`chow` \| `pong` \| `kong`). `tileIds` are this player’s hand tile ids used in the meld (2 for chow, 2 for pong, 3 for kong off discard, 4 for concealed kong on own turn). |
| `passClaim` | `{ gameId }` | Decline the current claim window. |
| `declareWin` | `{ gameId }` | Hu on the last discard (`phase === claim`) or on the self-drawn tile (`phase === discard` before discarding). |

`gameId` on action events lets the server ignore stale rooms after next-wind.

Concealed kong / added kong: still `claim` with `kind: "kong"` while it is your turn (`phase === discard`), not during someone else’s claim window. Logic distinguishes.

## Server → that player (private)

| Event | Payload | Meaning |
| --- | --- | --- |
| `pong` | none | Reply to `ping` |
| `joined` | `{ gameId, seatIndex }` | `joinGame` accepted |
| `selfHand` | `{ tiles: { tileId, tileCode, sortIndex, isDrawn }[] }` | Full concealed hand (join, reconnect, after meld) |
| `drew` | `{ tile: { tileId, tileCode, isDrawn: true }, wallCount, flowers: { tileCode }[] }` | Private draw. Each `flowers` entry was set aside by 补花 in this draw (several can chain); `tile` is the final replacement. |
| `actionError` | `{ error }` | Same enum style as HTTP (`notYourTurn`, `invalidTile`, …) |

## Server → room (public)

| Event | Payload | Meaning |
| --- | --- | --- |
| `publicState` | Snapshot minus other hands: seats, phase, currentSeatIndex, wallCount, discards, melds, flowers, nextWindAgreed | After join and after any mutating action |
| `discarded` | `{ seatIndex, tileCode, tileId }` | A discard was committed |
| `claimWindow` | `{ discardSeatIndex, tileCode, timeoutMs }` | `timeoutMs` is `5000`, `10000`, or `null` (unlimited) |
| `claimed` | `{ seatIndex, kind, tileCodes[] }` | Meld committed |
| `turn` | `{ currentSeatIndex, phase }` | Turn or phase changed |
| `roundEnded` | `{ resultType, winKind, winnerSeatIndex, scores, payments }` | Hand finished; HTTP `GET` still works until delete |
| `presence` | `{ seatIndex, connected }` | Socket connect/disconnect; seat stays |
| `gameAborted` | `{ gameId }` | Table dissolved; clients `visit` `/register`. Room is empty after this. |

Wall **codes** are never emitted. `claimWindow.timeoutMs` is the game’s `claim_window_ms` (`null` = unlimited).

## Claim window (logic)

After `discard`:

1. Emit `discarded` + `claimWindow`.
2. Collect `declareWin` / `claim` / `passClaim` until all other seats have answered, or until `claim_window_ms` elapses when it is 5000 or 10000 (unanswered = pass). If `claim_window_ms` is NULL, do not time out.
3. Resolve in order: **win > kong > pong > chow**. Chow only if `chowOnlyFromPrevious` allows that seat.
4. Winner → score tables, `roundEnded`, `games.status = completed`.
5. Else meld → `claimed`, turn goes to claimer, `phase = discard` (they already have the extra tile).
6. Else next seat, `phase = draw`, emit `turn`. If `auto_draw`, server draws and emits `drew`; if not, wait for `draw`.

## Errors (socket)

| `error` | When |
| --- | --- |
| `unauthorized` | Bad or missing ticket |
| `notSeated` | `joinGame` for a game you did not HTTP-join |
| `gameNotInProgress` | Waiting or already completed |
| `notYourTurn` | Discard, draw, or kong when it is not that seat’s phase |
| `autoDrawEnabled` | Client sent `draw` while `auto_draw` is true |
| `invalidTile` | `tileId` not in this hand |
| `invalidClaim` | Tiles do not form the kind, or chow not from previous |
| `noClaimWindow` | `passClaim`, or a discard-claim, while `phase !== claim`. Own-turn concealed/added kong is `claim` during `phase === discard` and must **not** use this error (`notYourTurn` / `invalidClaim` instead). |
| `staleGame` | `gameId` does not match the live row (after next-wind or abort delete) |
| `gameNotAbortable` | (HTTP) Abort while `completed`. Not a play-event `actionError` in v1; abort is HTTP. |

## Enums (`src/types/server`)

`SocketEvent` (event names) and `SocketError` (`actionError.error`) live next to the other server enums. `invalidBody` is reused from `ApiError` when Zod fails.

```ts
export enum SocketEvent {
  Ping = "ping",
  Pong = "pong",
  JoinGame = "joinGame",
  Joined = "joined",
  Draw = "draw",
  Discard = "discard",
  Claim = "claim",
  PassClaim = "passClaim",
  DeclareWin = "declareWin",
  SelfHand = "selfHand",
  Drew = "drew",
  PublicState = "publicState",
  Discarded = "discarded",
  ClaimWindow = "claimWindow",
  Claimed = "claimed",
  Turn = "turn",
  RoundEnded = "roundEnded",
  Presence = "presence",
  GameAborted = "gameAborted",
  ActionError = "actionError",
}

export enum SocketError {
  Unauthorized = "unauthorized",
  InvalidBody = "invalidBody",
  NotSeated = "notSeated",
  GameNotInProgress = "gameNotInProgress",
  NotYourTurn = "notYourTurn",
  AutoDrawEnabled = "autoDrawEnabled",
  InvalidTile = "invalidTile",
  InvalidClaim = "invalidClaim",
  NoClaimWindow = "noClaimWindow",
  StaleGame = "staleGame",
}
```

## Locked (socket)

- One handler class per client event. Handlers parse, call `*Logic`, emit. **No repos in handlers.**
- `*Logic` returns a result; it does not emit Socket.IO events.
- `auto_draw` and `claim_window_ms` come from `game.games` (create-time settings; copied next wind).
- Default `auto_draw = true`, `claim_window_ms = 5000` (allowed: 5000, 10000, or NULL unlimited).
- Timed window: unanswered = pass. Unlimited: wait for every other seat.
- Claim-window timer lives in the socket process (`ClaimWindowCoordinator`), not in a repo.
- Abort is HTTP (`POST .../abort`). Socket-server **subscribes** to Redis `game:{gameId}` and emits `gameAborted`; it does not take an `abortGame` client event.
