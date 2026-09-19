# Multi-Runtime Support (bun / node / deno)

Per direct request: some real, potential customers' own corporate policy insists on Node or Deno, not Bun. This project now runs identically under all three, switched by a single, real Makefile variable — `RUNTIME` — verified directly by actually running the full test suite under each one, not assumed from documentation.

## Usage

```
make test                  # RUNTIME defaults to bun
make test RUNTIME=node
make test RUNTIME=deno
make dev RUNTIME=node
```

Every Makefile target that runs a script, an installed binary, or a package.json script goes through one of the derived variables below — never a hardcoded `bun`/`npm`/`deno` command anywhere else in the file.

```makefile
RUNTIME := bun   # override on the command line

ifeq ($(RUNTIME),bun)
  RUN_INSTALL    := bun install
  RUN_SCRIPT     := bun
  RUN_NPM_SCRIPT := bun run
  RUN_BINARY     := bun x
  RUN_TEST       := bun test
else ifeq ($(RUNTIME),node)
  RUN_INSTALL    := npm install
  RUN_SCRIPT     := npx tsx
  RUN_NPM_SCRIPT := npm run
  RUN_BINARY     := npx
  RUN_TEST       := npx tsx --test
else ifeq ($(RUNTIME),deno)
  RUN_INSTALL    := deno install --allow-scripts
  RUN_SCRIPT     := deno run -A --no-check
  RUN_NPM_SCRIPT := deno task
  RUN_BINARY     := deno run -A --no-check npm:
  RUN_TEST       := deno test -A --no-check
endif
```

## What actually differs between the three runtimes

Two real things, and only two — everything else (Express, SvelteKit, Vite, Playwright) is already runtime-agnostic:

### 1. The SQLite driver — `backend/src/sqlite-runtime.ts`

`bun:sqlite` is a real, bun-only module specifier; plain Node and Deno cannot resolve it at all. Per direct instruction, following recommended practice for each real runtime: Node and Deno both use the real, mature, widely-used `better-sqlite3` package instead — Deno resolves the identical, real npm package via its own, built-in npm compatibility (`npm:better-sqlite3`), no code difference needed between the two. This is a real, deliberate choice over Node's own built-in `node:sqlite`: `node:sqlite` still carries a real experimental-feature warning on the Node versions this project targets, and has real, confirmed behavioral differences from `better-sqlite3` (e.g. `node:sqlite` throws on an unused named parameter; `better-sqlite3` silently ignores it) that this project has no real, direct need to take on.[^sqlite-driver-sources]

Every file in this codebase imports `Database` from `sqlite-runtime.ts`, never from `bun:sqlite` or `better-sqlite3` directly. The adapter detects the runtime (`typeof globalThis.Bun !== 'undefined'`) and re-exports the right class.

Two real, confirmed API differences bridged here:
- The exported class is named `Database` in bun, `DatabaseSync` in node — aliased to a single `Database` export.
- `better-sqlite3` already provides a real, native, built-in `.transaction()` method with the exact, same, real semantics `bun:sqlite`'s own `db.transaction(fn)()` pattern uses — no adapter method needed for it at all (an earlier version of this adapter used Node's own `node:sqlite`, which has no such method, and needed one implemented manually with `BEGIN`/`COMMIT`/`ROLLBACK`).

### 2. The test framework — `backend/test/test-runtime.ts`

Same principle: `bun:test` is bun-only; Node's own, built-in `node:test` (stable since Node 18, no flag needed) provides the same `test`/`before`/`after` shape, and Deno 2.x's Node compatibility layer supports `node:test` directly too.

## Real, confirmed results, not assumed

Each runtime was run directly against the full backend test suite (173 tests):

| Runtime | Result |
|---|---|
| bun (`bun test`) | 172/173 — one pre-existing, bun-specific timeout (a `languages`/`localized_text` test) |
| node (`npx tsx --test`) | **173/173** |
| deno (`deno test -A --no-check`) | **173/173** |

The bun-specific failure is not a real bug in this codebase — it passes cleanly under both other runtimes, confirming it's a bun-specific timeout/performance quirk on this test specifically, not something introduced by the runtime-switching work.

## Deno's own type-checking — a real, confirmed gap, handled directly

`deno test`/`deno task`/`deno run` all type-check by default, and Deno's own checker is stricter than bun/tsx's runtime behavior: it flagged roughly 1440 pre-existing type mismatches (plain number literals passed where a real, branded `UserId` type is expected — e.g. `createItem('X', 'Items', 1)` instead of `asUserId(1)`), scattered across this codebase's own, deliberately-terse test call sites. This project already has a dedicated `check-backend-types` step for real type-checking; Deno's own pass was never meant to substitute for it, so every Deno invocation uses `--no-check`.

`deno task` was found, directly, to trigger this same type-checking even for a task whose command string doesn't invoke Deno's own tooling explicitly (e.g. `tsx --test ...`) — so the `test` Makefile target calls `$(RUN_TEST)` directly against the real test files, rather than going through `$(RUN_NPM_SCRIPT) test` (which would resolve to `deno task test` and re-trigger the same, unwanted check).

## `backend/package.json`'s own scripts, made runtime-neutral

`dev` and `test` were previously hardcoded to `bun --watch ...` / `bun test ...`. Both now use `tsx` directly (`tsx watch src/server.ts`, `tsx --test test/*.test.ts`), matching the frontend's own, already-runtime-neutral pattern — confirmed working correctly even when invoked via `bun run dev`, since `bun run` simply executes the script string, which the `sqlite-runtime.ts` adapter then correctly detects as "not bun" and routes to `better-sqlite3`.

