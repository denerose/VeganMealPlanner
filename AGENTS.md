# Agent guide — Vegan Meal Planner

This doc gives AI agents project-level guidance: how to work this repo, conventions, and workflow. See README for user-facing project info.

## Development setup

This project uses **Bun** as the runtime.

- **Install dependencies:** `bun install`
- **Run scripts:** `bun run <script>` (e.g. `bun run start`)
- **Lint:** `bun run lint` — **Format:** `bun run format` / `bun run format:check`
- **All checks:** `./scripts/check.sh` runs format check, lint, and tests.

See [README.md](README.md) for more.

## Conventions

- **Cursor rules** live in `.cursor/rules/` (e.g. use Bun instead of Node/npm/pnpm).
- **Cursor skills** live in `.cursor/skills/`. For ticketing we use:
  - **vom** — continue work on a VOM ticket (claim → guidance → show → work → next)
  - **vom-new** — create a new VOM ticket
  - **vom-self-review** — review recent work and create/update tickets for friction
  - **vom-tidy** — move done tickets to `tickets/done`

Prefer Bun over Node, npm, pnpm, etc., per project rules.

## Workflow

For **ticket work** (VOM):

1. **Claim first:** `vom claim TKT-XXX`
2. **Follow the claim output:** run the suggested `vom guidance` and `vom show TKT-XXX --plans`
3. **Do the work** from the plan
4. **Advance when done:** `vom next TKT-XXX "message"`

Full agent reference: `vom --agents-help`.

The VOM-related skills (**vom**, **vom-new**, **vom-self-review**) give step-by-step instructions when working on or creating tickets — use them when continuing a ticket or creating a new one.

When a ticket is in **review-pending**, the verifier is prompted by the review-pending guidance and the Cursor rule `vom-review-pending-use-verifier`; use the verifier subagent for implementation review.
