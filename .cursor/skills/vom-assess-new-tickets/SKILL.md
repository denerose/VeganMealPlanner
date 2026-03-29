---
name: vom-assess-new-tickets
description: Uses vom list for the NEW queue (up to ten), then dispatches a fresh subagent per ticket with VOM new-state guidance pasted in the prompt; each subagent claims, triages, and advances via vom CLI. Use when batch-triaging new tickets with isolated review per ticket.
---

# VOM assess NEW tickets (batch triage + subagents)

Use this workflow when you need to **work through the `new` queue** without implementing tickets. The **controller** only lists tickets and dispatches work; **each ticket is triaged by a dedicated subagent** so review stays isolated. Run all `vom` commands from the **repository root** (where `.vom/` lives).

## Roles

| Role | Responsibility |
|------|----------------|
| **Controller (this session)** | `vom list` for NEW tickets, cap at 10, prepare guidance text once, launch one **Task** subagent per ticket with that text + ticket ID, merge summaries for the human |
| **Subagent (one per ticket)** | `vom claim`, `vom show`, full NEW-state triage using the passed guidance, `vom edit` / `vom criteria` / `vom comment` / `vom next` or `vom state`, report outcome back |

Do **not** scan `.vom/tickets/` or invent filters—**discovery is only** `vom list --state=new` (optional `--json` on the same command if you need ordered IDs without miscounting).

## 1. Controller: discover candidates

```bash
vom list --state=new
```

- Read the listing in **the order `vom` prints**. Take **at most the first 10** tickets; if there are fewer, process all.
- If the table is empty, say there are no NEW tickets and stop.
- If you need machine-readable ordering, use **`vom list --state=new --json`**—still a built-in `vom list`, not a custom search.

## 2. Controller: capture NEW-state guidance once

Before dispatching subagents, load the text the subagents must follow:

1. Run **`vom guidance new`** and copy the **full terminal output**, **or**
2. Read **`.vom/guidance/new.md`** and copy its **full contents**.

Use **one** of these as the **authoritative triage spec** you will paste into every subagent prompt (they should align). Prefer pasting into the Task prompt so the subagent does not rely on inheriting session context.

## 3. Controller: dispatch one subagent per ticket (sequential)

For **each** selected ticket ID, **in list order**, launch a **Task** subagent (`generalPurpose` or equivalent). **Do not** triage tickets yourself in the controller session beyond listing and orchestration.

**Use sequential dispatches** (wait for each subagent to return before starting the next) unless the human explicitly asks for parallelism—shared repo and `vom` state are easier to reason about one ticket at a time.

### Subagent prompt template

Paste this structure; fill `TKT-XXX`, the **guidance block**, and repo path.

```text
You triage a single VOM ticket in state `new`. Work only on TKT-XXX. Repository root: <absolute path>.

## VOM NEW-state guidance (follow exactly)

<paste full output of: vom guidance new>
OR
<paste full contents of .vom/guidance/new.md>

## Your job

1. cd to the repository root and run: vom claim TKT-XXX
2. vom show TKT-XXX — read title, description, type, priority, criteria, comments
3. Apply the guidance above: critical evaluation first, then administrative triage (type, priority, criteria, comments)
4. Advance the ticket with vom only, e.g. vom next, vom state ready-for-planning, vom state needs-human, or vom state done — as the guidance dictates. Use vom comment when pushing back or explaining.
5. Report back to the controller in a short structured summary:
   - Ticket ID and title
   - Final state
   - Priority/type if changed
   - Whether you added criteria or comments (one line)
   - Any blocker or human follow-up needed

Use only vom CLI and normal git/repo commands; do not implement product features.
```

## 4. Controller: summarize for the human

After all subagents return:

- List each ticket, final state, and the subagent’s one-line outcome.
- Note any ticket skipped (claim failure, error) and why.

## Notes

- **Triage only.** After a ticket leaves `new`, continue with the **vom** skill for normal workflow.
- If `vom list` or subagent `vom claim` fails for identity, fix with `vom login` / `AGENTS.md` / `vom --agents-help` before re-dispatching.
