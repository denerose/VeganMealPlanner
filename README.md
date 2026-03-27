# Vegan Meal Planner

## Development

This project uses [Bun](https://bun.sh) as the runtime.

- **Install dependencies:** `bun install`
- **Run scripts:** `bun run <script>` (e.g. `bun run start`)
- **Lint:** `bun run lint`
- **Format:** `bun run format` (write) or `bun run format:check` (check only)

Run `./scripts/check.sh` (or `bun run check`) to run format check, lint, and tests together.

## API / Backend

The API runs with Bun and uses Prisma and Postgres.

1. **Start Postgres and pgAdmin locally** with podman:  
   `podman compose up -d` (or `podman-compose up -d` if you use the standalone tool).
2. **Copy `.env.example` to `.env`** and set `DATABASE_URL` if needed (default in example matches the compose file).
3. **Generate the Prisma client:** `bunx prisma generate`
4. **Start the API:** `bun run start`

The server listens on port 3000 (or `PORT`). **`GET /api/health`** returns `200` with `{ "status": "ok" }` when the database is reachable, and `503` with `{ "status": "error" }` when it is not.

The published HTTP contract is **`contracts/openapi.yaml`** (OpenAPI 3). Tests validate this spec (`tests/contracts/openapi.test.ts`); run `bun test` or `./scripts/check.sh` after changing the API or the contract.
