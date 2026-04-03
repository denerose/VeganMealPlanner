---
name: vom-plan-review
description: Reviews, amends, and improves a VOM implementation plan for a ticket in plan-needs-review using only the vom CLI for claims, guidance, comments, and state transitions; edits plan markdown under plans/ only. Use when the user wants a plan approved (moved to plan-approved), wants plan-needs-review handled end-to-end, or invokes plan review with extra notes or constraints in the prompt.
---

# VOM plan review (review, amend, approve)

## Purpose

Run a **full plan review** for one ticket: confirm **`plan-needs-review`**, load **vom guidance**, **improve the plan file**, respect **any extra notes** the user included when invoking this skill, then advance the ticket with **`vom next`** to **`plan-approved`** (or send it back via **CLI-only** feedback and **`vom state`**).

## Hard rules (non-negotiable)

1. **Ticket file is off-limits for workflow edits**  
   Do **not** use editor tools (`StrReplace`, `Write`, manual edits) on **`.vom/tickets/<TKT-XXX>/ticket.md`** (or any ticket metadata on disk) to change **state**, **assignee**, **comments**, or **discussion**. Those changes **must** go through the **vom CLI** (`vom next`, `vom state`, `vom comment`, `vom claim`, `vom unclaim`, etc.).

2. **Plan documents may be edited**  
   You **may** edit markdown under **`.vom/tickets/<TKT-XXX>/plans/`** (typically **`implementation.md`**) to fix typos, clarify tasks, add verification or test tasks, or incorporate review improvements.  
   Alternatively, for wholesale replacements, you may use **`vom doc add`** (or **`vom plan add`**, alias) with **`--file`** and **`--force`** per project guidance—still a vom CLI path, not raw ticket edits.

3. **Transitions and comments only via vom**  
   Moving to **`plan-approved`**, back to **`planning`**, or any other state change: **`vom next`** or **`vom state`** only. Thread comments: **`vom comment`** only.

4. **Verify state before acting**  
   If the ticket is **not** in **`plan-needs-review`**, **stop** and report the actual state; do not force a transition.

## Same-session self-review

Follow project norms in **`.vom/guidance/plan-needs-review.md`** and the **vom** skill: **do not** approve a plan **you wrote in the same session**. If that applies, stop after improving the plan (if any) and tell the human another reviewer must run **`vom next`**. **New session** review of your own past plan is allowed.

## User-supplied notes (required attention)

When this skill is invoked, the user may add **constraints, focus areas, or risks** in the same message (e.g. “ensure Prisma handoff”, “split task 3”, “question the config approach”). Treat those notes as **mandatory review inputs**: address them explicitly in the amended plan and/or in the final **`vom next`** message.

## Workflow

### 1. Resolve ticket id

Normalize to **`TKT-XXX`** from the user message, or from context (open path under **`.vom/tickets/`**, or ongoing discussion). If unclear, ask and stop.

### 2. Claim and confirm state

```bash
vom claim <TKT-XXX>
vom show <TKT-XXX>
```

Prefer JSON when parsing state:

```bash
vom show <TKT-XXX> --json
```

- If state is **not** **`plan-needs-review`**: report current state and **stop** (no **`vom next`** toward approval).

### 3. Guidance and full context

```bash
vom guidance <TKT-XXX>
```

Optional workflow reminder:

```bash
vom guidance plan-needs-review
```

Load ticket + full plan bodies via CLI (avoid relying on glob/grep as the primary discovery):

```bash
vom show <TKT-XXX> --docs --full
```

If you need a single document by slug:

```bash
vom doc show <TKT-XXX> implementation
vom doc list <TKT-XXX>
```

### 4. Review and amend the plan

Use **`.vom/guidance/plan-needs-review.md`** as the quality bar (design skepticism, task clarity, verification per task, tests, docs tasks when needed). Apply **user-supplied notes** from the prompt.

Edit **`.vom/tickets/<TKT-XXX>/plans/implementation.md`** (and other **`plans/*.md`** only if they are part of the reviewed deliverable). Keep changes **focused** on plan quality and alignment with acceptance criteria.

### 5. Outcome: approve (target **`plan-approved`**)

When the plan is ready:

```bash
vom next <TKT-XXX> "<short factual summary: what you checked, what you changed, how user notes were addressed>"
```

The message should be a **real review summary**, not an empty LGTM. Per project guidance, this transition typically **unclaims** the ticket.

If you must keep assignment (rare; only when guidance warrants):

```bash
vom next <TKT-XXX> "<message>" --keep
```

### 6. Outcome: send back for major revision

Use **only** vom for thread + state:

```bash
vom comment <TKT-XXX> "<structured feedback: numbered list, what must change>"
vom state <TKT-XXX> planning
```

Do **not** use **`vom next`** toward **`plan-approved`** in this path.

## Verification

- After edits, re-read the plan (Read tool or **`vom doc show`**) to ensure markdown and task numbering stay coherent.
- After **`vom next`** or **`vom state`**, run **`vom show <TKT-XXX>`** and confirm the new state matches intent.

## When **not** to use this skill

- **Queue only / no approval:** use **vom-plan-finder** (it **forbids** **`vom next`** toward approval).
- **Implementation review (`review-pending`):** use **vom-reviewer** subagent / project rule, not this skill.
- **Opening a plan without reviewing:** **vom-open-plan**.

## Related paths

- Human workflow detail: `.vom/guidance/plan-needs-review.md`
- Planning author expectations: `.vom/guidance/planning.md`
