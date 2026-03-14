---
name: vom-tidy
description: Move VOM tickets with state done or deleted into tickets/done or tickets/deleted to keep the main list tidy.
---

# VOM Tidy

When asked to tidy VOM tickets (or run vom-tidy), move all ticket folders whose `ticket.md` has `state: done` from `.vom/tickets/<id>/` into `.vom/tickets/done/<id>/`, and move those with `state: deleted` into `.vom/tickets/deleted/<id>/`.

## Steps

1. **Ensure the done and deleted directories exist.** Create `.vom/tickets/done` and `.vom/tickets/deleted` if they do not exist (e.g. `mkdir -p .vom/tickets/done` and `mkdir -p .vom/tickets/deleted`).

2. **List ticket folders.** List direct subdirectories of `.vom/tickets/` (e.g. TKT-001, TKT-002). Skip the `done` and `deleted` directories themselves—do not treat them as tickets.

3. **For each ticket folder:** Read `.vom/tickets/<id>/ticket.md` and parse the YAML frontmatter (between `---` delimiters at the top). Check the `state:` field for `done` or `deleted`.

4. **Move done tickets.** If `state` is `done`, move the entire folder `.vom/tickets/<id>` to `.vom/tickets/done/<id>` (e.g. `mv .vom/tickets/TKT-001 .vom/tickets/done/TKT-001`). Create `.vom/tickets/done` first if needed.

5. **Move deleted tickets.** If `state` is `deleted`, move the entire folder `.vom/tickets/<id>` to `.vom/tickets/deleted/<id>` (e.g. `mv .vom/tickets/TKT-003 .vom/tickets/deleted/TKT-003`). Create `.vom/tickets/deleted` first if needed.

6. **Report.** Tell the user which tickets were moved: which to tickets/done and which to tickets/deleted (e.g. "Moved TKT-001, TKT-005 to tickets/done; moved TKT-003 to tickets/deleted") or that no done or deleted tickets were found.

## Notes

- Only move folders that are direct children of `.vom/tickets/` and whose `ticket.md` has `state: done` or `state: deleted`. Do not move tickets that are already under `tickets/done/` or `tickets/deleted/`. Skip the `done` and `deleted` directories when listing—they are not ticket folders.
- Use the workspace root as the base path (e.g. `.vom/tickets/` from the project root).
