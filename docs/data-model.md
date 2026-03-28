# Data model

Use this page to find **where the data model is defined** and **what to update when it changes**. It is independent of any single implementation or VOM plan.

## Quick links

| Artifact                                                       | Purpose                                                                                                |
| -------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| [Prisma schema](../prisma/schema.prisma)                       | **Canonical** tables, columns, relations, and enums for PostgreSQL.                                    |
| `src/domain/types/`, `src/domain/dtos/`, `src/domain/mappers/` | TypeScript IDs, enums, API DTOs, and persistence→DTO mappers (align with OpenAPI as routes are added). |

## Entities (MVP overview)

- **Household** — tenancy boundary for meals, ingredients, and day plans.
- **User** — identity (unique **email**, optional **password hash** for first-party auth); linked via **HouseholdMembership**.
- **HouseholdInvitation** — time-bound invite to join a household by email; plaintext token returned once at creation; stored as **token hash** in the database.
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
2. **`docs/data-model.md`** — update this file whenever the data model changes.
3. **`src/domain`** and **`contracts/openapi.yaml`** — when types or HTTP contracts are affected.

For **HTTP validation** status codes, the REST API spec ([`docs/superpowers/specs/2026-03-28-rest-api-design.md`](superpowers/specs/2026-03-28-rest-api-design.md)) uses **`422`** for request validation.

Same PR as the schema change is ideal so docs never lag behind main.

## Relational model (tables)

### `Household`

- `id` (PK)
- `createdAt`, `updatedAt`
- Optional `name` (or similar) for UI — may be deferred to first implementation pass if not needed for MVP.

### `User`

- `id` (PK)
- `email` — **unique**; normalized for lookups (see auth implementation / OpenAPI)
- `passwordHash` — **nullable**; Argon2id (or equivalent) digest for first-party login; **never** exposed on HTTP responses
- `displayName` — optional profile label for UI (e.g. cook pickers)
- `createdAt`, `updatedAt`

### `HouseholdMembership`

- `userId` (FK → `User`)
- `householdId` (FK → `Household`)
- `role` — enum **`HouseholdRole`**: **`OWNER`**, **`MEMBER`**; Prisma default **`MEMBER`** on create
- Composite PK / unique pair `(userId, householdId)`

**API exposure (same enum values as Prisma / OpenAPI `HouseholdRole`):**

- **`GET /api/me`** — includes **`membershipRole`**: the caller’s role in the resolved household (`OWNER` or `MEMBER`). See `MeResponse` in [`contracts/openapi.yaml`](../contracts/openapi.yaml).
- **`GET /api/household/members`** — each list item includes **`role`** per member (for cook pickers and permission-aware UIs). See `HouseholdMember` in OpenAPI.

### `HouseholdInvitation`

- `id` (PK)
- `householdId` (FK → `Household`, cascade delete)
- `email` — address the invite targets (normalized consistently with registration)
- `tokenHash` — **unique**; stores a one-way hash of the secret token (the **plaintext token** is returned only in the **`POST /api/household/invitations`** **201** response)
- `createdByUserId` (FK → `User`, **restrict** on delete)
- `expiresAt` — invite invalid after this instant
- `usedAt` — **nullable**; set when an invite is successfully consumed (e.g. register **join** path)
- `usedByUserId` — **nullable** (FK → `User`, **set null** on delete); user who redeemed the invite
- `createdAt`

**Lifecycle (conceptual):**

1. **Created** — an authenticated household member calls **`POST /api/household/invitations`**; row inserted with `tokenHash`, `expiresAt`, and optional TTL from request; client receives plaintext **`token`** once.
2. **Pending** — invite is valid if `usedAt` is null and **now** is before `expiresAt`.
3. **Consumed** — registration (or equivalent flow) with a valid token sets **`usedAt`** and **`usedByUserId`** and creates a **`HouseholdMembership`** (typically **`MEMBER`**) for the new user.
4. **Expired / superseded** — unused invites past **`expiresAt`** are rejected; used rows remain for audit (behavior for duplicate invites to the same email is defined in the service layer and OpenAPI error codes).

**Never** return `passwordHash` or invitation `tokenHash` on public HTTP responses; only the one-time **`token`** field on invitation create matches the stored hash at redemption time.

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
