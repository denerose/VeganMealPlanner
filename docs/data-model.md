# Data model (index)

Use this page to find **where the data model is defined** and **what to update when it changes**. It is independent of any single implementation or VOM plan.

## Quick links

| Artifact                                                                    | Purpose                                                                                                |
| --------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| [Prisma schema](../prisma/schema.prisma)                                    | **Canonical** tables, columns, relations, and enums for PostgreSQL.                                    |
| [Data model design spec](superpowers/specs/2026-03-28-data-model-design.md) | Design intent: household tenancy, DTO vs storage shape, constraints, testing notes.                    |
| `src/domain/types/`, `src/domain/dtos/`, `src/domain/mappers/`              | TypeScript IDs, enums, API DTOs, and persistence→DTO mappers (align with OpenAPI as routes are added). |

## Entities (MVP overview)

- **Household** — tenancy boundary for meals, ingredients, and day plans.
- **User** — identity; linked via **HouseholdMembership**.
- **Meal** — library item; flat quality booleans in DB; nested `qualities` in API DTOs; optional `recipeUrl`, opaque `imageId`.
- **Ingredient** — per-household catalog; `storageType` + `perishable`; linked to meals via **MealHeroIngredient**.
- **MealCookedBy** — which users cooked a meal (members of the same household).
- **DayPlan** — per household and calendar **date**; optional lunch and dinner meal references.

For field-level detail and rules, use the spec and Prisma schema above.

## Calendar dates (`DayPlan`)

- Clients send a **calendar day** as **`YYYY-MM-DD`**.
- **MVP:** Treat that string as a **naive** date (no per-household timezone). The app converts it for persistence using `planDateFromYmd` in `src/domain/lib/plan-date.ts` (UTC noon → Postgres `DATE`); behavior is documented so future timezone rules can change without altering the column type.
- **Future:** Optional per-household timezone can redefine how “which day” maps to stored `date`.

## When you change the model

1. **Migrations / `schema.prisma`** — always.
2. **`docs/data-model.md`** — update this overview if entities, links, or the “what to read” table is no longer accurate.
3. **Design spec** — update [2026-03-28-data-model-design.md](superpowers/specs/2026-03-28-data-model-design.md) when behavior, invariants, or product rules change (not only for renames).
4. **`src/domain`** and **`contracts/openapi.yaml`** — when types or HTTP contracts are affected.

Same PR as the schema change is ideal so docs never lag behind main.

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
- `perishable` — **boolean**; Prisma default **`false`** on create unless the API sets it
- `createdAt`, `updatedAt`
- Uniqueness: `(householdId, name)` with **normalization** (trim + consistent case-folding, e.g. lowercase) for comparison and constraint, unless product explicitly allows duplicate spellings (then document the alternate rule in the implementation plan).

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
- `date` — Postgres `date` (calendar day only)
- `lunchMealId` (nullable FK → `Meal`)
- `dinnerMealId` (nullable FK → `Meal`)
- `createdAt`, `updatedAt`
- Unique `(householdId, date)`

**Semantics:** Rows may exist before lunch/dinner are chosen (draft planning). The client supplies **date as** `YYYY-MM-DD`. The DB stores **date only**; the implementation plan must record an explicit default for how that maps to “local calendar day” (e.g. per-household timezone vs fixed offset) so behavior is testable and documented for API clients.
