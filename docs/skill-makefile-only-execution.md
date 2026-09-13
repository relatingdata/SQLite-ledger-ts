*A Claude Code skill for this project — lives at `/mnt/skills/user/makefile-only-execution/SKILL.md`, reproduced here so it's part of this manual's own, single, complete source. Description: MANDATORY, absolute, for this project - never run an ad-hoc bash command (grep, sed, tail, node -e, curl, mkdir, rm, etc.) directly. Every real task - running tests, rebuilding the database, restarting servers, checking data, verifying a fix - must be invoked through a real, named Makefile target. If a target for the task doesn't exist yet, add one to the Makefile first, then invoke it. This applies to every single command, with zero exceptions, for the remainder of this project.*


# Makefile-Only Execution

## The absolute rule

From the moment this skill exists, in this project: **zero ad-hoc shell commands, full stop.** No `grep`, no `sed`, no `tail`, no `cat`, no `node -e`, no `curl`, no `mkdir`, no `rm` typed directly. Every real action goes through `make <target>`.

Structured file tools (`create_file`, `str_replace`, `view`) are not shell commands and remain the real, correct way to write and inspect source code — this rule is about the bash tool specifically.

## Before doing anything

1. **Check whether a real Makefile target already does this.** Read the Makefile if unsure.
2. **If no target exists, add one first** — a real, named, permanent target, committed to the Makefile — then invoke it. Do not run the underlying command directly "just this once" and add the target later; the target comes first, every time.
3. **Every diagnostic, every check, every fix-verification** — "does this translation resolve correctly", "is the database genuinely fresh", "did this file change" — gets its own real, named target if one doesn't already exist, not a one-off shell invocation.

## Why this exists

Per direct, absolute instruction, after a long pattern of ad-hoc `bash_tool` commands (manual `rm -f entities.sqlite*`, manual `grep` sweeps, manual `node -e` diagnostics) that were each individually reasonable but collectively meant real, repeatable procedures existed only as things Claude happened to remember to type correctly each time — not as real, durable, inspectable, shareable project infrastructure anyone else could run the same way.

## What this looks like in practice

Instead of:
```
rm -f backend/data/entities.sqlite*
cd backend && bun -e "import('./src/db.ts')"
```
Add and use a real target:
```makefile
reset-db:
	rm -f backend/data/entities.sqlite*
	cd backend && $(RUNTIME) -e "import('./src/db.ts')"
```
```
make reset-db
```

Instead of a one-off `grep -n "node" Makefile` sweep, add a real, permanent `make check-node-refs` (or similar) target that can be run again, by anyone, at any time — not just typed once and forgotten.
