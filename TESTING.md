# Testing — Vegan Meal Planner

Conventions for automated tests in this repo. For general agent workflow and tooling, see [AGENTS.md](AGENTS.md).

## Layout and commands

- **Runtime:** [Bun](https://bun.sh) (`bun test`).
- **Unit tests:** `tests/unit`
- **Integration tests:** `tests/integration`
- **HTTP contract:** `contracts/openapi.yaml` is validated in tests (see [AGENTS.md](AGENTS.md) for context).

Useful scripts:

- `bun run test:unit` — unit tests only
- `bun run test:integration` — integration tests only
- `bun run test:all` — both
- `./scripts/check.sh` or `bun run check` — format, lint, typecheck, and **unit** tests (default verification)
- `./scripts/check-all.sh` or `bun run check-all` — same as `check`, plus **integration** tests (requires DB). **Use only when** integration tests were **updated** or **unit tests cannot fully exercise** the behavior under test; otherwise prefer `check`.

**Check vs check-all (API / auth / HTTP):** `check` does not run `test:integration`. For work that touches HTTP handlers, auth or session behavior, or Prisma-backed API paths, use **`check-all`** as final verification (Postgres + migrations as above) when DB-backed tests are needed—mirroring [AGENTS.md](AGENTS.md).

## Reusing fixture data in API integration tests

API integration tests under `tests/integration/api` should avoid calling `seedHouseholdUser()` in every test. Prefer a **shared household + user** for the whole `describe` block, with explicit reset between tests and teardown at the end.

1. **`beforeAll`:** Call `seedHouseholdUser()` once (and set env such as `AUTH_MODE` if needed).
2. **`afterEach`:** Call `resetHouseholdIntegrationData(householdId)` so the next test does not see rows left by the previous one (meals, day plans, ingredients, etc.).
3. **`afterAll`:** Call `teardownHouseholdUser(seed)` to delete membership, user, and household.

Keep the seeded context typed as `SeedHouseholdUserResult | undefined`, assign it in `beforeAll`, and use `seeded!` (or destructure after asserting) inside tests. That way `afterEach` / `afterAll` can skip safely if setup never completed.

**Second household:** If a test needs another household (for example a meal that must not belong to the primary household), call `seedHouseholdUser()` inside that test and call `teardownHouseholdUser` in a `finally` block so cleanup always runs.

### Rule: keep `resetHouseholdIntegrationData` complete

**If you add a Prisma model (or any persisted rows) scoped by `householdId`, update [`resetHouseholdIntegrationData`](tests/integration/api/helpers.ts)** so `afterEach` still removes all mutable data for that household. Otherwise later tests can see leaked rows and become order-dependent or flaky.

[`teardownHouseholdUser`](tests/integration/api/helpers.ts) already calls `resetHouseholdIntegrationData` before removing the user and household, so extending reset keeps both paths correct.

When adding deletes, respect FK order (for example clear `DayPlan` before `Meal` where the schema uses `Restrict` on meal references).

## Examples in the codebase

- [`tests/integration/api/helpers.ts`](tests/integration/api/helpers.ts) — `seedHouseholdUser`, `resetHouseholdIntegrationData`, `teardownHouseholdUser`
- [`tests/integration/api/meals.test.ts`](tests/integration/api/meals.test.ts) — shared `beforeAll` / `afterEach` / `afterAll` pattern
- [`tests/integration/api/day-plans.test.ts`](tests/integration/api/day-plans.test.ts) — same pattern plus a second household with `try` / `finally`

## When this pattern is optional

Nested `describe` blocks with **different** lifecycle needs, **one-off** setup, or only a single test may use local `beforeAll` / `afterAll` without the shared seed helpers—for example [`tests/integration/api/me-household.test.ts`](tests/integration/api/me-household.test.ts).

## HTTP API integration tests — coverage map

Tests under [`tests/integration/api/`](tests/integration/api/) hit `createFetchHandler` with a real database. When you add or change a path under `/api/*` in [`contracts/openapi.yaml`](contracts/openapi.yaml):

1. Update the `DOCUMENTED_API_PATHS` list in [`tests/unit/contracts/openapi.test.ts`](tests/unit/contracts/openapi.test.ts).
2. Add or extend tests in the file(s) below (and extend this table if you introduce a new area).

| OpenAPI area                                       | Primary test file(s)                                                                   |
| -------------------------------------------------- | -------------------------------------------------------------------------------------- |
| Health                                             | [`health.test.ts`](tests/integration/api/health.test.ts)                               |
| Auth (register, login, logout)                     | [`auth.test.ts`](tests/integration/api/auth.test.ts)                                   |
| Routing (undocumented 404 empty body, 405 + Allow) | [`routing-contract.test.ts`](tests/integration/api/routing-contract.test.ts)           |
| Me, household, members                             | [`me-household.test.ts`](tests/integration/api/me-household.test.ts)                   |
| Household invitations                              | [`household-invitations.test.ts`](tests/integration/api/household-invitations.test.ts) |
| Ingredients                                        | [`ingredients.test.ts`](tests/integration/api/ingredients.test.ts)                     |
| Meals                                              | [`meals.test.ts`](tests/integration/api/meals.test.ts)                                 |
| Day plans                                          | [`day-plans.test.ts`](tests/integration/api/day-plans.test.ts)                         |
