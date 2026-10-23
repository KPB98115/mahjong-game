# Socket.IO game server

Long-lived Node server for real-time gameplay. The Void **web** app is separate, but both share the logic and repos in the root `src/` (imported as `@app/*`). The build bundles them into `dist/index.cjs` with esbuild.

## Local (host)

Install root dependencies first (the shared code uses them), then:

```sh
cd socket-server
npm install
REDIS_URL=redis://localhost:6379 \
DATABASE_URL=postgresql://mahjong:mahjong@localhost:5432/mahjong_game \
CORS_ORIGIN=http://localhost:5173 npm run dev
```

- WebSocket: **http://localhost:3001**
- Health: **GET http://localhost:3001/health**

Scripts: `npm run build` (esbuild bundle), `npm run typecheck`, `npm start`. Tests run from the root with `npm test`.

## Docker

Started by root `docker compose` as service **`socket-server`**. The build context is the repo root (`socket-server/Dockerfile`).

| Variable | Compose value |
|----------|----------------|
| `PORT` | `3001` |
| `REDIS_URL` | `redis://redis:6379` |
| `DATABASE_URL` | `postgres://mahjong:mahjong@postgres:5432/mahjong_game` |
| `CORS_ORIGIN` | `http://localhost:5173` |

Events use the shared **`SocketEvent`** and **`SocketError`** enums in `src/types/server/`. Handlers live in `src/logic/server/handler/`; the protocol is in [`docs/socket.md`](../docs/socket.md).
