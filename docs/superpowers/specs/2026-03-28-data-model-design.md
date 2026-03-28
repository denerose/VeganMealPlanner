# Data model design — Meal library & day plans (MVP)

**Status:** Ready for implementation planning (reviewed 2026-03-28)  
**Date:** 2026-03-28  
**Scope:** TypeScript domain types/DTOs and PostgreSQL (relational) persistence for the Vegan Meal Planner API. No HTTP route definitions in this document; OpenAPI will follow.

## Goals

- Users manage a **meal library** (CRUD) scoped to a **household**.
- Users create and update **day plans** for calendar days in a coming period (week, month, etc.): **dinner** always in scope; **lunch** optional. **Breakfast** and **snacks** are out of scope for MVP.
- Data model aligns with **PostgreSQL** and **Prisma** as the persistence layer; **`src/domain`** holds IDs, enums, and API-oriented DTOs with mappers from persistence.

## Tenancy

- **`Household`** is the tenancy boundary. Meals, ingredients, day plans, and memberships reference **`householdId`**.
- **`User`** exists as a distinct entity. **`HouseholdMembership`** links `userId` + `householdId` with a unique pair `(userId, householdId)`. Optional `role` may be added later without changing this spec’s core tables.

## Relational model (tables)

### `Household`

- `id` (PK)
- `createdAt`, `updatedAt`
- Optional `name` (or similar) for UI — may be deferred to first implementation pass if not needed for MVP.

### `User`

- `id` (PK)
- `createdAt`, `updatedAt`
- Profile fields as needed for MVP (e.g. `displayName`). Auth-specific fields arrive when authentication is implemented.

### `HouseholdMembership`

- `userId` (FK → `User`)
- `householdId` (FK → `Household`)
- Unique `(userId, householdId)`

### `Meal`

- `id` (PK), `householdId` (FK → `Household`)
- `name` (string), `description` (string) — **non-null** in DB; empty string allowed when the user leaves description blank
- `recipeUrl` (nullable string)
- `imageId` (nullable string) — **opaque**; no `Image` / asset table in MVP
- **Qualities** (boolean columns, default `false`):
  - `makesLeftovers`
  - `isGreasy`
  - `isCreamy`
  - `isAcidic`
- `createdAt`, `updatedAt`

New qualities in the future = **new boolean columns** + migration (explicit trade-off for simplicity and query clarity).

### `Ingredient` (household catalog)

- `id` (PK), `householdId` (FK → `Household`)
- `name` (string)
- `storageType` — enum (initial set: e.g. `PANTRY`, `REFRIGERATED`, `FROZEN`, `FRESH`; extend via migration)
- `perishable` — **boolean** (choose a single default in implementation and document it)
- `createdAt`, `updatedAt`
- Uniqueness: **`(householdId, name)`** with **normalization** (trim + consistent case-folding, e.g. lowercase) for comparison and constraint, unless product explicitly allows duplicate spellings (then document the alternate rule in the implementation plan).

### `MealHeroIngredient` (junction)

- `mealId` (FK → `Meal`), `ingredientId` (FK → `Ingredient`)
- `sortOrder` (small integer) for menu-style ordering
- Unique `(mealId, ingredientId)`

### `MealCookedBy` (junction)

- `mealId` (FK → `Meal`), `userId` (FK → `User`)
- Unique `(mealId, userId)`
- **Invariant (application layer):** `userId` must be a member of the meal’s household (`HouseholdMembership`). Same-household checks for meal ↔ day plan links are also enforced in the service layer (Postgres does not express cross-row household equality trivially without triggers).

### `DayPlan`

- `id` (PK), `householdId` (FK → `Household`)
- `date` — Postgres **`date`** (calendar day only)
- `lunchMealId` (nullable FK → `Meal`)
- `dinnerMealId` (nullable FK → `Meal`)
- `createdAt`, `updatedAt`
- Unique **`(householdId, date)`**

**Semantics:** Rows may exist before lunch/dinner are chosen (draft planning). The client supplies **date as `YYYY-MM-DD`**. The DB stores **date only**; the implementation plan must record an explicit default for how that maps to “local calendar day” (e.g. per-household timezone vs fixed offset) so behavior is testable and documented for API clients.

## API / domain DTO shape (not storage)

- **Response DTOs** expose meal **qualities** as a nested object, e.g. `qualities: { makesLeftovers, isGreasy, isCreamy, isAcidic }`, mapped from flat columns.
- **Hero ingredients** in meal responses: list of `{ ingredientId, name, storageType, perishable, sortOrder }` (or equivalent), resolved via joins through `MealHeroIngredient`.
- **`cookedBy`:** `UserId[]` in DTOs, backed by `MealCookedBy`.
- Separate **create** / **update** (partial) DTOs for meals and day plans as needed for the first API slice.

## TypeScript layout (`src/domain`)

