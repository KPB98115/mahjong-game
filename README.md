
---

### Multiplayer Board Game Tech Stack

| Layer / Component | Technology | Primary Responsibility |
| --- | --- | --- |
| **Full-Stack Web App** | **Next.js** (or similar) | Serves frontend web pages, handles user accounts, authentication, dashboards, and standard HTTP APIs. |
| **Real-Time Game Server** | **Node.js** + **Socket.io** (or Colyseus) | Manages persistent WebSocket connections, hosts active game rooms, enforces rules, and runs the game loop. |
| **In-Memory Cache / State** | **Redis** | Stores active, live board states and room data in RAM for lightning-fast reads/writes during gameplay. |
| **Permanent Database** | **PostgreSQL** | Stores user profiles, credentials, global leaderboards, and historical match logs/archives. |
| **ORM / Query Tool** | **Drizzle ORM** or **Prisma** | Provides type-safe database queries and migrations between your backend and PostgreSQL. |
| **Data Validation** | **Zod** | Validates incoming action payloads and client requests before they hit the game logic. |

---

### Data Flow Overview

* **Web Traffic & Auth:** Handled by **Next.js** $\rightarrow$ **PostgreSQL**.
* **Live Gameplay & State Sync:** Handled by **Socket.io** $\rightarrow$ **Redis**.
* **Match Completion:** Final data saved from **Redis** $\rightarrow$ **PostgreSQL**.