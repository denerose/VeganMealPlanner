# Auth API design — registration, login, invitations, JWT

**Status:** Ready for human review (agent spec review: Approved)  
**Date:** 2026-03-28  
**Scope:** First-party **email + password** accounts, **signed JWT** access tokens, **email-bound household invitations**, **`HouseholdMembership` roles** (`OWNER` / `MEMBER`), **development auth override**, and a **`dev-seed`** script. Aligns with [`2026-03-28-rest-api-design.md`](2026-03-28-rest-api-design.md), [`docs/data-model.md`](../../data-model.md), and `prisma/schema.prisma`. **OAuth** is an explicit future extension (see [Non-goals (MVP)](#non-goals-mvp)).

**HTTP status:** Align with [`2026-03-28-rest-api-design.md`](2026-03-28-rest-api-design.md):

- **`401`** — **Bearer JWT** missing, malformed as a JWT, bad **signature**, **expired**, or wrong shape for access auth (stable codes, e.g. `invalid_token`).
- **`422`** — **JSON request body** validation only: email format, password policy, unknown/extra fields per OpenAPI, **invite token** wrong length/format when the server validates format before lookup, and **ambiguous registration body** (see [`POST /api/auth/register`](#post-apiauthregister)).
- **`403`** / **`409`** — as in the REST spec and the sections below.
- **`POST /api/auth/login`** wrong password or unknown email (product-chosen messaging) → **`401`**, not **`422`**.

## Goals

- **`POST /api/auth/register`** — two mutually exclusive paths:
  - **Create household:** new `User` + new `Household` + `HouseholdMembership` with **`role = OWNER`**.
  - **Join household:** new `User` + **`HouseholdMembership` with `role = MEMBER`** via a valid, email-bound **`HouseholdInvitation`** (no new household).
- **`POST /api/auth/login`** — verify email + password; return the same **access token envelope** as register.
- **`POST /api/household/invitations`** (authenticated) — create an invitation for a **specific email**; return a **one-time plaintext token** for sharing with the invitee (not stored in plaintext in DB).
- **Production:** **`Authorization: Bearer <JWT>`** where the server **signs and verifies** the JWT; payload **`sub`** is **`User.id`** (UUID), with **`exp`** (and **`iat`**). This replaces decode-only handling and closes the current verification gap.
- **Development:** keep **`AUTH_MODE=development`** and **`X-Dev-User-Id: <user-uuid>`** as today; **reject** that header when not in dev mode. Same **membership** rules as the REST spec for protected routes.
- **Public (unauthenticated) routes:** **`GET /api/health`**, **`POST /api/auth/register`**, **`POST /api/auth/login`** — must not require `HouseholdMembership` (register/login run before membership exists or use invite path).
- **`dev-seed` script:** idempotent seed of a **fixed-UUID dev user**, **dev household**, **`OWNER` membership**, and a small **plant-based** fixture set (meals, ingredients, day plans) so **`X-Dev-User-Id`** and integration tests stay stable.
- **OpenAPI** (`contracts/openapi.yaml`) documents new paths, request/response schemas, and security schemes.

## Non-goals (MVP)

- **OAuth / social login** — design assumes **`User.passwordHash`** may later be **null** for OAuth-linked accounts and a separate **provider identity** table will link **`User`** to issuer + subject; not specified here beyond that compatibility note.
- **Refresh tokens** — optional follow-up; **logout** endpoint is **optional** until refresh (or session) exists.
- **Email delivery** — invitations are **API-issued tokens**; no SMTP requirement for MVP (inviter copies link or token out of band).
- **Remove household member** — **not implemented** in MVP; [Future: remove members](#future-remove-members) records product and API intent.
- **Password reset / email verification** — follow-up.

## Data model (Prisma)

### `User`

- **`email`** — **unique**, **required** for locally registered users (normalized: **trim + lowercase** for storage and lookup).
- **`passwordHash`** — **required** for email/password accounts in MVP; **nullable** in schema for future OAuth-only users (must not allow login-with-password when null).
- Existing fields **`id`**, **`displayName`**, timestamps — unchanged.

**Migration note:** If the database already contains `User` rows without `email`, a one-time migration or backfill strategy is required before enforcing **NOT NULL** on `email` for legacy rows; greenfield dev DBs can apply the constraint immediately.

### `HouseholdMembership`

- Add **`role`** enum: **`OWNER` | `MEMBER`** (default **`MEMBER`** for safety; creation paths set **`OWNER`** explicitly when creating a household).
- **Exactly one `OWNER` per household** is a **product invariant** enforced in application logic on create/invite flows; optional follow-up: DB constraint or deferred trigger (hard to express purely in CHECK without care for migrations) — MVP relies on **transactional checks**.
- **No `householdOwner` flag on `User`** — ownership is expressed **only** via **`HouseholdMembership.role`** (option **A** agreed in design).

### `HouseholdInvitation` (new)

| Field              | Purpose |
| ------------------ | ------- |
| `id`               | UUID PK |
| `householdId`      | FK → `Household` |
| `email`            | Invitee email, **normalized** (trim + lowercase); **required** |
| `tokenHash`        | Hash of the **secret** token shown once on create (e.g. SHA-256 of raw token, or a dedicated slow hash if desired; **never** store raw token) |
| `createdByUserId`  | FK → `User` (must be **`MEMBER` or `OWNER`** of `householdId` at creation time) |
| `expiresAt`        | Instant after which the invite cannot be consumed |
| `usedAt`           | Nullable; set when consumed |
| `usedByUserId`     | Nullable; FK → `User` who registered with this invite |
| `createdAt`        | Audit |

**Semantics:**

- **Single-use:** once **`usedAt`** is set, the row cannot be reused.
- **Lookup:** registration supplies **plaintext token**; server hashes it and finds row by **`tokenHash`** (constant-time compare).
- **Multiple pending invites** for the same `(householdId, email)` are allowed unless product prefers uniqueness; if duplicates exist, **the matching unused, unexpired row** resolved by token hash is consumed (typically one active token per invite creation).

## Password hashing

- Use **Argon2id** (preferred) or **bcrypt** with sensible cost parameters, via a maintained library compatible with **Bun**.
- Enforce a **minimum password length** (e.g. **10** characters) and document in OpenAPI; optional max length to bound allocation.

## JWT access tokens

- **Algorithm:** **HS256** with **`JWT_SECRET`** from environment (long random string); document rotation as an operational concern.
- **Claims:** **`sub`** = **`User.id`** (UUID string), **`exp`**, **`iat`**. Optional future: **`householdId`** with [optional equality check](2026-03-28-rest-api-design.md) against DB.
- **TTL:** configurable (e.g. **`JWT_EXPIRES_IN`** as seconds or a parsed duration); document default (e.g. **15m** or **1h**) in `.env.example`.
- **Verification:** In **`AUTH_MODE` ≠ `development`**, **verify signature and `exp`** before trusting **`sub`**. Reject malformed or expired tokens with **`401`** and stable **`code`** (e.g. `invalid_token`).

## Route behavior

### `POST /api/auth/register`

**Body (create household path):**

- **`email`**, **`password`**, optional **`displayName`**, optional **`householdName`** (defaults documented, e.g. `"Home"`).
- **Must not** include **`householdInviteToken`**.

**Body (join household path):**

- **`email`**, **`password`**, **`householdInviteToken`**, optional **`displayName`**.
- **Must not** include **`householdName`** (or any field that implies creating a new household).

**Ambiguous or conflicting body:** If the client sends **both** create-household fields (e.g. **`householdName`**) **and** **`householdInviteToken`**, or the body otherwise does not match exactly one path allowed by OpenAPI → **`422`**, code **`invalid_registration_body`**.

**Processing:**

- Normalize **`email`**.
- **Password policy** → **`422`** if weak.
- **Duplicate `email`** → **`409`**, code e.g. `email_taken`.
- **Join path:** hash token → load invitation where **`usedAt` is null**, **`expiresAt > now`**, **`tokenHash` matches**; if missing or expired → **`422`**, code **`invite_invalid`** (generic message to avoid leaking existence); if **`email`** does not match invitation’s **`email`** → **`422`**, code **`invite_email_mismatch`**. (Contrast **Bearer JWT** errors on protected routes → **`401`**, not **`422`**.)
- **Transaction:** create **`User`** + **`passwordHash`**; create **`HouseholdMembership`** with **`role = OWNER`** (create path) or **`MEMBER`** (join path); join path also sets invitation **`usedAt` / `usedByUserId`**; create path creates **`Household`**.
- If the user would violate **single membership** (e.g. race) → **`409`**.

**Response `201`:** same envelope as login (below) plus any minimal **`user`** summary needed by clients (id, email, displayName). **Never** return **`passwordHash`**.

### `POST /api/auth/login`

**Body:** **`email`**, **`password`**.

**Response `200`:**

```json
{
  "accessToken": "<jwt>",
  "tokenType": "Bearer",
  "expiresIn": 3600,
  "user": { "id": "…", "email": "…", "displayName": "…" }
}
```

**Errors:** wrong credentials → **`401`**, stable **`code`** (e.g. `invalid_credentials`); use **one** message style for login failures to reduce user enumeration (product choice: same message for unknown email vs wrong password).

### `POST /api/household/invitations` (authenticated)

- Caller must have **`HouseholdMembership`** for their household (existing middleware).
- **MVP:** any household member may create invites; **future:** restrict to **`OWNER`** only if product requires.
- **Body:** **`email`** (invitee), optional **`expiresInHours`** with a **server-enforced maximum** (e.g. 168 = 7 days).
- **Response `201`:** **`token`** (plaintext, **shown once**), **`expiresAt`**, optionally **`email`**, **`householdId`** for UI. OpenAPI must state **token is not retrievable** via GET later.

### Protected routes (unchanged list + wiring)

- All existing **`/api/*`** routes except **`GET /api/health`** and **`POST /api/auth/register`** / **`POST /api/auth/login`** require resolved **`userId`** and **`HouseholdMembership`** as in [`2026-03-28-rest-api-design.md`](2026-03-28-rest-api-design.md).
- **`GET /api/me`** (and related DTOs) should expose **`membershipRole`** (or nested **`role`** under membership) so clients know **`OWNER` vs `MEMBER`**.

## Development override

- When **`AUTH_MODE=development`**, **`X-Dev-User-Id`** remains mandatory for protected routes (per current behavior): value is a **UUID** of an existing **`User`**.
- **`dev-seed`** creates that user so local workflows and integration tests do not guess UUIDs.
- When **`AUTH_MODE` is not `development`**, **`X-Dev-User-Id`** → **`403`** with stable **`code`** (existing behavior).

## `dev-seed` script

- **Command:** e.g. **`bun run dev-seed`** (implement as `scripts/dev-seed.ts` or under `scripts/` per repo convention).
- **Input:** **`DATABASE_URL`** (and any optional flags documented later).
- **Deterministic IDs:** define **constant UUIDs** in one module for **dev user**, **dev household**, and optionally fixture entity ids so **`X-Dev-User-Id`** is copy-paste stable across machines.
- **Idempotent:** safe to run repeatedly (upsert **`User`** by id or email, **`Household`**, **`HouseholdMembership`** with **`OWNER`**, then fixtures).
- **Credentials:** document a **default dev password** in **`.env.example`** / README (local only); hash stored matches that password after seed.
- **Fixtures:** small set of **vegan** meals, ingredients, and **day plans** on the dev household using **fixed `YYYY-MM-DD`** dates in a short window (predictable for tests and manual QA).
- **Do not** run automatically on **`bun run start`** unless explicitly decided later; keep seed **opt-in**.

## Future: remove members

- **Intent:** an **`OWNER`** may remove another **`MEMBER`** from the household (or revoke access).
- **Not in MVP** — no endpoint required yet, but schema and role model above are chosen to support:
  - **`DELETE /api/household/members/{userId}`** (or equivalent) callable only by **`OWNER`**.
  - Cannot remove the **last **`OWNER`** for a household** without **transfer ownership** (future **`PATCH`** or dedicated endpoint).
  - Cannot remove **yourself** as sole **`OWNER`** without transfer (product rule).
- **OAuth** addition should not change **`role`** semantics.

## Security notes

- Rate limiting and lockout for login — **follow-up** (not MVP unless trivial middleware exists).
- Invitation tokens: **high entropy** (e.g. **32+ bytes** random), single-use, expiry bounded.
- Log lines must **not** contain plaintext passwords or raw invitation tokens.

## OpenAPI & testing

- Extend **`contracts/openapi.yaml`** with paths, schemas, **`401`/`403`/`409`/`422`** responses, and document **`bearerAuth`** as **signed JWT** (issuer = this API). **Malformed JSON / unsupported body** for these routes should match whatever the API layer already does for other **`/api`** handlers and be documented consistently in OpenAPI.
- **Unit tests:** JWT sign/verify, password verify, `resolveAuthUserId` in dev vs prod with verification.
- **Integration tests:** register (both paths), login, duplicate email, bad invite token, email mismatch on invite, invitation create + consume; **`AUTH_MODE=development`** unchanged for existing suites.

## References

- [`docs/superpowers/specs/2026-03-28-rest-api-design.md`](2026-03-28-rest-api-design.md)
- [`docs/data-model.md`](../../data-model.md)
- `src/api/auth.ts`, `src/api/server.ts`, `contracts/openapi.yaml`