- **`types/ids.ts`** — branded string types: `HouseholdId`, `UserId`, `MealId`, `IngredientId`, `DayPlanId` (runtime: string, typically UUID).
- **`types/enums.ts`** (or split files) — `IngredientStorageType`; meal quality keys remain column-backed until extended.
- **`dtos/`** — meal, ingredient, day-plan, household/membership as needed; keep HTTP shapes explicit for future OpenAPI alignment.
- **Mappers** — e.g. `src/domain/mappers/` or colocated with handlers: persistence row + joined data → response DTOs.

**Approach:** Prisma schema is the **persistence** source of truth; **domain DTOs** decouple HTTP/API from raw Prisma shapes (recommended over exposing Prisma types at the edge).

## Integrity, errors, and deletes

- **Foreign keys** on all explicit relations (`householdId`, `mealId`, `ingredientId`, `userId` where applicable).
- **Cross-household:** validate in services before writes (meal on day plan belongs to same household as day plan; cooks are household members).
- **Deleting a `Meal` referenced by `DayPlan`:** MVP default **`RESTRICT`** (delete fails with a conflict) unless the API explicitly supports cascading clear of slots in a transaction — **implement `RESTRICT` first** for predictability.
- **HTTP-oriented errors (when routes exist):** 404 wrong id / wrong household; 400 validation; 409 conflicts (duplicate ingredient name per rules, delete meal in use).

## Indexing

- Index or unique constraints as implied above: `DayPlan (householdId, date)` unique; consider index on `Meal(householdId)`, `Ingredient(householdId)`, `DayPlan(householdId)` for list/range queries.

## Testing strategy (scripts)

Split tests so **integration** runs less often locally:

- **`tests/unit/`** — mappers, validation, pure logic, no database.
- **`tests/integration/`** — Prisma/Postgres (or API against real DB) tests.

**npm/bun scripts (to implement):**

- `test:unit` — e.g. `bun test tests/unit`
- `test:integration` — e.g. `bun test tests/integration`
- `test:all` — both suites
- Default **`test`** → **`test:unit`** for a fast local loop.

**`scripts/check.sh`:** run **unit tests only** for local “check”; run **`test:all`** in CI before merge (or a dedicated CI job for integration). Relocate existing tests (e.g. `tests/api/`) under `tests/integration/` when wiring this up.

## Documentation in the repo

This spec is the **design record** (rationale, invariants, DTO rules). It is intentionally **separate from any one implementation plan** so humans and agents can refer to it for as long as the product area exists. It does **not** replace the database’s mechanical definition.

### Sources of truth (by concern)

| Concern | Where it lives | Role |
|--------|----------------|------|
| **Tables, columns, enums, indexes** | `prisma/schema.prisma` (and migrations) | Canonical **persistence** shape; must match deployed Postgres. |
| **Design intent & cross-cutting rules** | `docs/superpowers/specs/2026-03-28-data-model-design.md` (this doc) | **Why** and **how** (tenancy, nested DTOs vs flat storage, delete rules, date semantics). Update when behavior or product rules change, not only when column names change. |
| **API-facing types** | `src/domain/` (`types/`, `dtos/`, mappers) | What handlers and clients conceptually exchange; should stay aligned with OpenAPI when routes exist. |
| **Discovery / quick orientation** | `docs/data-model.md` | Short **index**: entity list, links to the spec and Prisma schema, and a **maintenance** note so contributors know what to update together. |

### Keeping docs current (process)

- Any PR that **changes the relational model** (Prisma schema / migrations) must **update `docs/data-model.md`** if the overview table, entity list, or links would otherwise be wrong.
- The same PR should **revise this spec** when the change is not purely mechanical (e.g. new invariants, new qualities strategy, tenancy rules). For renames-only changes, updating Prisma + `docs/data-model.md` may suffice; if rationale shifts, update the spec in the same or a follow-up PR.
- Agents and reviewers: treat **schema + index doc + spec (when applicable)** as the default checklist for “data model documentation” completeness.

`AGENTS.md` points to **`docs/data-model.md`** so agents and devs can find the data model without opening a ticket plan.

## Out of scope (MVP)

- Breakfast/snacks slots
- `Image` / upload pipeline as a first-class table
- User preferences / suggestion constraints (qualities are stored to support this later)
- Qualities as EAV/JSONB (explicitly **not** chosen; columns + migrations for new flags)

## Summary

The MVP relational core is: **Household**, **User**, **HouseholdMembership**, **Meal** (with boolean quality columns and opaque `imageId`), **Ingredient** (with `storageType` + `perishable`), **MealHeroIngredient**, **MealCookedBy**, and **DayPlan** (nullable lunch/dinner, unique per household per date). TypeScript DTOs nest `qualities` for API consumers; persistence stays flat and relational. **Repo documentation:** see [Documentation in the repo](#documentation-in-the-repo) and the living index at `docs/data-model.md`.
