# `vmp` — CLI for Vegan Meal Planner

A command-line client for interacting with a running [Vegan Meal Planner](../README.md) API. Authenticate, manage ingredients, meals, day plans, and household — without reaching for `curl` or Postman.

**Quick start:**

```bash
# Dev mode (no login needed — uses dev-user header)
VMP_DEV_USER_ID=00000000-0000-4000-8000-000000000001 bun run cli -- whoami

# Or link and use globally
bun run cli -- auth login --email dev@veganmealplanner.local
vmp whoami
```

---

## Installation

No build step required. The CLI is a TypeScript file run directly by Bun.

```bash
bun install
bun run cli -- <command> [subcommand] [flags]
```

Or after `bun install` (which registers the `vmp` bin):

```bash
bunx vmp <command> [subcommand] [flags]
```

---

## Authentication

The CLI supports two auth modes matching the API:

| Mode                 | How                                              | Use case                                       |
| -------------------- | ------------------------------------------------ | ---------------------------------------------- |
| **JWT** (production) | `vmp auth login` → token saved to `~/.vmp-token` | Normal usage                                   |
| **Dev header**       | `VMP_DEV_USER_ID=<uuid>` env var                 | Local development with `AUTH_MODE=development` |

**Token priority (highest to lowest):**

1. `VMP_TOKEN` env var
2. `~/.vmp-token` file (written by `login` / `register`)
3. `VMP_DEV_USER_ID` env var (development only — sets `X-Dev-User-Id` header)

---

## Global flags

| Flag              | Description                                                                   |
| ----------------- | ----------------------------------------------------------------------------- |
| `--api-url <url>` | Override the API base URL (default: `http://localhost:3000` or `VMP_API_URL`) |
| `--json`          | Output raw JSON instead of formatted tables                                   |
| `--help`, `-h`    | Show help (context-aware: `vmp --help`, `vmp ingredients --help`)             |

### Environment variables

| Variable          | Description                                      |
| ----------------- | ------------------------------------------------ |
| `VMP_API_URL`     | API base URL (default: `http://localhost:3000`)  |
| `VMP_TOKEN`       | Bearer token — overrides `~/.vmp-token` file     |
| `VMP_DEV_USER_ID` | Dev-mode user UUID — sets `X-Dev-User-Id` header |

---

## Commands

### `vmp health`

Check API health and database connectivity.

```bash
vmp health                  # human-readable
vmp health --json           # {"status":"ok"}
```

---

### `vmp auth`

| Subcommand | Description                     |
| ---------- | ------------------------------- |
| `login`    | Log in with email and password  |
| `register` | Register a new account          |
| `logout`   | Clear saved token               |
| `whoami`   | Show current user and household |
| `profile`  | Update current user profile     |

#### `vmp auth login`

```bash
vmp auth login --email user@example.com --password secret123
# Or interactively (prompts for missing fields):
vmp auth login
```

Saves the JWT to `~/.vmp-token` (file permissions `0600`).

#### `vmp auth register`

```bash
# Create a new household:
vmp auth register \
  --email user@example.com \
  --password secret123 \
  --display-name "Chef Tofu" \
  --household-name "Our Kitchen"

# Join an existing household:
vmp auth register \
  --email user@example.com \
  --password secret123 \
  --household-invite-token <token>
```

| Flag                               | Description                                                                       |
| ---------------------------------- | --------------------------------------------------------------------------------- |
| `--email <email>`                  | Email address (required)                                                          |
| `--password <pw>`                  | Password, minimum 10 characters (required)                                        |
| `--display-name <name>`            | Display name (optional)                                                           |
| `--household-name <name>`          | Create a household with this name (optional)                                      |
| `--household-invite-token <token>` | Join an existing household (optional, mutually exclusive with `--household-name`) |

Missing required flags trigger interactive prompts when stdin is a TTY; otherwise an error is printed naming the missing flag.

#### `vmp auth logout`

```bash
vmp auth logout
```

Calls the API logout endpoint (best-effort) and deletes `~/.vmp-token`.

#### `vmp auth whoami`

```bash
vmp auth whoami
vmp auth whoami --json
```

#### `vmp auth profile`

```bash
vmp auth profile --display-name "New Name"
```

| Flag                    | Description                                      |
| ----------------------- | ------------------------------------------------ |
| `--display-name <name>` | Update display name. Pass empty string to clear. |

---

### `vmp ingredients`

| Subcommand    | Description             |
| ------------- | ----------------------- |
| `list`        | List ingredients        |
| `get <id>`    | Get a single ingredient |
| `create`      | Create an ingredient    |
| `update <id>` | Update an ingredient    |
| `delete <id>` | Delete an ingredient    |

