---
name: vom-new
description: Guide for creating a new VOM ticket using the vom CLI so tickets are good-quality and workflow-aligned.
---

# VOM New Ticket

When the user asks to create a new ticket (or uses /vom-new), follow these steps so the new ticket is high-quality and fits the project's VOM workflow.

## 1. Align with the Workflow

If you are not already familiar with this project's VOM workflow, run:

```bash
vom --agents-help
```

Use that output to align with: claim → guidance → show → work → next, single-step per state, and acceptance criteria. New tickets should fit that workflow.

## 2. Good-Quality Tickets (This Project)

**Title:** Short, imperative, scoped to one workflow step or deliverable (e.g. "add X", "fix Y when Z", "document W").

**Description:** When useful, 1–3 sentences for context, constraint, or outcome so triage and planning have enough to set type, priority, and acceptance criteria. Use `vom new "<title>" "<description>"` or `--file path` for longer text.

**Type and priority:** Use `vom new -t <type> -p <priority> "title"` when obvious (e.g. `-t bug -p critical` for a critical bug); otherwise leave default and let triage set them.

**Workflow fit:** Tickets should be small enough for the single-step agent workflow (one state transition per agent run). If the user's request is large, suggest splitting into multiple tickets or a single ticket that will be broken down in planning—do not create one oversized ticket.

## 3. Create the Ticket

Run:

```bash
vom new "<title>"
```

Add optional description, type, or priority as above. For large or vague requests, suggest splitting or a planning breakdown **before** running `vom new`.

Examples:

```bash
vom new "add search to vom list"
vom new "fix login when session expired" "Users get 500 after session timeout; should redirect to login."
vom new -t bug -p critical "crash on empty input"
```

## 4. After Creation

Confirm the created ticket ID from the command output, then suggest the next step:

- **Example:** "Created TKT-006. Run `vom claim TKT-006` when ready to work it."

---

**Run `vom --agents-help` first if unsure about the workflow.** This keeps new tickets consistent with claim → guidance → show → work → next and good-quality title/description/type/priority.
