# REST API design — Vegan Meal Planner (MVP)

**Status:** Draft (pending human + spec review)  
**Date:** 2026-03-28  
**Scope:** HTTP API shape, auth/tenancy, and route behavior for the meal library and day plans. Aligns with [`docs/data-model.md`](../../data-model.md), Prisma, and [`2026-03-28-data-model-design.md`](2026-03-28-data-model-design.md). Implementation updates `contracts/openapi.yaml` and `src/domain` as routes land.

## Goals

- **Simple REST** under **`/api/*`**, served with **Bun** (`Bun.serve`, Web `Request`/`Response`). No separate HTTP framework is required; a small router/dispatcher module is enough.
- **CRUD** for primary entities (meals, ingredients, day plans) scoped to the caller’s household.
- **Day plans:** list by **calendar date range**, **bulk create/upsert**, and single-resource read/update/delete.
- **Meals:** **filtered list** (quality booleans, hero ingredients), and **`GET /api/meals/random`** with a **required calendar date** and exclusion of **prior/next day dinner** when those plans exist.
- **OpenAPI** remains the public contract (`contracts/openapi.yaml`); behavior must stay consistent with domain DTOs and mappers.

## Non-goals (MVP)

- OAuth/resource-server integration details (token issuer, JWKS) — only **caller identity** (`userId`) and **rules** are specified here.
- File upload for meal images (`imageId` stays opaque).
- Multi-household per user or switching households.

## Runtime & dependencies

- **Bun** for server and tests (per project conventions).
- **Prisma** + PostgreSQL for persistence.
- **`date-fns`** for calendar-day arithmetic on the **`GET /api/meals/random`** flow. Stepping **previous/next calendar day** must be **consistent** with naive `YYYY-MM-DD` handling and `planDateFromYmd` in `src/domain/lib/plan-date.ts` / Postgres `@db.Date` equality (prefer **UTC-safe** `date-fns` usage or thin wrappers so adjacent `DayPlan` lookups never drift by TZ).

## Auth, tenancy, and dev override

### Production

- Clients send **`Authorization: Bearer <token>`**.
- Middleware resolves **`userId`** (string matching **`User.id`**). No trusted `userId` in request bodies for *authorization*; values like **`MealCookedBy`** are **data** and must still be validated against the same household.
- **Household** for all operations: load **`HouseholdMembership`** for `userId`. **Product rule:** exactly **one** membership per user.
  - **Zero** memberships → **`403`** or **`409`** with a stable error code (e.g. `user_not_in_household`).
  - **More than one** → **`500`** in development tooling / **`409`** in production-facing behavior until data and schema enforce uniqueness (optional follow-up: **unique `userId`** on `HouseholdMembership`).
- **Canonical `householdId`** for Prisma queries comes from that membership row. If the JWT later includes **`householdId`**, it **must equal** the DB value or the server returns **`403`** (optional check once auth is wired).

### Development override

- When **`AUTH_MODE=development`** (or project-specific equivalent), allow a documented header (e.g. **`X-Dev-User-Id: <uuid>`**) that maps to a real **`User`** row. **Reject** this header when not in dev mode. Same membership rules apply.

### Public

- **`GET /api/health`** remains **unauthenticated** (existing behavior).

## URL layout

- **Flat** resources under **`/api/*`** — no `householdId` in paths; scope is always implicit from the authenticated user’s household.

## Calendar dates

- **`DayPlan`** and query params use **`YYYY-MM-DD`** (ISO 8601 date only), consistent with [`docs/data-model.md`](../../data-model.md). **`date` query params** use the same format.
- Invalid format → **`422`**. **`from` / `to` range:** require **`from <= to`**; enforce a **max span** (e.g. **93 days**) to limit load.

## Pagination & sorting

- **`GET /api/meals`** and **`GET /api/ingredients`:** support **`limit`** (default 50, cap 100) and **`cursor`** or **`offset`** — pick one style in implementation and document it in OpenAPI; prefer **cursor** if large libraries are expected.
- **`GET /api/day-plans`** with range returns **all rows in range** up to the **max span** (pagination optional if range cap is strict).

## Errors

- Use a **small JSON object** everywhere (evolve toward a single **problem-detail** shape later if desired).
- **`401`** — missing/invalid bearer (or dev auth).
- **`403`** — authenticated but not allowed (e.g. dev header in prod, mismatched `householdId` claim if checked).
- **`404`** — unknown resource **or** no row in scope **or** **`GET /api/meals/random`** when **no eligible meals** after exclusions.
- **`409`** — conflicts: duplicate **`(householdId, date)`** on day plan create if not upserting; duplicate ingredient name under normalization rules; multiple membership rows if enforced.
- **`422`** — validation (bad date string, bad range, invalid UUIDs, etc.).

