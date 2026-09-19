---
name: fix-branded-types
description: Codemod for TypeScript's nominal-typing-via-intersection pattern (e.g. `type UserId = number & { readonly __brand: 'UserId' }` plus an `asUserId()` cast function). Use this whenever a stricter type-checker (deno check, a CI-only tsc pass, isolatedModules, or any checker your normal dev loop skips) surfaces "argument of type 'number'/'string' is not assignable to parameter of type '{ readonly __brand: ... }'" errors — especially in bulk, across a test file or script that was written against a looser toolchain (bun, tsx, ts-node --transpile-only) that never caught the gap at runtime. Also use this proactively whenever adding a new runtime (Node, Deno) to a project that only ran under one runtime before, since a stricter checker on the new runtime is exactly when this class of pre-existing gap surfaces. Do NOT reach for this on a handful (under ~10) of mismatches in one file — fix those by hand; this exists for the case where there are dozens to thousands, scattered across a large file, where manual fixing is genuinely impractical and error-prone in a different way (missed sites, inconsistent wrapping).
---

# fix-branded-types

A codemod that finds every place a bare `number`/`string` (or a loosely-typed variable) is passed where a branded/nominal type is expected, and wraps it with the project's own, existing cast function — using the TypeScript compiler API's real diagnostics for exact positions, never a regex guess at "what looks wrong."

## Background: why this class of bug exists at all

```typescript
type UserId = number & { readonly __brand: 'UserId' };
function asUserId(id: number): UserId { return id as UserId; }
```

