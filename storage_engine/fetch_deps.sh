#!/bin/sh
# Fetches the storage engine's Gleam dependencies into deps/, pinned to the
# exact upstream commits it is built and tested against. gleam.toml refers
# to them by path (repo.hex.pm is not reachable from every build sandbox).
# Already-present dependencies are left alone, so this is cheap to rerun.
set -eu
cd "$(dirname "$0")"
fetch() { # owner/repo commit
  dir="deps/$1"
  if [ -d "$dir/.git" ]; then return 0; fi
  mkdir -p "$(dirname "$dir")"
  git clone --quiet "https://github.com/$1" "$dir"
  git -C "$dir" checkout --quiet "$2"
}
fetch gleam-lang/stdlib  9816c72d28ac1fad9433e1ae851d1a3d4a17c64d
fetch gleam-lang/otp     18b78224ceb285e3ee4f33fee239bd6500ff5bca
fetch gleam-lang/erlang  eacfe75067676edaa2518987b6a43a819285574b
fetch lpil/gleeunit      3d6fc20588d52ddb8e75eaf158f46900809380e8