## Resources and endpoints

### Current user & household

| Method | Path | Purpose |
|--------|------|--------|
| `GET` | `/api/me` | Current user + household summary (from single membership). |
| `PATCH` | `/api/me` | e.g. `displayName`. |
| `GET` | `/api/household` | Household record for the caller. |
| `PATCH` | `/api/household` | e.g. `name`. |

### Meals

| Method | Path | Purpose |
|--------|------|--------|
| `GET` | `/api/meals` | List/search: pagination + optional quality filters + hero-ingredient AND filter (see below). |
| `POST` | `/api/meals` | Create meal; body aligns with domain DTO (nested `qualities`, hero links optional). |
| `GET` | `/api/meals/{mealId}` | Read one. |
| `PATCH` | `/api/meals/{mealId}` | Update; may include hero-ingredient list and **`MealCookedBy`** user ids (same-household validation). |
| `DELETE` | `/api/meals/{mealId}` | Delete (respect FK **`onDelete`** rules; document client expectations). |
| `GET` | `/api/meals/random` | Random eligible meal (**required** `date=YYYY-MM-DD`). |

**`GET /api/meals` filters (query params):**

- Qualities: e.g. **`isCreamy=true`** means *must be true*; **`isAcidic=false`** means *must be false*. Omitting a flag means *no constraint* on that column.
- Hero ingredients: **`heroIngredientId`** repeated or comma-separated list — meal must include **all** listed ingredients (AND) via **`MealHeroIngredient`**.

**`GET /api/meals/random`:**

- **Query:** **`date`** (required, `YYYY-MM-DD`). Optional future query params can mirror list filters (qualities, hero ids).
- **Steps:** resolve `householdId` → compute **calendar previous and next day** (via **`date-fns`** + **`planDateFromYmd`**-compatible dates) → load **`DayPlan`** for those two days only → build **exclusion set** from **`dinnerMealId`** on each plan **if non-null** → subtract from household meals (and apply same optional filters if specified) → **uniform random** among remaining.
- **Adjacent lunch** is **not** excluded unless product changes.
- **No eligible meal** → **`404`** with informative body.

### Ingredients

| Method | Path | Purpose |
|--------|------|--------|
| `GET` | `/api/ingredients` | List (pagination). |
| `POST` | `/api/ingredients` | Create (normalize name per data model). |
| `GET` | `/api/ingredients/{ingredientId}` | Read. |
| `PATCH` | `/api/ingredients/{ingredientId}` | Update. |
| `DELETE` | `/api/ingredients/{ingredientId}` | Delete (**Restrict** if referenced as hero — expect **`409`** or **`422`**). |

### Day plans

| Method | Path | Purpose |
|--------|------|--------|
| `GET` | `/api/day-plans?from=&to=` | Inclusive range; validate span cap. |
| `POST` | `/api/day-plans` | Create single plan (or defer if bulk-only for MVP — implementation chooses; document in OpenAPI). |
| `POST` | `/api/day-plans/bulk` | Array of `{ date, lunchMealId?, dinnerMealId? }`. Recommend **idempotent upsert** per `(householdId, date)` for sync safety. |
| `GET` | `/api/day-plans/{dayPlanId}` | Read by id. |
| `PATCH` | `/api/day-plans/{dayPlanId}` | Update lunch/dinner ids (same-household meal checks). |
| `DELETE` | `/api/day-plans/{dayPlanId}` | Delete. |

**Bulk semantics:** Document whether missing rows are **created empty** or **skipped**; recommend explicit array bodies over “materialize every day in range” in v1 unless product requires it.

## Validation & invariants

- **`Meal`** lunch/dinner on **`DayPlan`** must belong to the **same `householdId`** as the plan (service-layer check; same as data model doc).
- **`MealCookedBy`:** **`userId`** must be a member of the meal’s household.

## OpenAPI

- Extend **`contracts/openapi.yaml`** for every new path, method, query param, and shared schema; keep **404 empty body** rule for **undocumented** routes as documented today.

## Testing

- **Integration tests** (Bun + Prisma) for: happy paths, **`403`** without membership, **range validation**, **bulk idempotency**, **`/api/meals/random`** exclusions (fixtures: prior/next dinner set vs unset), **empty pool → 404**.

## References

- [`docs/data-model.md`](../../data-model.md)
- [`docs/superpowers/specs/2026-03-28-data-model-design.md`](2026-03-28-data-model-design.md)
