# Superpowers implementation plans

This directory holds **task-by-task implementation plans** (often executed with **superpowers `subagent-driven-development`** or **`executing-plans`**). See [`AGENTS.md`](../../../AGENTS.md) for repo tooling (Bun, Prisma, checks).

## Controllers (host / main agent)

When you **dispatch Task subagents** or implementers for work that touches **`prisma/schema.prisma`** or **new migrations**:

1. Follow **`.cursor/rules/subagent-prisma-host-handoff.mdc`** and **`.cursor/skills/prisma-delegate-migrate/SKILL.md`**.
2. Paste this **verbatim** (or equivalent) into each relevant implementer prompt:

   ```text
   Schema-only in your session for Prisma. For migrations, follow .cursor/skills/prisma-delegate-migrate/SKILL.md: output the PRISMA_HOST_HANDOFF block and report status NEEDS_HOST_PRISMA; do not run migrate dev or write SQL under prisma/migrations/.
   ```

3. When the implementer returns **`NEEDS_HOST_PRISMA`**, run the handed-off commands yourself (e.g. `bunx prisma migrate dev`) in a normal shell with the database up—then continue the plan or re-dispatch with migration confirmed.

Never ask a subagent to recover from migrate failures by **editing `prisma/migrations/*.sql` by hand**; fix the schema and use Prisma’s workflow on the host (see **`.cursor/rules/prisma-no-hand-written-migrations.mdc`**).

## Subagents and shell tooling

Subagents must **not** use **Python** (including `python3 -c`, `pty.spawn`, or other wrappers) to run repo commands or fake terminals. Use **Bun** and normal shell only (`bun`, `bunx`, `sh`/`zsh`). Project rules: **`.cursor/rules/subagent-shell-bun-only.mdc`**.

If a CLI needs a persistent TTY and your environment allows it, **tmux** is acceptable; still no Python or pseudo-TTY automation to answer prompts—when in doubt, hand off to the host (same idea as Prisma migrate).

## Related

- **Prisma handoff skill:** [`.cursor/skills/prisma-delegate-migrate/SKILL.md`](../../../.cursor/skills/prisma-delegate-migrate/SKILL.md)
- **Host handoff rule:** `.cursor/rules/subagent-prisma-host-handoff.mdc`
- **Shell / no-Python rule:** `.cursor/rules/subagent-shell-bun-only.mdc`
