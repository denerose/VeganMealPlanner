# REST API design — Vegan Meal Planner (MVP)

**Status:** Ready for human review (agent spec review: Approved)  
**Date:** 2026-03-28  
**Scope:** HTTP API shape, auth/tenancy, and route behavior for the meal library and day plans. Aligns with [`docs/data-model.md`](../../data-model.md), Prisma, and [`2026-03-28-data-model-design.md`](2026-03-28-data-model-design.md). Implementation updates `contracts/openapi.yaml` and `src/domain` as routes land.

**HTTP status note:** For this API, **request validation** (bad types, malformed dates, unknown UUID format in body) uses **`422`**. If [`2026-03-28-data-model-design.md`](2026-03-28-data-model-design.md) mentions **`400`** for “validation”, treat **this REST spec as canonical for HTTP status** when implementing routes; domain-layer errors may still use other codes internally before mapping.

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
- Middleware resolves **`userId`** (string matching **`User.id`**). No trusted `userId` in request bodies for _authorization_; values like **`MealCookedBy`** are **data** and must still be validated against the same household.
- **Household** for all operations: load **`HouseholdMembership`** for `userId`. **Product rule:** exactly **one** membership per user (not yet enforced by a DB unique on `userId` alone; see [`docs/data-model.md`](../../data-model.md) tenancy — align schema in a follow-up if desired).
  - **Zero** memberships → **`403`** or **`409`** with a stable error code (e.g. `user_not_in_household`).
  - **More than one** → **`500`** in development tooling / **`409`** in production-facing behavior until data and schema enforce uniqueness (optional follow-up: **unique `userId`** on `HouseholdMembership`).
- **Canonical `householdId`** for Prisma queries comes from that membership row. If the JWT later includes **`householdId`**, it **must equal** the DB value or the server returns **`403`** (optional check once auth is wired).

### Development override

- When **`AUTH_MODE=development`** (or project-specific equivalent), allow a documented header (e.g. **`X-Dev-User-Id: <uuid>`**) that maps to a real **`User`** row. **Reject** this header when not in dev mode. Same membership rules apply.

### Public

- **`GET /api/health`** remains **unauthenticated** (existing behavior).
- **Auth (registration / login):** **`POST /api/auth/register`** and **`POST /api/auth/login`** are **unauthenticated**; full shape and rules are in [`2026-03-28-auth-api-design.md`](2026-03-28-auth-api-design.md).

## URL layout

- **Flat** resources under **`/api/*`** — no `householdId` in paths; scope is always implicit from the authenticated user’s household.

## Calendar dates

- **`DayPlan`** and query params use **`YYYY-MM-DD`** (ISO 8601 date only), consistent with [`docs/data-model.md`](../../data-model.md). **`date` query params** use the same format.
- Invalid format → **`422`**. **`from` / `to` range:** require **`from <= to`**; enforce a **max span** (e.g. **93 days**) to limit load.

## Pagination & sorting

- **`GET /api/meals`** and **`GET /api/ingredients`:** **`limit`** (default **50**, maximum **100**) and **`offset`** (default **0**). OpenAPI: document both query params explicitly.
- **`GET /api/day-plans`** with range returns **all rows in range** up to the **max span** (no pagination in v1 unless range cap is raised later).

## Errors

- Use a **small JSON object** everywhere with a stable **`code`** string (e.g. `user_not_in_household`, `no_eligible_meals`) plus optional **`message`**.
- **`401`** — missing/invalid bearer (or dev auth).
- **`403`** — authenticated but not allowed (e.g. dev header in prod, mismatched `householdId` claim if checked).
- **`404`** — unknown resource **or** no row in scope.
- **`GET /api/meals/random`** with **no eligible meals** after exclusions → **`404`** with **`code: "no_eligible_meals"`** (distinct from “unknown route” **404 empty body**; documented routes always return JSON errors).
- **`409`** — conflicts: duplicate **`(householdId, date)`** on day plan create if not upserting; duplicate ingredient name under normalization rules; multiple membership rows if enforced; **`DELETE /api/meals/{id}`** while a **`DayPlan`** still references lunch/dinner (**FK RESTRICT**); **`DELETE /api/ingredients/{id}`** while referenced as a **meal hero** (**FK RESTRICT**).
- **`422`** — validation (bad date string, bad range, invalid UUIDs, **meal ids not in household** on day-plan writes, etc.).

## Resources and endpoints

### Current user & household

| Method  | Path                     | Purpose                                                                                                                  |
| ------- | ------------------------ | ------------------------------------------------------------------------------------------------------------------------ |
| `GET`   | `/api/me`                | **`user`** fields plus **embedded `household`** (id, name, …) from the single membership — one round-trip for shell UIs. |
| `PATCH` | `/api/me`                | e.g. `displayName` (user only).                                                                                          |
| `GET`   | `/api/household`         | Household record only (redundant with `/api/me` but kept for simple CRUD symmetry).                                      |
| `PATCH` | `/api/household`         | e.g. `name`.                                                                                                             |
| `GET`   | `/api/household/members` | Member list **`{ userId, displayName }`** for **`MealCookedBy`** pickers (same household).                               |

### Meals

