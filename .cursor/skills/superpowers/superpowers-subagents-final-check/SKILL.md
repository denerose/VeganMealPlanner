---
name: superpowers-subagents-final-check
description: Closes the loop after subagent-driven code-quality or spec reviews by reconciling all reviewer feedback with the repo, then creating VOM tickets for valuable work that is still open. Use after a Task/code-reviewer chain, when finishing a multi-task plan, or when the user asks to process review feedback into tickets.
---

# Superpowers subagents — final check (review closeout)

Run this **after** implementer + spec + code-quality subagent chains (or any session that produced structured review feedback). Goal: **nothing important is lost**—either it is already fixed in the tree, or it is **tracked** on VOM.

## When to use

- User asks to process reviewer feedback, suggestions, or “minor” items into work items.
- A **subagent-driven-development** task batch just finished and reviews mentioned follow-ups.
- Before **verification-before-completion** or merge, to drain review debt.

## Before you start

1. **Collect inputs:** transcripts, chat summaries, or the reviewer’s last message listing Strengths / Issues (Critical, Important, Minor) / Suggestions / Assessment.
2. **Repo root:** run `vom` from the project root (`AGENTS.md`, Bun tooling).

## Workflow

### 1. Normalize the feedback list

From each review, extract rows with:

- **Severity** (Critical / Important / Minor / Suggestion / note)
- **Short title** (what to change)
- **File or area** if given

Merge duplicates across reviews of the same commit or feature.

### 2. Check the codebase for each item

For every row, decide:

| State | Action |
|-------|--------|
| **Already implemented** in current tree | Mark *resolved*; no ticket. |
| **Partially addressed** (e.g. comment added, not full fix) | Ticket only if meaningful work remains. |
| **Operational / docs only** | Prefer `vom new -t docs` when no code change is required yet. |
| **Refactor / test stability** | `vom new -t refactor` or `-t task` as appropriate. |
| **Product or schema decision deferred** | Ticket with clear “consider when …” scope, or skip with one-line note in the plan’s review-debt section. |

**Do not** file tickets for noise: pure praise, “expected” trade-offs (e.g. native binary for Argon2), or duplicates of existing tickets—grep `.vom` / recent `vom` output if unsure.

### 3. Severity → VOM handling (this project)

Align with **Capturing code quality review feedback** in `.cursor/skills/superpowers/subagent-driven-development/SKILL.md`:

- **Critical / Important (blocking):** Should have been fixed before merge; if still open, create a **task** or **bug** and treat as high priority.
- **Important (non-blocking):** **task** or **docs**—must not disappear without a ticket or an explicit plan note.
- **Minor / Suggestion:** Create a ticket **only if** it is a good fit for this codebase (security, CI stability, DRY, confusing UX, ops). Skip YAGNI items (e.g. indexes before a query exists).

Valid `vom new` types here: **feature**, **bug**, **task**, **refactor**, **docs** (not `chore`).

Example:

```bash
vom new -t task "Short imperative title" "1–3 sentences: context, constraint, done-when."
```

Follow `.cursor/skills/vom-new/SKILL.md` for title/description quality.

### 4. Trivial fixes

If a suggestion is under about **two minutes** of work (rename a misleading test, typo in comment), **fix in the repo** and **do not** open a ticket unless the user wants audit trail.

### 5. Report back

Give a short table:

- Resolved in tree (no ticket)
- New tickets (id + title)
- Skipped (one-line reason each)

Optionally append a **Review debt** subsection to the relevant plan under `docs/superpowers/plans/` only if the user or plan already uses that pattern.

## Integration

- **subagent-driven-development:** reviewers may output **VOM ticket drafts**; this skill confirms the tree and creates or adjusts tickets.
- **verification-before-completion:** run this closeout when review debt could block “all green.”

## Red flags

- Creating many micro-tickets for style nits—**batch** related items.
- Ticketing without **reading** the current files.
- Hand-editing `prisma/migrations/` to “fix” schema feedback—use schema + Prisma workflow per project rules.
