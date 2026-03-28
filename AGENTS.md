# Agent guide — Vegan Meal Planner

This doc gives AI agents project-level guidance: how to work this repo, conventions, and workflow. See README for user-facing project info.

## Development setup

This project uses **Bun** as the runtime.

- **Install dependencies:** `bun install`
- **Run scripts:** `bun run <script>` (e.g. `bun run start`)
- **Lint:** `bun run lint` — **Format:** `bun run format` / `bun run format:check`
- **All checks:** `./scripts/check.sh` (or `bun run check`) runs format check, lint, typecheck, and tests and only prints failures—use it for verification to keep context clean.

**API / backend:** The API runs via `bun run start`. API code lives under `src/api`, tests under `tests/` (e.g. `tests/api/`). The public HTTP contract is **`contracts/openapi.yaml`** (validated in tests). Backend work uses Prisma and `src/domain` (types/dtos). **Data model overview and doc map:** [docs/data-model.md](docs/data-model.md). For the local database, use **podman**: `podman compose` (or `podman-compose`) with the repo’s `docker-compose.yml`.

See [README.md](README.md) for more.

## Conventions

- **Cursor rules** live in `.cursor/rules/` (e.g. use Bun instead of Node/npm/pnpm).
- **Cursor skills** live in `.cursor/skills/`. For ticketing we use:
  - **vom** — continue work on a VOM ticket (claim → guidance → show → work → next)
  - **vom-new** — create a new VOM ticket
  - **vom-self-review** — review recent work and create/update tickets for friction
  - **vom-tidy** — move done tickets to `tickets/done` (or run `./scripts/vom-tidy.sh` from repo root)
  - **vom-open-plan** — open the implementation plan for a VOM ticket (e.g. "open plan for TKT-017", or "open the plan" when a ticket is already in context)

Prefer Bun over Node, npm, pnpm, etc., per project rules.

## Workflow

For **ticket work** (VOM):

1. **Claim first:** `vom claim TKT-XXX`
2. **Follow the claim output:** run the suggested `vom guidance` and `vom show TKT-XXX --plans`
3. **Do the work** from the plan
4. **Advance when done:** `vom next TKT-XXX "message"`

Full agent reference: `vom --agents-help`.

The VOM-related skills (**vom**, **vom-new**, **vom-self-review**, **vom-open-plan**) give step-by-step instructions when working on or creating tickets — use them when continuing a ticket or creating a new one.

When a ticket is in **plan-needs-review**, open its implementation plan (use the **vom-open-plan** skill so the plan is in context for review).

When a ticket is in **review-pending**, the review-pending guidance and the Cursor rule `vom-review-pending-use-vom-reviewer` prompt use of the **vom-reviewer** subagent for implementation review.
