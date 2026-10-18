# Redis (local)

Redis runs via the root **`docker-compose.yml`** `redis` service.

- **Config:** `redis/redis.conf` (mounted into the container)
- **Data:** Docker volume `mahjong_redis_data`

## URLs

| Where the app runs | `REDIS_URL` |
|--------------------|-------------|
| On your machine (`npm run dev`) | `redis://localhost:6379` |
| In Compose (`web` service) | `redis://host.docker.internal:6379` (see compose comments) |

Application code that talks to Redis belongs under **`src/logic/server/`**, not in this folder.
