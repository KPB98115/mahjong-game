---
name: coding-style
description: >-
  Mahjong-game coding style and file layout for TypeScript and Vue. Use when
  writing or reviewing code, adding components, organizing logic/models/types,
  or when the user mentions conventions, structure, Zod, view models, or tests.
---

# Coding style and practices

Apply these standards in this repository unless the user overrides them for a specific task.

## Functions

- Prefer **function declarations** (`function foo() {}`) over arrow functions when defining named functions.
- Arrow functions are acceptable for **short inline callbacks** (e.g. `array.map((item) => …)`) where a declaration is awkward.

## Naming

- Use **camelCase** for variables, functions, properties, and file names where the project already uses camelCase.
- Do **not** use snake_case in TypeScript or JSON. PostgreSQL schema/table/column names stay snake_case. **Drizzle** maps camelCase fields and TypeScript enums to snake_case SQL **when building the query**. Do not map casing in `*Logic` or by hand in a repo.

## TypeScript types

- Prefer **`type`** over **`interface`** for new data shapes.
- Do **not** use **`any`** or **`unknown`**. Give each value a concrete type, a generic, or a union. Parse JSON with Zod into that type instead of storing it as `unknown`.
- Use **`enum`** for static sets of values, **especially string values**, instead of `const` object maps. Server enums live under **`src/types/server`**. Use them as the **whitelist** for client HTTP and socket fields (Zod `z.enum(…)` in `src/model/server`; logic/handlers call parse). Do not re-check membership in `*Logic` after a successful parse.

## Zod

- **Always guard API requests and responses with Zod** (incoming body/query on the server; JSON from APIs on the client). Schemas live in **`src/model/server`**; `*Logic` / socket handlers / `ApiClient` call parse before use.
- Use **Zod to guard and parse data types** at other boundaries too (JSON bodies, env parsing).
- Do **not** use Zod as the primary place for **business/value validation** (rules, limits, domain constraints). Put that validation in **logic** functions; Zod should narrow input to a concrete type, not encode product rules.

## Regex

- Avoid complicated regular expressions for verifying values. Prefer explicit checks, small helpers, or domain logic in the logic layer.

## Separation of concerns

- **View components** (`*.vue`) should contain **view-related code only** (template, bindings, minimal wiring).
- Put behavior, orchestration, and testable rules in **`*.ts`** files under `src/logic/…` so unit tests can import logic without mounting components.
- **Repo classes have no business logic.** They only insert, find, update, and delete rows. Rules, validation, scoring, status/`phase`, and orchestration live in `*Logic` classes. Repos do not call logic, other repos, or Redis.
- For interactive or read-only UI, use a **view model** or **model** under `src/model/…` to keep components thin.

## Vue SFC order (`*.vue`)

Do not mix `ref`, `computed`, functions, and other hooks in random order. In `<script setup>`, use this order:

1. Imports (types first with `import { type X }`, then values)
2. `defineProps` / `defineEmits` / `defineModel`
3. Composables and framework hooks (`useForm`, `useRoute`, etc.)
4. `ref` / `shallowRef` / `reactive`
5. `computed`
6. `watch` / `watchEffect`
7. Lifecycle hooks (`onMounted`, etc.)
8. **Function declarations** for event handlers and local helpers

Keep `<template>` and `<style>` after `<script>`.

## File structure (project root)

Paths are relative to the **repository root**:

| Purpose | Path |
|--------|------|
| UI components | `src/component/` |
| Client logic | `src/logic/client/` |
| Client types | `src/types/client/` |
| Client models / view models | `src/model/client/` |
| Server logic | `src/logic/server/` |
| Server types | `src/types/server/` |
| Server models | `src/model/server/` |
| Static assets | `src/static/` |

### Coexistence with Void

Void keeps framework entry points at the repo root: `pages/`, `routes/`, `db/`, etc. **Do not move those** unless migrating the whole app. New shared components, client/server logic, types, models, and static files follow the `src/…` table above. Page files may import from `src/…`.

### Infrastructure at repo root

| Purpose | Path |
|--------|------|
| PostgreSQL schema, migrations, seeds | `db/` |
| Redis local config and docs | `redis/` |
| Socket.IO real-time server | `socket-server/` |
| Full stack (web, socket-server, Postgres, Redis) | `docker-compose.yml`, `Dockerfile`, `docker/env.web` |

Redis **client** code lives under `src/logic/server` and Redis types/enums under `src/types/server`, not under `redis/`.

## Client vs server data

- Do **not** reuse the same type/model/schema for client and server unless it is an **API response shape** the client must parse.
- Server persistence types belong under `src/types/server` and `src/model/server`; client-facing shapes under `src/types/client` and `src/model/client`. API closed fields use the server enums as the whitelist.

## Checklist before finishing a feature

- [ ] Logic lives in `src/logic/…`, not bloated in `.vue`
- [ ] camelCase naming; enums for string constants under `src/types/server`
- [ ] No `any` or `unknown`; values use a concrete type, generic, or union
- [ ] API request/response guarded with Zod; closed fields whitelisted with those enums; other domain validation in logic
- [ ] Vue script blocks follow the hook order above
- [ ] Files placed under the correct `src/…` directory