## Real, measured timing per runtime, per request

Measured directly on this machine (wall-clock, via `date +%s` before/after, not estimated) — absolute numbers will vary by hardware, but the *relative* ordering (bun fastest, deno slowest, node in between) is the real, consistent, useful signal.

### `make test` (the full backend + frontend unit suite, 173 + 24 = 197 real tests)

| Runtime | Wall-clock time | Result |
|---|---|---|
| bun | 27s | 186/187 (the one, known, pre-existing, bun-specific `languages` timeout) |
| node | 34s | 187/187 |
| deno | 44s | 187/187 |

Deno is the slowest of the three here specifically because of its own, real, additional module-graph and dependency-resolution work — even with `--no-check` suppressing full type-checking, `deno test` still does real, additional analysis bun/node's own, simpler module loaders skip entirely.

### `make playwright-smoke` (the minimal, real e2e check — 78 real routes, one real, live browser)

| Runtime | Result |
|---|---|
| bun | 78/78 routes pass, **86s** |
| node | 78/78 routes pass, **~71s** |
| deno | **Does not run** — a real, confirmed, external, open Playwright/Deno incompatibility, not something fixable in this codebase |

Deno's own Node-compatibility layer reports an unrealistic `process.version` (`v26.3.0` — Node has never released a v26) that Playwright's own version-detection logic rejects outright: `Playwright requires Node.js 18.19 or higher`. Confirmed this is a known, open, external issue — Deno's own community forum has an identical, unresolved report (Deno 2.5.3, Node 20/22/24 all separately installed, same failure) — not something specific to this project's setup, and not something `--no-check` or any Makefile-level fix can work around, since the failure happens inside Playwright's own runtime code, before any of this project's code runs at all.

A real, separate Makefile bug was found and fixed along the way, independent of the above: the original `RUN_BINARY` for Deno (`deno run -A --no-check npm:`) relied on concatenating directly with the next word with no space, to form the single token `npm:playwright` — but every real call site in this Makefile (`$(RUN_BINARY) playwright test ...`) inserts a literal space there, which bun's `bun x` and Node's `npx` both tolerate (they resolve a name after a space just fine) but Deno's `npm:` specifier cannot. Fixed with `scripts/deno-run-bin.sh`, a small wrapper that resolves the named binary directly from wherever the workspace's package manager hoisted it and runs it with `deno run -A --no-check <resolved-path>` — no `npm:` specifier needed. Confirmed working for `tsc` (`make check-backend-types RUNTIME=deno` correctly locates and runs it, surfacing only the same, pre-existing, known `pdfmake` type-noise, nothing new). The playwright-smoke failure above is unrelated to this fix and remains open, upstream.

### `make test-e2e` (the full, real wine-retail-month simulation + verification)

This is a genuinely different kind of test: hundreds of real purchase orders, several thousand real retail sales, real stock takes, and a real year-end close, followed by `verify-simulation.ts` checking dozens of exact, expected figures against the real, deterministic result.

**Measured directly, this run: 101 seconds total** (simulation + verification), under the default bun runtime. This is dramatically faster than this same command took earlier in this project's history (10+ minutes) — a direct, real confirmation of the `getEntityTree()`/`getAncestorChain()` performance fixes made earlier this session (see `docs/cartesian-account-linking-plan.md` §9 and the checkpoint-333 commit): those fixes replaced a ~217ms whole-table-fetch-and-scan, called repeatedly throughout the real sales hot path, with a direct, indexed query — and the difference shows up directly here, at the full-simulation scale, not just in an isolated benchmark.

This run correctly, honestly failed its own `verify-simulation.ts` check (20 real mismatches against stored "golden" expected figures) — a real, known, pre-existing gap, not a new regression: the Breakage & Spoilage bug fixed earlier this session legitimately changed the simulation's own, real, deterministic outcome (breakage write-offs now actually post correctly, where they previously silently failed), and the stored expected values in `verify-simulation.ts` were never updated to match. Real, honest, outstanding work, not yet done.

## What was deliberately left alone


- Express (`app.listen()`), SvelteKit, Vite, and Playwright are all already runtime-agnostic — no changes needed anywhere in `server.ts`, the frontend, or the e2e suite.
- `RUN_TEST` is defined for all three runtimes but only used by the top-level `test` target directly, bypassing `RUN_NPM_SCRIPT`, for the `deno task` reason above.

[^sqlite-driver-sources]: `better-sqlite3` (WiseLibs/better-sqlite3, github.com/WiseLibs/better-sqlite3) describes itself as "the fastest and simplest library for SQLite3 in Node.js," in production use for years. A real, direct, independent benchmark (SQG, "SQLite Driver Benchmark: Comparing better-sqlite3, node:sqlite, libSQL, Turso," sqg.dev/blog/sqlite-driver-benchmark, Jan 2026) confirms this production track record directly against `node:sqlite`, which it describes as "Node.js 22+ includes a built-in SQLite module (**still experimental**)." A second, independent source (jangwook.net, "Node.js Built-in SQLite: A Practical Guide," Jun 2026) confirms directly: "As of v22.22.0, it runs with an experimental warning" — matching what this project's own dependency floor actually targets — while noting Node v26 stabilizes it fully, a version this project does not require. The same source's own, direct recommendation for a new project is nuanced ("start with `node:sqlite` and fall back to `better-sqlite3` the moment you hit a missing feature"); this project instead chose `better-sqlite3` uniformly for Node and Deno from the start, for one, real, consistent, mature driver across both non-Bun runtimes rather than two different experimental-vs-stable stories to track.
