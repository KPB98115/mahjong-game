# Socket.IO game server

Long-lived Node server for real-time gameplay. The Void **web** app is separate.

## Local (host)

```sh
cd socket-server
npm install
REDIS_URL=redis://localhost:6379 CORS_ORIGIN=http://localhost:5173 npm run dev
```

- WebSocket: **http://localhost:3001**
- Health: **GET http://localhost:3001/health**

## Docker

Started by root `docker compose` as service **`socket-server`**.

| Variable | Compose value |
|----------|----------------|
| `PORT` | `3001` |
| `REDIS_URL` | `redis://redis:6379` |
| `CORS_ORIGIN` | `http://localhost:5173` |

Events use **`SocketEvent`** enum in `src/type/server/socketEvent.ts` (`ping` / `pong` for smoke tests).
