---
name: vom-plan-finder
description: Lists every VOM ticket in plan-needs-review via the vom CLI, prints Cursor-clickable links to each plan markdown file, and summarizes additions, improvements, and review considerations for the human—without approving plans or advancing workflow. Use when the user wants a plan review queue, "what needs plan review", or an overview of pending implementation plans before approval.
---

# VOM plan finder (human review prep)

## Purpose

Find all tickets in **`plan-needs-review`**, help the **human** decide what to approve or send back. The agent **does not** approve plans or change ticket state.

## Hard prohibitions

- **Do not** run `vom next` with approval-style messages (e.g. `"LGTM"`, `"Plan approved"`, or any transition toward **`plan-approved`**).
- **Do not** use `vom state` or other commands to move tickets out of **`plan-needs-review`** as part of this skill.
- **Do not** claim tickets solely to "own" plan review unless the user explicitly asked to work a specific ticket—this workflow is **read-only** for workflow state.

## Command-first discovery (required)

Use the **vom CLI** for discovery and reading plan content. **Do not** grep `.vom/tickets/` or use glob search as the primary way to find these tickets.

1. **List tickets in state** (JSON for structured parsing):

   ```bash
   vom list -s plan-needs-review --json
   ```

   If the list is empty, report that clearly and stop.

2. **Per ticket**, prefer CLI to load context (pick one pattern—minimize redundant calls):

   - **All-in-one:** `vom show <TKT-XXX> --docs --full` (same as legacy `vom show <TKT-XXX> --plans`) — ticket body plus full document bodies.
   - **Layered:** `vom show <TKT-XXX>` for ticket/acceptance context, then `vom doc show <TKT-XXX> implementation` for the main plan.
   - **Multiple docs:** If JSON `plans` (or `vom doc list <TKT-XXX>`) shows more than one document (e.g. `implementation-draft`), read **`implementation`** first; pull in other slugs only when they affect review (duplicate/overlap, draft vs final).

3. **Optional alignment check:** `vom guidance plan-needs-review` — use when you want workflow reminders; still **do not** approve plans from this skill.

## Clickable plan links for Cursor

For each document slug returned by the CLI (e.g. `implementation`, `implementation-draft`), print a **markdown link** the human can **Cmd+click** (or equivalent) to open in the editor.

**Path pattern** (workspace-relative, from repo root):

```text
./.vom/tickets/<TKT-XXX>/plans/<slug>.md
```

**Example line:**

```markdown
- [TKT-025 — implementation](./.vom/tickets/TKT-025/plans/implementation.md)
```

Use the **ticket title** from `vom list --json` (or `vom show`) in the link text so scans are scannable. If there are multiple plan files, list **one link per file** the human should open.

## Output format (required)

For **each** ticket in `plan-needs-review`, emit:

1. **Header:** `TKT-XXX` and short title (from CLI output).
2. **Links:** Bullet list of markdown links to `./.vom/tickets/<TKT-XXX>/plans/<slug>.md` for each relevant doc.
3. **Review bullets** (for the human only):
   - **Additions** — gaps, missing tasks, missing tests/docs, unclear verification.
   - **Improvements** — simpler approaches, risks, dependency or scope concerns.
   - **Key considerations** — acceptance criteria alignment, repo conventions (e.g. Prisma/migration rules, testing policy), or questions the human should resolve.
   - **No suggestions** (optional) ONLY if there are no suggestions to improve the plan or all possible suggestions are trivial

Keep bullets **actionable and concise**—this is a prep digest, not a second full plan rewrite.

## When to run

- User asks for plans waiting review, a **plan review queue**, or "what's in **plan-needs-review**".
- User wants **links to open plans** in Cursor plus **review notes** before they run `vom next` themselves.

## Related

- Opening a single plan in context: **vom-open-plan** skill.
- Human workflow detail: `.vom/guidance/plan-needs-review.md`.
