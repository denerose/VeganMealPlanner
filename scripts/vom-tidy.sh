#!/usr/bin/env bash

ROOT="${1:-$(cd "$(dirname "$0")/.." && pwd)}"
cd "$ROOT" || exit 1

[ -d .vom/tickets/done ] || mkdir -p .vom/tickets/done
[ -d .vom/tickets/deleted ] || mkdir -p .vom/tickets/deleted

moved_done=()
moved_deleted=()

for dir in .vom/tickets/*/; do
  [ -d "$dir" ] || continue
  name="$(basename "$dir")"
  case "$name" in
    done|deleted) continue ;;
  esac
  ticket_md="${dir}ticket.md"
  [ -f "$ticket_md" ] || continue
  state="$(grep -m1 '^state:' "$ticket_md" 2>/dev/null | sed 's/state:[[:space:]]*//' | sed 's/[[:space:]]*$//')"
  case "$state" in
    done)
      mv "$dir" ".vom/tickets/done/$name"
      moved_done+=("$name")
      ;;
    deleted)
      mv "$dir" ".vom/tickets/deleted/$name"
      moved_deleted+=("$name")
      ;;
  esac
done

if [ ${#moved_done[@]} -eq 0 ] && [ ${#moved_deleted[@]} -eq 0 ]; then
  echo "No done or deleted tickets to move"
else
  [ ${#moved_done[@]} -eq 0 ] || echo "Moved to tickets/done: ${moved_done[*]}"
  [ ${#moved_deleted[@]} -eq 0 ] || echo "Moved to tickets/deleted: ${moved_deleted[*]}"
fi
