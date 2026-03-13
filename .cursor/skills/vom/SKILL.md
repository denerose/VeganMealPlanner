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

## 4. Do the Work

Follow the guidance and plan. Update comments as needed:
```bash
vom comment TKT-XXX "Progress update..."
```

## 5. Transition When Ready
```bash
vom submit TKT-XXX "Ready for review"  # or appropriate transition
```

## 6. Stop. Once you have completed your work for the current state, do not continue to the next state. Return to the human and let them know where you are in the process. Only proceed to the next state when you have explicit instructions from the human to do so.

---

## About Self-Review

**Same session:** Do not review/approve your own plan if you just created it in this session.

**New session:** You CAN review and approve your own past work. The session boundary provides the "fresh eyes" needed for good review. This is explicitly allowed.

---

**Never skip claiming. Never skip checking guidance.** These ensure you're working on the right thing in the right way.