#!/bin/sh
# A real, direct wrapper, needed only for RUNTIME=deno: "deno run -A
# npm:<pkg>" requires the npm specifier as one, single, unbroken
# token - but this Makefile's own, established call pattern
# ($(RUN_BINARY) playwright test ...) inserts a real, literal space
# between the runtime prefix and the binary name, which bun's "bun x"
# and node's "npx" both handle correctly (they resolve a name after a
# space just fine) but deno's "npm:" specifier cannot. Resolves the
# named binary directly from wherever this monorepo's own package
# manager actually hoisted it (found via `find`, since bun/npm may
# hoist to different, real locations depending on the workspace
# layout) and runs it with `deno run -A --no-check` directly - no
# npm: specifier needed at all.
set -e
BIN_NAME="$1"
shift
BIN_PATH=$(find "$(cd "$(dirname "$0")/../.." && pwd)" -maxdepth 4 -path "*/node_modules/.bin/$BIN_NAME" 2>/dev/null | head -1)
if [ -z "$BIN_PATH" ]; then
  echo "deno-run-bin.sh: could not find $BIN_NAME under any node_modules/.bin - is it installed?" >&2
  exit 1
fi
exec deno run -A --no-check "$BIN_PATH" "$@"
