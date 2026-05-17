# Agent guide — Vegan Meal Planner

This doc gives AI agents project-level guidance: how to work this repo, conventions, and workflow. See README for user-facing project info.

## Development setup

This project uses **Bun** as the runtime.

- **Install dependencies:** `bun install`
- **Run scripts:** `bun run <script>` (e.g. `bun run start`)
- **Lint:** `bun run lint` — **Format:** `bun run format` / `bun run format:check`
- **All checks (default):** `./scripts/check.sh` (or `bun run check`) runs format check, lint, typecheck, and **unit** tests only; failures are summarized to keep context clean—use this for routine verification.
- **Checks including integration tests:** `./scripts/check-all.sh` (or `bun run check-all`) runs the same steps plus **`bun run test:integration`** (needs Postgres with migrations applied). **Use `check-all` only when** you have **updated integration tests** or the **current implementation cannot be fully validated by unit tests alone**—otherwise prefer `check` / `bun run check` to avoid unnecessary DB dependency and runtime.

### Final verification (API / auth / HTTP)

- **`bun run check`** is the default routine loop; it does **not** run `test:integration`.
- Treat **`bun run check-all`** (Postgres + migrations per [TESTING.md](TESTING.md)) as **final verification** before merge when you change HTTP handlers, auth or session behavior, or OpenAPI-backed routes in ways that need DB-backed validation; when you add or change tests under `tests/integration`; or when unit tests cannot exercise the code path you changed.
- Purely static changes (comments, types without behavior) may stay on `check` only when that is appropriate.

**API / backend:** The API runs via `bun run start`. API code lives under `src/api`, unit tests under `tests/unit`, integration tests under `tests/integration`. The public HTTP contract is **`contracts/openapi.yaml`** (validated in tests). Backend work uses Prisma and `src/domain` (types/dtos). **Data model overview and doc map:** [docs/data-model.md](docs/data-model.md). For the local database, use **podman**: `podman compose` (or `podman-compose`) with the repo's `docker-compose.yml`. **Testing conventions and integration fixtures:** [TESTING.md](TESTING.md).

See [README.md](README.md) for more.

## CLI (`vmp`)

A CLI client lives under `src/cli/`. Run it with `bun run cli -- <command>` or see **[docs/cli.md](docs/cli.md)** for full documentation. The CLI is a pure TypeScript HTTP client — it does not start a server or connect to the database directly. It talks to the API via the same HTTP contract documented in `contracts/openapi.yaml`.

Key points for agents modifying the CLI:

- **No new runtime dependencies.** Use `Bun.argv`, `fetch`, and built-in modules only.
- **Keep command help text in sync** when adding or changing flags.
- **Run `bun run check`** after changes (typecheck, lint, format, unit tests cover `tests/unit/cli/`).
- **Interactive prompts** use `src/cli/prompt.ts` — when stdin is not a TTY, they throw with a message naming the missing flag. Do not add `readline` or other input libraries.
- **Shared types** are in `src/cli/types.ts`. Command handlers import `ParsedFlags` from there, not from a local interface.
- **Token persistence** is file-based (`~/.vmp-token`). The `ApiClient.reset()` method must be called after `saveToken()` so the singleton picks up the new credentials.

## Conventions

### Use Bun instead of Node.js

Default to using Bun instead of Node.js, npm, pnpm, or vite.

- Use `bun <file>` instead of `node <file>` or `ts-node <file>`
- Use `bun test` instead of `jest` or `vitest`
- Use `bun install` instead of `npm install` or `yarn install` or `pnpm install`
- Use `bun run <script>` instead of `npm run <script>` or `yarn run <script>` or `pnpm run <script>`
- Use `bunx <package> <command>` instead of `npx <package> <command>`
- Bun automatically loads `.env`, so don't use dotenv.
- `Bun.serve()` supports WebSockets, HTTPS, and routes. Don't use `express`.
- `bun:sqlite` for SQLite. Don't use `better-sqlite3`.
- `Bun.redis` for Redis. Don't use `ioredis`.
- `Bun.sql` for Postgres. Don't use `pg` or `postgres.js`.
- `WebSocket` is built-in. Don't use `ws`.
- Prefer `Bun.file` over `node:fs`'s `readFile`/`writeFile`.
- Bun.$`ls` instead of execa.

### Keep OpenAPI contract in sync

When you change HTTP routes, methods, status codes, or JSON response bodies under `src/api/`, update `contracts/openapi.yaml` in the **same change set** so the published contract matches the implementation.

Before finishing, run `bun test tests/unit/contracts/openapi.test.ts`, or `bun run test:unit`, or `./scripts/check.sh` so OpenAPI validation still passes. Use `./scripts/check-all.sh` / `bun run check-all` **only** if you changed integration tests or need HTTP-level coverage that unit tests do not provide.

### Prisma migrations

Do **not** create, edit, or rewrite anything under `prisma/migrations/` by hand—including `migration.sql`, new migration folders, or renaming migration directories to "fix" history. Let Prisma own generated migration artifacts.

**Do instead:**

- Change `prisma/schema.prisma` (and related Prisma config only as needed).
- Run **Prisma commands** so migrations and client stay consistent, for example:
  - `bunx prisma migrate dev` — create/apply migrations in development
  - `bunx prisma migrate diff` / `bunx prisma db push` — only when appropriate for the task and environment (prefer migrate dev for versioned migrations)

Use **Bun** (`bunx prisma …`) per project conventions, not `npx`.

```text
❌ BAD — paste or edit SQL in prisma/migrations/.../migration.sql
✅ GOOD — update schema.prisma, then bunx prisma migrate dev (or the CLI flow the user asked for)
```

If a migration is wrong, fix it by adjusting the schema and using Prisma's workflow (e.g. reset in dev, or a new migration from the corrected schema)—never patch migration files manually.

### Documentation placement (tests and source trees)

- **Do not** create `README.md` or other new ad-hoc doc files under `tests/**` or `src/**` unless the **human explicitly requested that exact path** (name and directory).
- **Testing** conventions, API integration coverage maps, fixture notes, and "which test file covers which endpoint" tables belong in **[TESTING.md](TESTING.md)** at the repo root (new section or subsection), not in a nested README.
- **Agent/workflow** guidance belongs in **[AGENTS.md](AGENTS.md)**.
- **User-facing or architectural docs** → existing **[README.md](README.md)** or **`docs/`** patterns.

```text
❌ tests/integration/api/README.md (unless user asked for that file)
❌ src/api/README.md (unless user asked for that file)
✅ TESTING.md — "HTTP API integration tests — coverage map"
```

### Vegan branding in ephemera

Keep examples, seed data, test fixtures, OpenAPI samples, doc snippets, and any other non-production copy aligned with the app's purpose: **plant-based / vegan food only**. Do not use animal products, non-vegan dishes, or messaging that conflicts with vegan principles in sample names, ingredient lists, or placeholder text.
