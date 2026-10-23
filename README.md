## Local development

Void reads **only** `.env` (no `.env.example` or `.env.local`).

### Option A — Docker Compose (web + Socket.IO + PostgreSQL + Redis)

1. Start the stack:

   ```sh
   npm run compose:up
   ```

2. First-time database setup (on your machine, with Postgres reachable on `localhost:5432`):

   ```sh
   npx void db migrate
   npx void db seed --yes   # optional
   ```

3. Open **http://localhost:5173** (Void `web` container) and **http://localhost:3001** (Socket.IO `socket-server`).

4. Stop:

   ```sh
   npm run compose:down
   ```

The **web** container uses **`docker/env.web`** (mounted as `.env`) so Void can reach Postgres/Redis via `host.docker.internal`. For commands run **on your host**, use the repo **`.env`**:

- `DATABASE_URL=postgresql://mahjong:mahjong@localhost:5432/mahjong_game`
- `REDIS_URL=redis://localhost:6379`

Redis config and notes: **`redis/README.md`**. Socket.IO details: **`socket-server/README.md`**.

**Database scripts (host, uses `.env`):** `npm run db:up` | `db:down` | `db:migrate` | `db:generate` | `db:status` | `db:seed`

### Option B — App on host, data in Docker

1. Start only databases:

   ```sh
   docker compose up -d postgres redis
   ```

2. Ensure `.env` matches the URLs above.

3. Migrate if needed: `npx void db migrate`

4. Run the app: `npm run dev`

5. Optional real-time server: `REDIS_URL=redis://localhost:6379 DATABASE_URL=postgresql://mahjong:mahjong@localhost:5432/mahjong_game npm run socket:dev`

### Checks

```sh
npm run check             # lint, format check, tests (root and socket-server)
npm run typecheck         # web app and shared src/
npm run typecheck:socket  # socket-server
```

### Bot players

Bots are first-class seats. A seated player can add a bot to a waiting game via:

```http
POST /api/games/:gameId/bot
{ "difficulty": "low" | "medium" | "smart" }
```

The three difficulty levels:

| Level | Turn action | Claim action |
| --- | --- | --- |
| **Low** | Always discard the drawn tile | Always pass |
| **Medium** | Keep pairs; pong / kong when possible | Pong / kong (no chow, no win) |
| **Smart** | `evaluateWin` tsumo check; greedy set-strength discard | Win > pong/kong > chow > pass |

Once the 4th seat is filled the round deals automatically. The socket server's **`BotDriver`** then advances each bot's turn after every game action — no client needed. Bot turns flow through the same `GameActionQueue` and `PlayActions` pipeline as human turns.

A bot has no browser socket. The public snapshot includes `botDifficulty`, and joining the table emits connected presence for every bot seat, so the client shows the bot as present. A later away event does not mark a bot away.

Bot logic: [`src/logic/server/game/bot/botPlayer.ts`](src/logic/server/game/bot/botPlayer.ts). Full design notes: [`docs/bot.md`](docs/bot.md).

#### Bot integration test

Runs two in-process scenarios with no database or Redis required — all state is in-memory:

```sh
npm run bot:play
```

**Scenario 1 — Deterministic Win:** A stacked wall deals seat 0 a near-complete hand (two chows + one east tile). The Smart bot draws the winning tile on turn 1, detects the win via `evaluateWin`, and declares a self-draw.

**Scenario 2 — Random Play to Completion:** Four Low bots on a standard Hong Kong table. Low bots always discard the drawn tile and pass every claim, so the game runs to wall exhaustion.

Both scenarios assert the expected terminal state and print `PASS` or exit with code 1 on failure.

### Vue client

The playable UI is a landscape PWA (Void pages + Vue). Traditional Chinese (`zh-TW`) is the default; English (`en-US`) is the other locale. `/` redirects to `/register` (display name, create a table, join with the 5-digit code). `/game/[uuid]` is the waiting room, the play table, and the round result.

On a human discard turn the banner counts down that table's `claimWindowMs` (5 or 10 seconds). At zero the client discards the last tile in the hand. An unlimited window (`null`) shows no countdown and does not auto-discard. Bots are not on this timer; `BotDriver` plays their turns. The server still validates every discard.

---

### Progress

| Area | Status |
| --- | --- |
| Database schema (`profile`, `auth`, `game`) | Done |
| Session auth and socket tickets | Done |
| HTTP API: create, join, snapshot, next wind, abort | Done |
| Round logic: deal, draw with flower replacement, discard, chow / pong / kong claims, concealed and added kong, winning hands, empty wall | Done |
| Scoring charts: Hong Kong (fan, `2^fan` capped at 10) and Taiwan (base + tai) | Done (drafted, open for review) |
| Robbing an added kong (win-only window, `robbingKong` pattern) | Done |
| Concurrent actions: `SELECT ... FOR UPDATE` on the game row, plus a per-game queue in the socket server | Done |
| Redis: claim window answers, write-through round and hand cache, game channel (`gameAborted`, `gameChanged`, `nextWind`) | Done |
| Socket.IO handlers: ticket auth, join, draw, discard, claim, pass, declare win, presence, claim timer, fan-out | Done |
| Vue game client: landscape PWA, zh-TW / en-US, waiting room, play, round result, discard countdown | Done |
| Bot players: Low / Medium / Smart difficulty, `POST /api/games/:gameId/bot`, `BotDriver` socket wiring, in-process integration test | Done |

Design notes live in `docs/` (`game.md`, `database.md`, `socket.md`, `types.md`, `bot.md`). Bot API and heuristics: [`docs/bot.md`](docs/bot.md).

---

### Multiplayer board game tech stack

| Layer / component | Technology (this repo) | Primary responsibility |
| --- | --- | --- |
| **Full-stack web app** | **[Void](https://void.cloud)** + **Vue 3** + **Vite+** on **Cloudflare Workers** | SSR pages (`pages/`), file-based HTTP APIs (`routes/`), auth and deploy via Void; UI in Vue. |
| **Real-time game server** | **Node.js** + **Socket.IO** (`socket-server/`) | Long-lived WebSocket connections, rooms, game loop, and real-time events (Redis adapter for scaling). |
| **In-memory cache / live state** | **Redis** | Session cache, socket tickets, round/hand **cache** (Postgres is source of truth), abort fan-out pub/sub. |
| **Permanent database** | **PostgreSQL** | Users, credentials, leaderboards, match history (`db/` schema + migrations). |
| **ORM / migrations** | **Drizzle ORM** (via Void) | Type-safe queries, `void db generate` / `void db migrate`, seeds in `db/seed.ts`. |
| **Boundary typing** | **Zod** | Guard API and socket message shapes at boundaries; domain rules live in logic layers. |
| **Local infrastructure** | **Docker Compose** | `web`, `socket-server`, `postgres`, `redis` — see [Local development](#local-development) above. |

---

### Data flow overview

* **Web traffic & HTTP APIs:** **Void (Vue + Workers)** → **PostgreSQL** (persistent data).
* **Live gameplay:** **Socket.IO (`socket-server`)** writes **PostgreSQL first**, then Redis cache, then broadcast.
* **Match completion:** outcomes persist in **PostgreSQL**; Redis keys for that game are dropped.
