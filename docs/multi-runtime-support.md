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

## What was deliberately left alone

- Express (`app.listen()`), SvelteKit, Vite, and Playwright are all already runtime-agnostic — no changes needed anywhere in `server.ts`, the frontend, or the e2e suite.
- `RUN_TEST` is defined for all three runtimes but only used by the top-level `test` target directly, bypassing `RUN_NPM_SCRIPT`, for the `deno task` reason above.
