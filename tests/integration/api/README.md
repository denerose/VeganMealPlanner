# API integration tests

HTTP integration tests for `createFetchHandler` against a real database (see [TESTING.md](../../../TESTING.md)).

When you add or change a path under `/api/*` in `contracts/openapi.yaml`, update:

1. The `DOCUMENTED_API_PATHS` list in [`tests/unit/contracts/openapi.test.ts`](../../unit/contracts/openapi.test.ts)
2. This table (and add tests if coverage is missing)

| OpenAPI area                                       | Primary test file(s)            |
| -------------------------------------------------- | ------------------------------- |
| Health                                             | `health.test.ts`                |
| Auth (register, login, logout)                     | `auth.test.ts`                  |
| Routing (undocumented 404 empty body, 405 + Allow) | `routing-contract.test.ts`      |
| Me, household, members                             | `me-household.test.ts`          |
| Household invitations                              | `household-invitations.test.ts` |
| Ingredients                                        | `ingredients.test.ts`           |
| Meals                                              | `meals.test.ts`                 |
| Day plans                                          | `day-plans.test.ts`             |