#### `vmp ingredients list`

```bash
vmp ingredients list
vmp ingredients list --limit 10 --offset 20 --json
```

| Flag           | Description                                    |
| -------------- | ---------------------------------------------- |
| `--limit <n>`  | Page size (default: API default, typically 50) |
| `--offset <n>` | Page offset                                    |

#### `vmp ingredients get <id>`

```bash
vmp ingredients get 00000000-0000-4000-8000-000000000001
```

#### `vmp ingredients create`

```bash
vmp ingredients create \
  --name "extra-firm tofu" \
  --storage-type REFRIGERATED \
  --perishable
```

| Flag                    | Description                                                           |
| ----------------------- | --------------------------------------------------------------------- |
| `--name <name>`         | Ingredient name (required)                                            |
| `--storage-type <type>` | `PANTRY` \| `REFRIGERATED` \| `FROZEN` \| `FRESH` (required)          |
| `--perishable`          | Mark as perishable. Use `--perishable false` to explicitly set false. |

#### `vmp ingredients update <id>`

```bash
vmp ingredients update <id> --name "silken tofu" --perishable false
```

| Flag                    | Description                             |
| ----------------------- | --------------------------------------- |
| `--name <name>`         | New name                                |
| `--storage-type <type>` | New storage type                        |
| `--perishable`          | Update perishable flag (`true`/`false`) |

#### `vmp ingredients delete <id>`

```bash
vmp ingredients delete <id>
```

---

### `vmp meals`

| Subcommand    | Description                  |
| ------------- | ---------------------------- |
| `list`        | List meals                   |
| `get <id>`    | Get a single meal            |
| `create`      | Create a meal                |
| `update <id>` | Update a meal                |
| `delete <id>` | Delete a meal                |
| `random`      | Get a random meal for a date |

#### `vmp meals list`

```bash
vmp meals list
vmp meals list --limit 10 --offset 20 --json
```

Shows name, leftovers flag, truncated description, and last updated date.

| Flag           | Description |
| -------------- | ----------- |
| `--limit <n>`  | Page size   |
| `--offset <n>` | Page offset |

#### `vmp meals get <id>`

```bash
vmp meals get <id>
```

Shows all qualities, hero ingredients, recipe URL, etc.

#### `vmp meals create`

```bash
vmp meals create --name "Coconut lentil curry" --description "Weeknight staple"
```

| Flag                   | Description            |
| ---------------------- | ---------------------- |
| `--name <name>`        | Meal name (required)   |
| `--description <text>` | Description (optional) |
| `--recipe-url <url>`   | Recipe URL (optional)  |

#### `vmp meals update <id>`

```bash
vmp meals update <id> --name "New name" --description "Updated desc"
```

| Flag                   | Description     |
| ---------------------- | --------------- |
| `--name <name>`        | New name        |
| `--description <text>` | New description |
| `--recipe-url <url>`   | New recipe URL  |

#### `vmp meals delete <id>`

```bash
vmp meals delete <id>
```

#### `vmp meals random`

```bash
vmp meals random --date 2026-05-17
```

| Flag                  | Description              |
| --------------------- | ------------------------ |
| `--date <YYYY-MM-DD>` | Calendar date (required) |

---

### `vmp day-plans`

| Subcommand    | Description                            |
| ------------- | -------------------------------------- |
| `list`        | List day plans in a date range         |
| `get <id>`    | Get a single day plan                  |
| `create`      | Create a day plan                      |
| `update <id>` | Update a day plan                      |
| `delete <id>` | Delete a day plan                      |
| `bulk`        | Bulk upsert day plans from a JSON file |

#### `vmp day-plans list`

```bash
vmp day-plans list --from 2026-05-01 --to 2026-05-07
```

| Flag                  | Description           |
| --------------------- | --------------------- |
| `--from <YYYY-MM-DD>` | Start date (required) |
| `--to <YYYY-MM-DD>`   | End date (required)   |

#### `vmp day-plans get <id>`

```bash
vmp day-plans get <id>
```

#### `vmp day-plans create`

```bash
vmp day-plans create \
  --date 2026-05-17 \
  --lunch-meal-id <uuid> \
  --dinner-meal-id <uuid>
```

| Flag                      | Description               |
| ------------------------- | ------------------------- |
| `--date <YYYY-MM-DD>`     | Plan date (required)      |
| `--lunch-meal-id <uuid>`  | Lunch meal ID (optional)  |
| `--dinner-meal-id <uuid>` | Dinner meal ID (optional) |

