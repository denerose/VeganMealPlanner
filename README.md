# Vegan Meal Planner

## Development

This project uses [Bun](https://bun.sh) as the runtime.

- **Install dependencies:** `bun install`
- **Run scripts:** `bun run <script>` (e.g. `bun run start`)
- **Lint:** `bun run lint`
- **Format:** `bun run format` (write) or `bun run format:check` (check only)

Run `./scripts/check.sh` (or `bun run check`) to run format check, lint, typecheck, and **unit** tests together.

**Full check with integration tests:** `./scripts/check-all.sh` (or `bun run check-all`) runs the same as `check` plus integration tests (Postgres required). **Only use `check-all` when** integration tests were **changed** or **unit tests alone cannot fully cover** what you implemented; otherwise use `check` for a faster, DB-free loop.

**Tests:** `bun run test` / `bun run test:unit` runs `tests/unit` only (fast). `bun run test:integration` runs `tests/integration` and needs Postgres with migrations applied. `bun run test:all` runs both—use before merge or in CI.

## API / Backend

The API runs with Bun and uses Prisma and Postgres.

1. **Start Postgres and pgAdmin locally** with podman:  
   `podman compose up -d` (or `podman-compose up -d` if you use the standalone tool).
2. **Copy `.env.example` to `.env`** and set `DATABASE_URL` if needed (default in example matches the compose file).
3. **Apply migrations:** `bunx prisma migrate dev` (or `bunx prisma migrate deploy` in production) so the database schema matches `prisma/schema.prisma`.
4. **Generate the Prisma client:** `bunx prisma generate` (often run automatically by migrate).
5. **Start the API:** `bun run start`

The server listens on port 3000 (or `PORT`). **`GET /api/health`** returns `200` with `{ "status": "ok" }` when the database is reachable, and `503` with `{ "status": "error" }` when it is not.

**Local dev identity:** run **`bun run dev-seed`** (after migrations) to upsert a stable dev user and household plus small vegan fixtures. Use the printed **`X-Dev-User-Id`** with **`AUTH_MODE=development`**, or log in with email **`dev@veganmealplanner.local`** and default password **`devseedveg`** unless you set **`DEV_SEED_PASSWORD`**. Safe to run repeatedly (idempotent). Not run automatically by `bun run start`.

Protected routes expect **`Authorization: Bearer <JWT>`** with a `sub` claim (user id), or **`AUTH_MODE=development`** with **`X-Dev-User-Id: <uuid>`** (see `.env.example` and `contracts/openapi.yaml`).

**Production / JWT:** When `AUTH_MODE` is not `development`, **`JWT_SECRET`** and **`JWT_EXPIRES_IN`** are required. Tokens use **HS256**; **`JWT_SECRET`** must be at least **32 UTF-8 bytes** of cryptographically random material (align with `.env.example`, e.g. `openssl rand -base64 48`). If the secret is present but too short, **the API refuses to start** in that mode. In **`AUTH_MODE=development`**, a short secret only produces a startup **warning** so local setups can still run.

The published HTTP contract is **`contracts/openapi.yaml`** (OpenAPI 3). Unit tests validate this spec (`tests/unit/contracts/openapi.test.ts`); run `bun run test:unit` or `./scripts/check.sh` after changing the API or the contract. Use `./scripts/check-all.sh` / `bun run check-all` only if you also need integration coverage for that change (see **Full check with integration tests** above).
