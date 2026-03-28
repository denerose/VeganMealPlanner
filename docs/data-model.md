# Data model (index)

Use this page to find **where the data model is defined** and **what to update when it changes**. It is independent of any single implementation or VOM plan.

## Quick links

| Artifact | Purpose |
|----------|---------|
| [Prisma schema](../prisma/schema.prisma) | **Canonical** tables, columns, relations, and enums for PostgreSQL. |
| [Data model design spec](superpowers/specs/2026-03-28-data-model-design.md) | Design intent: household tenancy, DTO vs storage shape, constraints, testing notes. |
| `src/domain/types/`, `src/domain/dtos/` | TypeScript IDs, enums, and API-oriented DTOs (align with OpenAPI as routes are added). |

## Entities (MVP overview)

- **Household** — tenancy boundary for meals, ingredients, and day plans.
- **User** — identity; linked via **HouseholdMembership**.
- **Meal** — library item; flat quality booleans in DB; nested `qualities` in API DTOs; optional `recipeUrl`, opaque `imageId`.
- **Ingredient** — per-household catalog; `storageType` + `perishable`; linked to meals via **MealHeroIngredient**.
- **MealCookedBy** — which users cooked a meal (members of the same household).
- **DayPlan** — per household and calendar **date**; optional lunch and dinner meal references.

For field-level detail and rules, use the spec and Prisma schema above.

## When you change the model

1. **Migrations / `schema.prisma`** — always.
2. **`docs/data-model.md`** — update this overview if entities, links, or the “what to read” table is no longer accurate.
3. **Design spec** — update [2026-03-28-data-model-design.md](superpowers/specs/2026-03-28-data-model-design.md) when behavior, invariants, or product rules change (not only for renames).
4. **`src/domain`** and **`contracts/openapi.yaml`** — when types or HTTP contracts are affected.

Same PR as the schema change is ideal so docs never lag behind main.
