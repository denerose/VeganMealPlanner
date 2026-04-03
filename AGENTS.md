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

**API / backend:** The API runs via `bun run start`. API code lives under `src/api`, unit tests under `tests/unit`, integration tests under `tests/integration`. The public HTTP contract is **`contracts/openapi.yaml`** (validated in tests). Backend work uses Prisma and `src/domain` (types/dtos). **Data model overview and doc map:** [docs/data-model.md](docs/data-model.md). For the local database, use **podman**: `podman compose` (or `podman-compose`) with the repo’s `docker-compose.yml`. **Testing conventions and integration fixtures:** [TESTING.md](TESTING.md).

See [README.md](README.md) for more.

## Conventions

- **Cursor rules** live in `.cursor/rules/` (e.g. use Bun instead of Node/npm/pnpm).
- **Cursor skills** live in `.cursor/skills/`. For ticketing we use:
  - **vom** — continue work on a VOM ticket (claim → guidance → show → work → next)
  - **vom-new** — create a new VOM ticket
  - **vom-self-review** — review recent work and create/update tickets for friction
  - **vom-tidy** — move done tickets to `tickets/done` (or run `./scripts/vom-tidy.sh` from repo root)
  - **vom-open-plan** — open the implementation plan for a VOM ticket (e.g. "open plan for TKT-017", or "open the plan" when a ticket is already in context)
  - **prisma-delegate-migrate** — subagents/Task workers edit `schema.prisma` only and hand off `bunx prisma migrate dev` to the host; see `.cursor/skills/prisma-delegate-migrate/SKILL.md` and rule `subagent-prisma-host-handoff.mdc`
  - **subagent-driven-development** — execute multi-task plans with an implementer subagent plus spec and code-quality reviews per task; prompts live in `.cursor/skills/superpowers/subagent-driven-development/` (see `SKILL.md`)
  - **superpowers-subagents-final-check** — after subagent code/spec reviews, reconcile feedback with the repo and create VOM tickets for remaining good recommendations; see `.cursor/skills/superpowers/superpowers-subagents-final-check/SKILL.md`
- **Vegan branding in ephemera:** Keep examples, seed data, test fixtures, OpenAPI samples, doc snippets, and any other non-production copy aligned with the app’s purpose: **plant-based / vegan food only**. Do not use animal products, non-vegan dishes, or messaging that conflicts with vegan principles in sample names, ingredient lists, or placeholder text.

Prefer Bun over Node, npm, pnpm, etc., per project rules.

- **Docs in test/source trees:** Do not add `README.md` under `tests/**` or `src/**` unless the user explicitly asked for that path. Put testing notes and API test coverage maps in **[TESTING.md](TESTING.md)**. See Cursor rule `documentation-no-ad-hoc-readmes-tests-src.mdc`.

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
