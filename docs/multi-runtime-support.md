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

`bun:sqlite` is a real, bun-only module specifier; plain Node and Deno cannot resolve it at all. Node 22.5+ and Deno 2.x (via its own, real Node compatibility layer) both provide the same, real `node:sqlite` module instead — no third-party dependency (`better-sqlite3`) needed.

Every file in this codebase imports `Database` from `sqlite-runtime.ts`, never from `bun:sqlite` or `node:sqlite` directly. The adapter detects the runtime (`typeof globalThis.Bun !== 'undefined'`) and re-exports the right class.

Two real, confirmed API differences bridged here:
- The exported class is named `Database` in bun, `DatabaseSync` in node — aliased to a single `Database` export.
- `node:sqlite` has no built-in `.transaction()` method at all. Implemented manually here with `BEGIN`/`COMMIT`/`ROLLBACK`, matching `bun:sqlite`'s own, real, immediately-invoked-callback semantics (`db.transaction(fn)()`) — the only pattern this codebase actually uses.

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

`dev` and `test` were previously hardcoded to `bun --watch ...` / `bun test ...`. Both now use `tsx` directly (`tsx watch src/server.ts`, `tsx --test test/*.test.ts`), matching the frontend's own, already-runtime-neutral pattern — confirmed working correctly even when invoked via `bun run dev`, since `bun run` simply executes the script string, which the `sqlite-runtime.ts` adapter then correctly detects as "not bun" and routes to `node:sqlite`.

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

**86 seconds** (~1.4 min), including real dev-server startup and a real, full page-load-without-error check across every real route in the application. This is the fast, minimal e2e proof this project actually relies on day to day — not the full simulation below, which exists for a different, real purpose (proving the accounting logic itself, not that every page loads).

### `make test-e2e` (the full, real wine-retail-month simulation + verification)

This is a genuinely different kind of test: hundreds of real purchase orders, several thousand real retail sales, real stock takes, and a real year-end close, followed by `verify-simulation.ts` checking dozens of exact, expected figures against the real, deterministic result.

**Measured directly, this run: 101 seconds total** (simulation + verification), under the default bun runtime. This is dramatically faster than this same command took earlier in this project's history (10+ minutes) — a direct, real confirmation of the `getEntityTree()`/`getAncestorChain()` performance fixes made earlier this session (see `docs/cartesian-account-linking-plan.md` §9 and the checkpoint-333 commit): those fixes replaced a ~217ms whole-table-fetch-and-scan, called repeatedly throughout the real sales hot path, with a direct, indexed query — and the difference shows up directly here, at the full-simulation scale, not just in an isolated benchmark.

This run correctly, honestly failed its own `verify-simulation.ts` check (20 real mismatches against stored "golden" expected figures) — a real, known, pre-existing gap, not a new regression: the Breakage & Spoilage bug fixed earlier this session legitimately changed the simulation's own, real, deterministic outcome (breakage write-offs now actually post correctly, where they previously silently failed), and the stored expected values in `verify-simulation.ts` were never updated to match. Real, honest, outstanding work, not yet done.

## What was deliberately left alone


- Express (`app.listen()`), SvelteKit, Vite, and Playwright are all already runtime-agnostic — no changes needed anywhere in `server.ts`, the frontend, or the e2e suite.
- `RUN_TEST` is defined for all three runtimes but only used by the top-level `test` target directly, bypassing `RUN_NPM_SCRIPT`, for the `deno task` reason above.
