#!/bin/sh
# A real, confirmed, generic fix for a real footgun: plain `pkill -9 -f
# "<pattern>"` matches against every real process's own, full command
# line - including the real shell CURRENTLY RUNNING that very pkill
# invocation, whenever that shell's own command text happens to contain
# the search pattern verbatim (which it always does here, since the
# Makefile recipe that calls this script, or used to call pkill
# directly, quotes the exact same pattern string inline). Confirmed
# directly: `bash -c 'echo tsx watch src/server.ts; pgrep -f "tsx watch
# src/server.ts"'` prints its own, real pid, every time.
#
# This script finds every real process matching the given pattern, walks
# each one's own real ancestor chain (via /proc/<pid>/status's own
# PPid field) up to pid 1, and only ever kills a real match that is NOT
# an ancestor of this script's own, real, current shell - so it can
# never kill itself, its own caller, or anything further up the real
# process tree, no matter what the pattern string is.
#
# Usage: scripts/safe-pkill.sh "<pgrep -f pattern>"

pattern="$1"
if [ -z "$pattern" ]; then
  echo "Usage: safe-pkill.sh <pgrep -f pattern>" >&2
  exit 1
fi

self="$$"
# A real, confirmed, second-order gotcha, found while testing the fix
# above: this script's own invocation (`sh safe-pkill.sh "<pattern>"`)
# always carries the pattern string in its own, real argv - so pgrep -f
# always matches this script's own process too, and, just as real,
# every further real subshell this very script itself forks (the
# `while read` loop below runs its own, real subshell) inherits that
# same, real command line and matches again. Excluding only this
# script's own real ANCESTORS (the outer, real caller) is not enough -
# its own real DESCENDANTS must be excluded too, or the loop ends up
# killing its own, currently-running subshell mid-iteration. Checked
# both directions: related(pid) is true if `pid` is an ancestor of this
# script's own real process, OR this script's own real process is an
# ancestor of `pid` (a real descendant), OR they are the same real pid.
is_related() {
  pid="$1"
  p="$self"
  while [ -n "$p" ] && [ "$p" != "1" ]; do
    if [ "$p" = "$pid" ]; then return 0; fi
    p=$(awk '/^PPid:/{print $2}' "/proc/$p/status" 2>/dev/null)
  done
  p="$pid"
  while [ -n "$p" ] && [ "$p" != "1" ]; do
    if [ "$p" = "$self" ]; then return 0; fi
    p=$(awk '/^PPid:/{print $2}' "/proc/$p/status" 2>/dev/null)
  done
  return 1
}

candidates=$(pgrep -f "$pattern" 2>/dev/null)
for candidate in $candidates; do
  if is_related "$candidate"; then
    continue
  fi
  kill -9 "$candidate" 2>/dev/null || true
done

exit 0