| Method   | Path                  | Purpose                                                                                                 |
| -------- | --------------------- | ------------------------------------------------------------------------------------------------------- |
| `GET`    | `/api/meals`          | List/search: pagination + optional quality filters + hero-ingredient AND filter (see below).            |
| `POST`   | `/api/meals`          | Create meal; body aligns with domain DTO (nested `qualities`, hero links optional).                     |
| `GET`    | `/api/meals/{mealId}` | Read one.                                                                                               |
| `PATCH`  | `/api/meals/{mealId}` | Update; may include hero-ingredient list and **`MealCookedBy`** user ids (same-household validation).   |
| `DELETE` | `/api/meals/{mealId}` | Delete; if **`DayPlan`** still references meal → **`409`** with stable **`code`** (e.g. `meal_in_use`). |
| `GET`    | `/api/meals/random`   | Random eligible meal (**required** `date=YYYY-MM-DD`).                                                  |

**`GET /api/meals` filters (query params):**

- **Qualities** (all four flags are filterable with identical semantics): **`makesLeftovers`**, **`isGreasy`**, **`isCreamy`**, **`isAcidic`**. **`=true`** → must be true; **`=false`** → must be false; **omitted** → no constraint.
- **Hero ingredients:** **`heroIngredientId`** only as **repeated** query keys (`heroIngredientId=a&heroIngredientId=b`) per OpenAPI **style: form, explode: true**. Meals must include **all** listed hero ingredients (AND).

**`GET /api/meals/random`:**

- **Query:** **`date`** (required, `YYYY-MM-DD`). Optional future query params can mirror list filters (qualities, hero ids).
- **Steps:** resolve `householdId` → compute **calendar previous and next day** (via **`date-fns`** + **`planDateFromYmd`**-compatible dates) → load **`DayPlan`** for those two days only → build **exclusion set** from **`dinnerMealId`** on each plan **if non-null** → subtract from household meals (and apply same optional filters if specified) → **uniform random** among remaining.
- **Adjacent lunch** is **not** excluded unless product changes.
- **No eligible meal** → **`404`** with **`code: "no_eligible_meals"`** (and human-readable `message`).

### Ingredients

| Method   | Path                              | Purpose                                                                                                                                                                                                        |
| -------- | --------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GET`    | `/api/ingredients`                | List (pagination).                                                                                                                                                                                             |
| `POST`   | `/api/ingredients`                | Create: **`name`** (required), **`storageType`** (required enum), **`perishable`** (optional boolean, default per Prisma/data-model). Normalize **`name`** for uniqueness (trim + case-folding) before insert. |
| `GET`    | `/api/ingredients/{ingredientId}` | Read.                                                                                                                                                                                                          |
| `PATCH`  | `/api/ingredients/{ingredientId}` | **Partial** update; same fields as create where supplied.                                                                                                                                                      |
| `DELETE` | `/api/ingredients/{ingredientId}` | Delete; if referenced as **meal hero** (**FK RESTRICT**) → **`409`** with e.g. **`code: "ingredient_in_use"`**.                                                                                                |

### Day plans

| Method   | Path                         | Purpose                                                                                                                                                                                                                                           |
| -------- | ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GET`    | `/api/day-plans?from=&to=`   | Inclusive range; validate span cap.                                                                                                                                                                                                               |
| `POST`   | `/api/day-plans`             | Create **one** plan; **`409`** if **`DayPlan`** already exists for **`(householdId, date)`** (no upsert on this path — use **`PATCH`** or **`POST /bulk`**).                                                                                      |
| `POST`   | `/api/day-plans/bulk`        | Body: array of `{ date, lunchMealId?, dinnerMealId? }`. **Idempotent upsert** per `(householdId, date)`. **`422`** if any **`mealId`** is unknown or not in caller’s household. **All-or-nothing** in one transaction (no partial success in v1). |
| `GET`    | `/api/day-plans/{dayPlanId}` | Read by id.                                                                                                                                                                                                                                       |
| `PATCH`  | `/api/day-plans/{dayPlanId}` | Update lunch/dinner ids (same-household meal checks).                                                                                                                                                                                             |
| `DELETE` | `/api/day-plans/{dayPlanId}` | Delete.                                                                                                                                                                                                                                           |

**Bulk semantics:** Only dates **present in the request body** are written; no “fill every day in range” in v1. Upsert creates rows with **null** lunch/dinner when omitted.

## Validation & invariants

- **`Meal`** lunch/dinner on **`DayPlan`** must belong to the **same `householdId`** as the plan (service-layer check; same as data model doc).
- **`MealCookedBy`:** **`userId`** must be a member of the meal’s household.

## OpenAPI

- Extend **`contracts/openapi.yaml`** for every new path, method, query param, and shared schema; keep **404 empty body** rule for **undocumented** routes as documented today.

## Testing

- **Integration tests** (Bun + Prisma) for: happy paths, **`403`** without membership, **range validation**, **bulk idempotency + rollback** on bad meal id, **`/api/meals/random`** exclusions (fixtures: prior/next dinner set vs unset), **empty pool → 404** with **`no_eligible_meals`**, **`DELETE` meal/ingredient** conflict **`409`**s.

## References

- [`docs/data-model.md`](../../data-model.md)
- [`docs/superpowers/specs/2026-03-28-data-model-design.md`](2026-03-28-data-model-design.md)
