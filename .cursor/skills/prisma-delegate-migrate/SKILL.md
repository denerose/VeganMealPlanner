---
name: prisma-delegate-migrate
description: When Prisma migrate must run outside a subagent sandbox — subagent edits schema only and hands off exact commands; host runs bunx prisma and confirms.
---

# Prisma migrate handoff (subagent-safe)

## Controllers (host / main agent)

Before dispatching an implementer whose task changes **`prisma/schema.prisma`** or depends on a new migration, the **host** must paste this into the Task prompt (see rule **`subagent-prisma-host-handoff.mdc`**):

```text
Schema-only in your session for Prisma. For migrations, follow .cursor/skills/prisma-delegate-migrate/SKILL.md: output the PRISMA_HOST_HANDOFF block and report status NEEDS_HOST_PRISMA; do not run migrate dev or write SQL under prisma/migrations/.
```

After **`NEEDS_HOST_PRISMA`**, run the handed-off commands locally, then continue the plan or re-dispatch with migration confirmed.

## When to use

- A **subagent**, **Task** worker, or any session with a **restricted / fake / no-database** environment.
- Prisma **`migrate dev`** needs a real `DATABASE_URL`, interactive prompts, or a TTY — often failing or tempting bad workarounds (hand-written SQL, Python `pty`, etc.).

**Do not** fight the sandbox. **Delegate migrate to the host.**

## Subagent / delegate worker — required behavior

1. **Only change `prisma/schema.prisma`** (and Prisma config if the task explicitly requires it).  
   **Never** create, edit, or paste SQL under `prisma/migrations/`. Never add migration folders by hand.

2. **Do not run** `bunx prisma migrate dev` (or `db push`) inside the sandbox if the environment is wrong or has failed before.  
   If unsure, assume sandbox is wrong and hand off.

3. **Stop and hand off** using the block below. Include every command the host should run, in order, from repo root.

4. After handoff, your status is **`NEEDS_HOST_PRISMA`** (or describe in prose: “blocked on host migrate”).  
   Do not pretend the migration is applied until the host confirms.

5. **Safe follow-ups without DB** (optional, if types allow): `bun run typecheck`, unit tests that do not touch Prisma.  
   If typecheck requires generated client from a migration that is not applied yet, say so in the handoff.

### Handoff block (copy this template; fill in)

```text
## PRISMA_HOST_HANDOFF

Repo root: <absolute path>

Prerequisite: PostgreSQL reachable (e.g. podman compose per README). `DATABASE_URL` set.

Commands (run in host terminal, repo root):

1. bunx prisma migrate dev --name <migration_name>

Post-check (host):

2. bun run typecheck

Notes for host: <e.g. expect data loss prompt / empty DB / first migrate>

## END_PRISMA_HOST_HANDOFF
```

## Host session (main agent or human) — required behavior

1. Read the handoff block. Run the commands in a **normal local terminal** (or main Cursor agent shell with DB + network), not inside a disposable subagent.

2. If Prisma prompts (reset, rename), answer in that terminal. Use **tmux** only if you deliberately want a persistent TTY — not Python wrappers.

3. Reply to the subagent flow with a short confirmation:

   - Migration directory name (e.g. `prisma/migrations/20260328xxxx_auth_api/`)
   - Whether `bun run typecheck` passed on host

4. **Then** the next subagent task (or same worker in a new turn) may assume migrations exist and continue with code, seeds, tests.

## Plan / controller integration

- For **subagent-driven-development** (or similar): treat “Prisma migrate” as a **host checkpoint** between tasks.  
  Task N ends at `NEEDS_HOST_PRISMA` → host runs commands → Task N+1 starts with “migration on disk, DB applied.”

- Reference this skill in implementer prompts: *“For Prisma migrations, follow @prisma-delegate-migrate; do not write migration SQL.”*

## Rationale

- Keeps **schema changes** in agent context (diffs review well).  
- Keeps **migrate dev** where credentials, TTY, and podman actually work.  
- Avoids loops of failed CLI + forbidden hand-written migrations.
