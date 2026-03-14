---
name: vom-self-review
description: Review recent work for friction and pain points. Create or update tickets for issues that made the agent's job harder. Focus on project-specific improvements only.
---

# VOM Self-Review

When asked to self-review, analyze the recent conversation and tasks for friction points. The goal is to improve the project's developer/agent experience by surfacing issues that slowed you down or made your work harder.

## What to Look For

### Tool Friction
- Commands that were confusing or had unexpected behavior
- Missing flags or options you wished existed
- Error messages that weren't helpful
- Workflows that required too many steps
- Output that was hard to parse or understand

### Documentation Gaps
- Missing or outdated docs you had to work around
- Unclear instructions in AGENTS.md or README.md
- Missing examples for common tasks
- Inconsistent terminology

### Process Issues
- Workflows that felt inefficient
- States or transitions that were confusing
- Missing validation that would have caught errors earlier
- Repetitive tasks that could be automated

### Code/Project Issues
- Confusing file structure
- Missing helper functions you had to reinvent
- Inconsistent patterns across the codebase
- Tests that were hard to write or understand

## What NOT to Report

**Stay within project bounds.** Don't create tickets for:

- ❌ "GitHub's API is slow" - 3rd party issue
- ❌ "TypeScript should have better error messages" - language issue
- ❌ "The AI model sometimes hallucinates" - provider issue
- ❌ "npm registry was down" - infrastructure issue

**Do report if it's about project integration:**

- ✅ "The gh CLI should be installed in this project's dev environment"
- ✅ "We should add a wrapper script for the API calls we make"
- ✅ "Our TypeScript config should catch this type of error"

## Process

### 1. Review the Conversation

Scan back through your work. Ask yourself:
- Where did I get stuck?
- What did I have to figure out the hard way?
- What would have made this faster?
- What would have prevented mistakes?

### 2. Check for Existing Tickets

Before creating new tickets, search for related ones:
```bash
vom search "keyword"
vom search "frustrating-term"
```

### 3. Create or Update Tickets

For each genuine issue found:

**If no existing ticket:**
```bash
vom new --type=task --priority=medium "Short description of the friction"
```

**If related ticket exists:**
```bash
vom comment TKT-XXX "Encountered this again while working on TKT-YYY. Additional context: ..."
```

### 4. Be Specific

Bad tickets don't help. Good tickets include:

❌ "The CLI is confusing"
✅ "The `vom list` command doesn't show ticket age, which would help identify stale tickets"

❌ "Better error messages"
✅ "When `vom claim` fails due to state mismatch, suggest the correct transition command"

### 5. Prioritize Appropriately

- **Critical**: Blocks work entirely, no workaround
- **High**: Significant friction, workaround is painful
- **Medium**: Annoying but manageable
- **Low**: Nice to have, minor improvement

## Example Self-Review

After completing TKT-042, you might find:

1. **Had to manually parse ticket IDs from output** → Ticket for `--json` flag
2. **Didn't know which states transition where** → Ticket for `vom transitions` command
3. **Claim output didn't tell me what to do next** → Comment on existing ticket about claim hints

## Output Format

Summarize your findings:

```markdown
## Self-Review Summary

### Friction Points Found: N

| Issue | Action | Ticket |
|-------|--------|--------|
| Description of friction | Created/Updated | TKT-XXX |

### Details

#### TKT-XXX: Ticket Title
Brief explanation of the friction and why it matters.
```

---

**Remember: The goal is continuous improvement. Small friction points compound over time. Fixing them makes everyone more productive.**