`asUserId` is a pure compile-time cast — a genuine no-op at runtime (`return id as UserId` returns the identical value). This means code that skips the wrapper (`someFunc(1)` instead of `someFunc(asUserId(1))`) runs *completely correctly* under any toolchain that doesn't fully type-check before running: Bun, `tsx`, `ts-node --transpile-only`, and most fast dev loops. The gap only surfaces when something does full type-checking — a separate `tsc --noEmit` CI step, or adding a new runtime like Deno whose `deno check`/`deno test`/`deno run` type-check by default. At that point you can discover *hundreds or thousands* of these across a codebase's test files and scripts (production code is usually cleaner, since it's exercised by the type-checker more consistently during normal development — check it first, expect the volume to be concentrated in tests and one-off scripts).

## Before running anything: back up and confirm scope

```bash
cp path/to/file.ts /tmp/file.ts.backup
```

Run the target file's actual test suite once *before* touching anything, and note the pass/fail count as your baseline. You will compare against this after every batch — not just after the "final" run. This script has, in practice, produced syntactically valid, type-correct code that still broke real tests through mechanisms not caught by re-type-checking alone (see Lesson 2 below) — the only real ground truth is running the tests.

## Running it

```bash
# See what would change without touching the file:
node scripts/fix-branded-types.cjs --dry-run path/to/file.ts

# Actually fix it (loops internally until it converges or hits --max-rounds):
node scripts/fix-branded-types.cjs path/to/file.ts

# If your codebase uses a different brand marker name or cast-function prefix:
node scripts/fix-branded-types.cjs --brand-pattern '_tag' --wrapper-prefix 'to' path/to/file.ts

# Several files in one run (they're type-checked together, so cross-file cascades resolve correctly):
node scripts/fix-branded-types.cjs path/to/file1.ts path/to/file2.ts
```

Then, always:
```bash
diff /tmp/file.ts.backup path/to/file.ts   # read every hunk - see Lesson 1
# run the actual test suite for this file, not just a type-check
```

## Three real bugs found building this — read before trusting the tool blindly

**1. A type-mismatch diagnostic on an object-literal property points at the property's NAME, not its value.** For `{ ledger: 'Actual' }` where `ledger` should be `LedgerName`, the diagnostic's start/length span the identifier `ledger`, not the string `'Actual'`. A naive "wrap whatever text is at this position" produces `asLedgerName(ledger): 'Actual'` — a function call as an object key, which is invalid syntax that a linter or a second `tsc` pass catches immediately, but which a script blindly chaining edits without re-checking would not. **Fix**: walk the real AST to the exact node at that position; if its parent is a `PropertyAssignment` and this node is the `.name`, redirect the wrap to `.initializer` instead.

**2. A missing import produces syntactically valid, type-correct code that fails at runtime with a `ReferenceError`.** Wrapping `1` as `asUserId(1)` is worthless if `asUserId` was never imported into that file — and critically, *the type-checker doesn't care*, since it type-checks the wrapped expression correctly; the missing import is a separate, silent gap. This produced a real, confirmed 117-test failure in the codebase this script was built for. **Fix**: after fixing a file, scan for which wrapper functions are now used, find the file's existing import of the module that exports them (handle both `import { a, b } from '...'` and `const { a, b } = await import('...')` — codebases use both), and add any missing names to that same import.

**3. Shorthand object properties (`{ business, ledger }`) have no separate value node to wrap at all.** The AST node here is a `ShorthandPropertyAssignment`; wrapping the identifier in place produces `{ asBusinessName(business), ledger }`, which is invalid (a shorthand property must be a bare identifier). **Fix**: detect this case specifically and expand the whole node to `business: asBusinessName(business)` — a genuine text transformation, not just a wrap.

## A pattern that looks like a bug but usually isn't: slow, one-at-a-time convergence

You may see the tool report "fixed 1 mismatch" for dozens of rounds in a row, with the total remaining count barely moving. This is very likely **not** an infinite loop — it's TypeScript reporting only the first error within a given call or scope and suppressing further ones until that first error is resolved. Fixing it reveals the next one, one layer at a time. Confirm by checking the *specific line numbers* reported each round: if they're genuinely different lines each time, it's real, slow, sequential discovery (let it keep running, or batch-fix the common repeated pattern yourself with a targeted regex once you see what it is — e.g. `receiveStockAtLocation(..., 1)` might occur 16 times and be worth fixing in one regex pass rather than 16 tool-assisted rounds). If it's genuinely the *same* line/position every round, stop immediately and inspect — that's Lesson 1 or 2 above resurfacing in a new shape.

## Verifying convergence directly (don't just trust the script's own count)

```javascript
const ts = require('typescript');
const path = require('path');
const configPath = ts.findConfigFile('.', ts.sys.fileExists, 'tsconfig.json');
const configFile = ts.readConfigFile(configPath, ts.sys.readFile);
const parsedConfig = ts.parseJsonConfigFileContent(configFile.config, ts.sys, path.dirname(configPath));
const filePath = path.resolve('path/to/file.ts');
const program = ts.createProgram([filePath], parsedConfig.options);
const sourceFile = program.getSourceFile(filePath);
const diagnostics = ts.getPreEmitDiagnostics(program, sourceFile);
const relevant = diagnostics.filter(d => d.file === sourceFile && ts.flattenDiagnosticMessageText(d.messageText, ' ').includes('__brand'));
console.log('Total remaining:', relevant.length);
for (const d of relevant) {
  const pos = sourceFile.getLineAndCharacterOfPosition(d.start);
  console.log('Line', pos.line + 1, ':', sourceFile.text.split('\n')[pos.line].slice(0, 150));
}
```

This is more trustworthy than the script's own round-by-round log, since it re-derives the count fresh from the compiler rather than accumulating a running total across rounds.

## Scaling up: when a whole codebase has this, not just one file

Fix production source files first (usually few or zero issues — good confirmation the pattern works before trusting it on bulk test/script files). Then fix small scripts one at a time, verifying each by actually running it. Save large test files (hundreds+ of mismatches) for last, and expect several full rounds of: run codemod → diff → verify tests → repeat. Never run this unattended across many files without checking in between — the three bugs above were each found by checking, not by assuming a clean type-check meant a correct result.