#### `vmp day-plans update <id>`

```bash
vmp day-plans update <id> --lunch-meal-id <uuid>
```

| Flag                      | Description        |
| ------------------------- | ------------------ |
| `--lunch-meal-id <uuid>`  | New lunch meal ID  |
| `--dinner-meal-id <uuid>` | New dinner meal ID |

#### `vmp day-plans delete <id>`

```bash
vmp day-plans delete <id>
```

#### `vmp day-plans bulk`

```bash
vmp day-plans bulk --file week-plan.json
```

| Flag            | Description                                                            |
| --------------- | ---------------------------------------------------------------------- |
| `--file <path>` | Path to a JSON file containing an array of day plan objects (required) |

The JSON file should contain an array matching the API's `DayPlanCreate` schema:

```json
[
  { "date": "2026-05-17", "lunchMealId": "uuid", "dinnerMealId": "uuid" },
  { "date": "2026-05-18", "lunchMealId": "uuid" }
]
```

---

### `vmp household`

| Subcommand | Description                     |
| ---------- | ------------------------------- |
| `show`     | Show current household          |
| `update`   | Update household name           |
| `members`  | List household members          |
| `invite`   | Invite someone to the household |

#### `vmp household show`

```bash
vmp household show
```

#### `vmp household update`

```bash
vmp household update --name "Plant-Based Kitchen"
```

| Flag            | Description                   |
| --------------- | ----------------------------- |
| `--name <name>` | New household name (required) |

#### `vmp household members`

```bash
vmp household members
```

#### `vmp household invite`

```bash
vmp household invite --email friend@example.com
vmp household invite --email friend@example.com --expires-in-hours 48
```

| Flag                     | Description                                                  |
| ------------------------ | ------------------------------------------------------------ |
| `--email <email>`        | Invitee's email address (required)                           |
| `--expires-in-hours <n>` | Hours until invite expires (default: 168 / 7 days, max: 168) |

On success, prints the invite token and a ready-to-use `vmp auth register` command.

---

## Interactive prompts

When stdin is a TTY and a required flag is missing, the CLI prompts interactively:

```
$ vmp auth login
Email: user@example.com
Password:          ← hidden input (no echo)
```

When stdin is **not** a TTY (piped input, CI, agents), the CLI prints an actionable error instead of hanging:

```
$ vmp auth login --email user@example.com
Error: Missing required flag: --password. Provide it or run interactively.
```

---

## Output formats

The default output is a human-readable aligned table or key-value listing. Add `--json` to any command for raw JSON output suitable for scripting:

```bash
vmp ingredients list --json
vmp auth whoami --json
```

---

## Token storage

| Detail      | Value                                       |
| ----------- | ------------------------------------------- |
| File        | `~/.vmp-token`                              |
| Permissions | `0600` (owner read/write only)              |
| Content     | Plain JWT access token                      |
| Written by  | `auth login`, `auth register`               |
| Removed by  | `auth logout`                               |
| Override    | `VMP_TOKEN` env var always takes precedence |

**Security note:** On shared machines, prefer `VMP_TOKEN` over the file. The token file uses the same threat model as `~/.netrc` or `~/.npmrc` — any process running as your user can read it.

---

## Architecture

The CLI lives in `src/cli/` and uses no external runtime dependencies:

```
src/cli/
├── index.ts              Entry point, arg parsing, subcommand routing
├── types.ts              Shared ParsedFlags interface
├── config.ts             API URL, token loading, file persistence
├── client.ts             ApiClient (typed fetch wrapper), ApiClientError
├── prompt.ts             Interactive prompts, hidden input, TTY detection
├── format.ts             Table, record, date, JSON formatting
└── commands/
    ├── auth.ts           login, register, logout, whoami, profile
    ├── ingredients.ts    CRUD for ingredients
    ├── meals.ts          CRUD + random for meals
    ├── day-plans.ts      CRUD + bulk for day plans
    └── household.ts      show, update, members, invite
```

### Key design decisions

- **Manual arg parsing** — uses `Bun.argv` directly, no external arg parser library
- **File-based token persistence** — `~/.vmp-token` with `0600` perms after login; `VMP_TOKEN` env var overrides; `logout` deletes the file
- **Interactive prompts for missing flags** — TTY prompts with hidden password input; non-TTY prints error naming the missing flag (machine-parseable for agents)
- **Manual pagination** — `--limit`/`--offset` matching the API; auto-pagination can be added later
- **Content-Type management** — `application/json` is sent only on requests with a body (POST, PATCH), not on bodyless requests (GET, DELETE)
