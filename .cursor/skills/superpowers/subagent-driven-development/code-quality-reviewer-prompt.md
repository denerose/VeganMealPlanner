# Code Quality Reviewer Prompt Template

Use this template when dispatching a code quality reviewer subagent.

**Purpose:** Verify implementation is well-built (clean, tested, maintainable)

**Only dispatch after spec compliance review passes.**

```
Task tool (superpowers:code-reviewer):
  Use template at requesting-code-review/code-reviewer.md

  WHAT_WAS_IMPLEMENTED: [from implementer's report]
  PLAN_OR_REQUIREMENTS: Task N from [plan-file]
  BASE_SHA: [commit before task]
  HEAD_SHA: [current commit]
  DESCRIPTION: [task summary]

    ## VOM tickets (Minor and suggestions)

    For each **Minor** issue and each constructive **suggestion** you are not treating as a blocker:
    - **Prefer:** from the repo root, run `vom new "<title>" "<description>"` (follow `.cursor/skills/vom-new/SKILL.md` for good titles and descriptions).
    - **If you cannot use the shell:** end your report with **VOM ticket drafts** — one block per item with **Title:** and **Description:** so the controller can create tickets.

    **Do not** open VOM tickets for **Critical** or **Important** issues that must be fixed before you approve; keep those in the review loop until resolved. Use tickets for intentionally deferred polish, tech debt, and follow-ups (usually Minor).
```

**In addition to standard code quality concerns, the reviewer should check:**
- Does each file have one clear responsibility with a well-defined interface?
- Are units decomposed so they can be understood and tested independently?
- Is the implementation following the file structure from the plan?
- Did this implementation create new files that are already large, or significantly grow existing files? (Don't flag pre-existing file sizes — focus on what this change contributed.)

**Code reviewer returns:** Strengths, Issues (Critical/Important/Minor), Assessment

**VOM tickets for Minor issues and suggestions:** Encourage turning deferred polish into tracked work. For each **Minor** finding and each constructive **suggestion** that will not be fixed inside this review loop, **prefer** creating a VOM ticket from the repo root: `vom new "<short title>" "<description>"` (see `.cursor/skills/vom-new/SKILL.md` for conventions). If the reviewer cannot run the shell, they must add a **VOM ticket drafts** section to the report with **Title** and **Description** per item so the controller can run `vom new`. **Do not** file tickets for **Critical** or **Important** items that still belong in the implementer → re-review loop; those must be addressed before approval.

**Controller:** After the review, follow **Capturing code quality review feedback** in `.cursor/skills/subagent-driven-development/SKILL.md` — do not drop Important/Minor items without fix, ticket, or logged debt.
