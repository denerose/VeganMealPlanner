---
name: vom-tidy
description: Move VOM tickets with state done or deleted into tickets/done or tickets/deleted to keep the main list tidy.
---

# VOM Tidy

When asked to tidy VOM tickets (or run vom-tidy), run the script and report its output.

## Steps

1. **Run the script from the repository root.** From the project root, run:
   ```bash
   ./scripts/vom-tidy.sh
   ```
   (Or `bash scripts/vom-tidy.sh` if the script is not executable.)

2. **Report the script output to the user.** The script prints which tickets were moved (or "No done or deleted tickets to move"). Relay that output to the user; do not re-describe the move logic.

## Notes

- The script creates `.vom/tickets/done` and `.vom/tickets/deleted` if needed, moves ticket folders by reading `state:` from each `ticket.md`, and prints a short report. Run it from the workspace root and relay the output.
