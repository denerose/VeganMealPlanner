---
name: vom
description: Guide for continuing work on a VOM ticket - reminds agents to claim and check guidance before starting.
---

# VOM Continue Work

When asked to continue work on a ticket, follow these steps **before doing anything else**:

## 1. Claim the Ticket
```bash
vom claim TKT-XXX
```

You must claim the ticket even if you're continuing your own previous work.

## 2. Check Guidance for the Current State
```bash
vom guidance TKT-XXX
```

This shows you what's expected for the ticket's current state and how to transition to the next.

## 3. Review the Ticket
```bash
vom show TKT-XXX
```

Check:
- Current state and what's needed next
- Any comments from reviewers
- The plan (if in implementation phase)
- Acceptance criteria (if nearing completion)

**If the ticket is in state `plan-needs-review`:** Open the implementation plan so it's in context for review. Use the **vom-open-plan** skill (or read `.vom/tickets/<ticket-id>/plans/implementation.md` for the ticket you're working on).

**If the ticket is in state `review-pending`:** Use the **vom-reviewer** subagent to perform the implementation review. Invoke it with the ticket ID (e.g. `/vom-reviewer TKT-XXX` or "use the vom-reviewer subagent to review TKT-XXX"). Do so **immediately in the same response**—do not wait for the user to ask. vom-reviewer runs the full review workflow in its own context and reports back approved or changes-requested. Do not review and approve in the same flow—let the vom-reviewer subagent do it.

## 4. Follow the guidance and progress the ticket

Follow the guidance and plan. Update comments as needed:
```bash
vom comment TKT-XXX "Progress update..."
```

## 5. Transition When Ready
```bash
vom submit TKT-XXX "Ready for review"  # or appropriate transition
```

**When you have just moved a ticket to `review-pending`** (e.g. after implementing): **invoke the vom-reviewer subagent immediately in the same response**—do not stop and wait for the user to ask. Run vom-reviewer so review happens without further instruction.

## 6. Stop. Once you have completed your work for the current state, do not continue to the next state. Return to the human and let them know where you are in the process. Only proceed to the next state when you have explicit instructions from the human to do so.

---

## About Self-Review

**Same session (plan review):** Do not review/approve your own *plan* if you just created it in this session.

**New session:** You CAN review and approve your own past work. The session boundary provides the "fresh eyes" needed for good review. This is explicitly allowed.

**Implementation review (review-pending):** Use the **vom-reviewer** subagent for implementation review, including self-review. Launch it with the ticket ID (e.g. `/vom-reviewer TKT-XXX`). vom-reviewer runs in a separate context, verifies criteria and tests, then approves or requests changes and reports the outcome back. Prefer vom-reviewer so review is consistent and isolated. **You may invoke vom-reviewer in the same session**—it runs in a separate sub-session/context, so that is not "self-approve in the same flow" and is allowed and preferred.

---

**Never skip claiming. Never skip checking guidance.** These ensure you're working on the right thing in the right way.