---
name: vom-open-plan
description: Open the implementation plan file for a VOM ticket. Ticket ID can come from the user's request or from current context (e.g. open file under .vom/tickets/, conversation). Use when the user asks to open the implementation plan, when a ticket is in or transitions to plan-needs-review, or when viewing the plan for TKT-XXX.
---

# VOM Open Plan

When asked to open the implementation plan for a VOM ticket (e.g. "open plan for TKT-017" or "open the plan" when a ticket is already in context):

1. **Determine the ticket ID.** If the user's request contains a ticket ID (e.g. "open plan for TKT-017", "17", "017"), parse it and normalize to full form `TKT-XXX` (e.g. 17 → TKT-017). If the request does **not** contain a ticket ID, derive it from current context: (a) open files whose path is under `.vom/tickets/` (e.g. `.vom/tickets/TKT-017/ticket.md` or `.vom/tickets/TKT-017/plans/implementation.md` → use that ticket id); (b) or the ticket currently under discussion in the conversation. If no ticket can be determined from request or context, ask the user which ticket and stop.

2. **Open the plan file** using the Read tool: `.vom/tickets/<ticket-id>/plans/implementation.md` (path from workspace root).

3. **If the file does not exist**, tell the user that this ticket has no implementation plan yet (not all tickets have plans).
