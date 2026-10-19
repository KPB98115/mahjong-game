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

5. Optional real-time server: `REDIS_URL=redis://localhost:6379 npm run socket:dev`

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
