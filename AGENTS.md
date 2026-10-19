<!--injected-by-void-v1.1.11-->
## Void

- This project uses [Void](https://void.cloud), a full-stack Vite framework for Cloudflare Workers with file-based API routing, server-rendered pages, and typed backend services.
- Use Void's CLI and typed APIs. Before working with Void, read the relevant Markdown docs in `node_modules/void/docs/`; start with `guide/quickstart.md` for setup and `reference/cli.md` for commands.

<!--/injected-by-void-->

## Coding standards

Before implementing or reviewing application code in this repo, read and follow the project skill:

**`.cursor/skills/coding-style/SKILL.md`**

Summary:

- Prefer **function declarations** over arrow functions for named functions; **camelCase** in TypeScript and JSON (SQL snake_case via Drizzle).
- Prefer **`type`** over **`interface`**; use **`enum`** for static string/value sets.
- PostgreSQL names stay snake_case; **Drizzle** maps camelCase/enums before SQL. Zod schemas live in `src/model/server`.
- **`*.vue`**: view-only; group script setup in order (imports → props/emits → composables → refs → computed → watchers → lifecycle → functions).
- Logic in **`src/logic/client`** and **`src/logic/server`**; types and models under **`src/types/…`** and **`src/model/…`**; components in **`src/component/`**; static files in **`src/static/`**.
- **Always guard API requests and responses with Zod**; closed client fields use **`enum`s in `src/types/server` as a whitelist**; other **domain validation** in logic, not heavy Zod refinements.
- Avoid complex regex for verification; use view models/models for interactive or read-only UI.

Void **`pages/`**, **`routes/`**, and **`db/`** stay at the repo root; **`redis/`** holds Redis infra config; **`socket-server/`** is the Socket.IO Node service; **`docker-compose.yml`** runs web, socket-server, Postgres, and Redis; shared app code uses **`src/`** as defined in the skill.
