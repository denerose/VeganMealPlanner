---
name: vom-open-plan
description: Open the implementation plan file for a VOM ticket. Use when the user asks to open the implementation plan, when a ticket is in or transitions to plan-needs-review, or when viewing the plan for TKT-XXX.
---

# VOM Open Plan

When asked to open the implementation plan for a VOM ticket (e.g. "open plan for TKT-017" or "open implementation plan for 17"):

1. **Parse the ticket ID** from the request (e.g. "17", "TKT-017", "017"). Normalize to full form `TKT-XXX` (e.g. 17 → TKT-017; if already TKT-017, use as-is).

2. **Open the plan file** using the Read tool: `.vom/tickets/<ticket-id>/plans/implementation.md` (path from workspace root).

3. **If the file does not exist**, tell the user that this ticket has no implementation plan yet (not all tickets have plans).
