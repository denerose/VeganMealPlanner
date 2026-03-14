---
name: vom-tidy
description: Move VOM tickets with state done into tickets/done to keep the main list tidy.
---

# VOM Tidy

When asked to tidy VOM tickets (or run vom-tidy), move all ticket folders whose `ticket.md` has `state: done` from `.vom/tickets/<id>/` into `.vom/tickets/done/<id>/`.

## Steps

1. **Ensure the done directory exists.** Create `.vom/tickets/done` if it does not exist (e.g. `mkdir -p .vom/tickets/done`).

2. **List ticket folders.** List direct subdirectories of `.vom/tickets/` (e.g. TKT-001, TKT-002). Skip the `done` directory itself—do not treat it as a ticket.

3. **For each ticket folder:** Read `.vom/tickets/<id>/ticket.md` and parse the YAML frontmatter (between `---` delimiters at the top). Check the `state:` field.

4. **Move done tickets.** If `state` is `done`, move the entire folder `.vom/tickets/<id>` to `.vom/tickets/done/<id>` (e.g. `mv .vom/tickets/TKT-001 .vom/tickets/done/TKT-001`). Create `.vom/tickets/done` first if needed.

5. **Report.** Tell the user which tickets were moved (e.g. "Moved TKT-001, TKT-005 to tickets/done") or that no done tickets were found.

## Notes

- Only move folders that are direct children of `.vom/tickets/` and whose `ticket.md` has `state: done`. Do not move tickets that are already under `tickets/done/`.
- Use the workspace root as the base path (e.g. `.vom/tickets/` from the project root).
