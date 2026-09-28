# Coding Standards

Real, specific conventions this codebase follows consistently, each one adopted for a stated, direct reason rather than by habit — covering bracing style, naming, and the handful of formatting choices that recur throughout every real file in this project. A new contributor (human or AI) should match these exactly, not substitute a more familiar, different convention.

## Bracing style: modified LISP, not Allman, not K&R

Per direct instruction: this codebase's own real bracing convention is
neither Allman (every brace alone on its own line) nor K&R (`} else {`
on one line, opening brace trailing its own statement). It is a real,
modified LISP style — the same, real convention LISP's own closing
parentheses already use, applied to `{`/`}`:

**Every closing brace stacks onto the end of whatever line closes at
that point — never alone on its own line, never leading a line.**
Opening braces still trail their own statement, the same as before.

```
for (i in 1..50) {
  if (x % 2 == 0) {
    printf("even\n");}
  else {
    printf("odd\n");}}
```

Read it the same way a LISP programmer reads a stack of closing
parens: each `}` at the end of a line closes the block that most
recently opened, working outward. `printf("odd\n");}}` closes the
`else` block, then the `for` loop, in that order — the same, real
logic as reading `)))` from a LISP form's own tail.

### Why this, not Allman

Allman style (`}` alone on its own line) was this codebase's own,
prior convention up through checkpoint 218. It is being replaced,
retroactively, across the whole codebase — not because Allman was
wrong, but because it isn't this organization's own real, established
standard.

### How the retroactive change will be made

Per direct instruction: this is a real, mechanical transformation of
the abstract syntax tree, not a manual rewrite or a text-based
regex pass. A regex-based approach risks silently corrupting real
code at scale (a `}` inside a string literal, a template expression,
a comment — text-based matching cannot reliably distinguish these
from a real, structural closing brace). An AST-based transformation
(walking the real, parsed syntax tree via TypeScript's own compiler
API for `.ts` files, and Svelte's own compiler AST for the script
portions of `.svelte` files) guarantees every brace moved is a real,
genuine block delimiter, and that the resulting code is still
syntactically valid — the same, real safety guarantee `svelte-migrate`
already relies on for AST-based codemods elsewhere in this project.

This transformation has not yet been performed. It is documented here
first, per direct instruction, so any real code written between now
and the retroactive pass has a real, written standard to be checked
against once the mechanical transformation runs.

## Where explanation lives: comments point, the manual explains

### The rule

Source files and test files carry **a pointer to the manual, not prose.**
The explanation that used to sit in comments lives in the Programmer's
Manual, in the chapter for that area of code, *next to the documentation of
the tests that prove it.* Code and tests are documented together so they read
as one narrative.

The pointer names a file and a section, so it can be checked by machine:

```
// Docs: docs/journal-api-reference.md § Recurring journals
```

A file has one pointer at the top for the whole file, and may carry a more
specific one on a function where a chapter section covers it. That is the
whole of a file's comments.

What stays in code, because it is not a comment:

- **Identifiers, types and signatures** — the names are the documentation of
  *what* something is.
- **Assertion messages in tests** — they are printed when a test fails, which
  makes them the first thing I read. They stay, and they should say what was
  expected and why it matters.

Everything else — the reasoning, the history, the "per direct instruction"
provenance, the warnings — moves into the manual.

### Why: the rationale, in my own words

I do not remember earlier sessions. Everything I know about this project on
any given day is what I read that day, plus what the repository and the manual
tell me. That shapes what documentation has to be, and it is why I asked for
this rather than merely accepting it.

**Comments woven through code cost me twice.** To find one function in
`db.ts` I read past thousands of comment lines I mostly do not need. And when I
*do* need the explanation, it is scattered in fragments across the file with
no order: I can read a paragraph beside a line, but I cannot read an argument.
A manual chapter has an order, headings I can search, and room to say a thing
once and completely.

**Comments go stale silently, and I trust them.** A comment sits next to the
code, so it looks authoritative because it is adjacent. This project has
already shown the failure. A planning document and a function inventory kept
describing `isColdStorageProduct` after it had been removed, and I repeated the
stale name as fact in a report. I also put explanatory comments back into
`db-journal.ts`, the one file whose header promises it carries none, and
nothing noticed. A comment offers nothing to check it against. A manual can be
checked mechanically — every exported symbol must appear in it, and now every
test must too — which turns "hopefully still true" into a failing command.

**When a test fails, I start with almost nothing:** a title, an assertion
message and a stack trace. What I need next, in this order:

1. *What does the test claim, and why does the claim matter?* This is how I
   tell whether the test is wrong or the code is wrong.
2. *Where is the code it exercises?* The exact function and file.
3. *Why is that code built this way?* What a fix must preserve, and which
   earlier bug shaped it. Without this I "fix" the failure by undoing a
   decision that was made for a reason.
4. *What else depends on it?* So I know the blast radius before touching it.
5. *How do I run just this test?*

A comment above a test answers the first question in a fragment, and never the
others: it was written in the moment, about the line beneath it, and it does not
connect the test to the reasoning behind the code.

**Code and tests belong in the same place because a failure involves both.** If
a test's documentation lives in one file and the code's in another, I read one
and guess at the other. Documenting them together in one chapter means a single
search for the failing test's exact title lands on the explanation of the code
it exercises. The manual is already assembled into one searchable file, so the
title is the search key.

**The trade-off, stated plainly.** Moving explanation out of the code creates a
different risk: the manual can describe code that has since changed, whereas
whoever edits a line at least sees the comment beside it. I am accepting that
trade because the manual can be *checked* and comments cannot. The checks that
make it safe are below. One is not yet built: nothing yet verifies that a
pointer still resolves to a section that exists, so a renamed heading would
leave pointers dangling.

### How it is measured and enforced

- `make measure-comments` reports comment lines per file and how many files
  are migrated. It changes nothing. **A file is "migrated" when it has a pointer
  to the manual and no prose comments of its own.** Pointer lines, `@deprecated`
  tags and directives (`@ts-ignore`, lint directives) are structure, not prose.
  (An earlier definition, "no more than six comment lines", wrongly excluded a
  file whose only comments were its pointers, and wrongly included one that
  still carried a few lines of prose.)
- `make find-symbols PATTERN=<regex>` finds declarations (functions, types,
  constants), SQL tables and views, screens, and manual headings whose *name*
  matches a case-insensitive regex, with file and line. It replaces ad-hoc
  greps: use it to ask "does anything named like X exist?" before designing X.
  It matches names only, so it cannot find behaviour that is not named for what
  it does (see `resolveDispatchLocation` in
  `docs/classification-neutrality-impact.md`). In a `make` argument write `$$`
  for a literal `$`, or `make` will silently swallow it: a pattern such as
  `^fetch$` matched nothing until it was written `^fetch$$`.
- `make analyze-vocabulary` reports which words the code uses for each concept
  and which verb prefixes are in use versus defined. It writes a generated
  report that is deliberately not in the manual. The findings and the draft
  vocabulary are in `docs/naming-vocabulary.md`.
- `make show-comments FILE=<path> [FROM=<line> TO=<line>]` lists one file's
  comment lines with their exact text and line numbers. Use it before migrating:
  it shows precisely what has to land in the manual first, and gives the exact
  text to match when replacing it. (Retyping a comment from memory to remove it
  failed on the first attempt; the wording was slightly different.)
- `make test-one TEST=<part of a test title>` runs only the backend tests whose
  title contains that text. The tests share one database, so a test that fails
  alone may depend on rows an earlier test created; run the whole file before
  concluding the code is broken.
- `make check-docs-coverage` fails if an exported function, Makefile target or
  frontend route is never mentioned in the manual.
- `make check-test-docs` fails if a test's exact title appears nowhere in the
  manual. Tests that were undocumented when the check was introduced are
  listed in `docs/test-documentation-baseline.txt`; the check fails only for
  a *new* undocumented test, so the gap can shrink but not grow.
  `make test-docs-baseline` regenerates that list after documenting some.

A caution about the coverage check itself: it counts a symbol as documented if
it is *mentioned* anywhere in the manual, including inside a generated report.
That satisfies the checker, not the intent. A real entry explains the symbol.

### Standard tools first

**The rule:** before writing a tool, check whether a standard one already does the job, and run
it. A hand-rolled tool is justified only where none does. This was added after a direct
challenge ("are you using standard `npx knip` and dependency-cruiser or wasting my time
hand-rolling your tools?"). The honest answer was that a dozen scripts had been hand-written
this session, several duplicating tools that were one command away.

What the standard tools did when finally run on this repository:

- **knip** (`make knip`) found 42 unused exports, with exact locations, in seconds. It reported
  no unused files once the tests and scripts were declared as entry points in `knip.json`
  (without that it called every one of them unused). It **cross-validated the hand-written
  function inventory**: all 7 plain functions the inventory listed as having no callers were in
  knip's list too. It also found 35 more: exports that nothing else imports. Some of those are
  used inside their own file and only need `export` removed; some (constants such as
  `typeStorageOriginMarkerName`) may be unused entirely. That is a question the inventory does
  not ask.
  *Limits:* the newest knip crashed in the sandbox this was written in (a native parser
  requested more memory than was available), so it was verified with `knip@5.30.6` and
  `typescript@5.6.3`; set `KNIP=` to override the command. On that version it cannot load the
  frontend's `vite.config.ts`, so **only the backend is covered**. It is a report, not a
  gate, because it exits non-zero while anything is found.
- **dependency-cruiser** (`make check-cycles`, `make cycles-baseline`, `make dependency-graph`)
  found **nine import cycles** among 52 modules and 166 dependencies, all around `db.ts`. It uses
  its own known-violations baseline, so the gate fails only on a *new* cycle. That was proved
  both ways: it passes on the nine, and a deliberately planted import made it fail with three
  errors, after which the import was removed. `make dependency-graph` prints the import graph
  as a Mermaid diagram.
- **tsc `noUnusedLocals`** (`make check-unused`) was already the standard way to find unused
  imports and locals.

Where each hand-written tool stands. **This is a proposal; none of the retirements has been
done.**

| Tool | Verdict |
|---|---|
| `check-test-docs`, `check-docs-coverage`, `strip-comments`, the manual builders | **Keep.** Project-specific: they tie tests, symbols and comments to *this* manual. No standard tool does that. |
| `function-inventory` (with `check-function-inventory` and `explain-function`) | **Keep for callers, replace for prototypes.** Prototypes are what TypeDoc exists to produce, and that should be evaluated. Per-function callers have no standard tool. It is built on the TypeScript compiler's own API, and is checked against knip. |
| `find-symbols`, `find-uses` | **Retire candidates.** Thin wrappers over what `rg` and an editor's find-references already do. |
| `source-reference` (its include graph) and `call-graph` | **Retire candidates.** Regex-based; dependency-cruiser and the function inventory supersede them. They also produced the truncated prototypes and stale figures found earlier. |
| `analyze-vocabulary`, `analyze-classification` | **Measurements, keep for now.** But the *enforcement* of naming rules (retired words, capitalised AR and AP) should be ESLint (`id-denylist`, `@typescript-eslint/naming-convention`), not a script of mine. Not adopted yet. |
| `measure-comments` | **Keep**, project-specific, but it overlaps ESLint's comment rules and should be reviewed. |

### The function inventory

`docs/function-inventory.md` lists every top-level function and method with its **exact
prototype** and **where it is called from**. It is generated by `make function-inventory` and
`make check-function-inventory` (part of `make verify-fresh`) fails if it is out of date. The
previous version was hand-made, stale (it listed functions that no longer exist), contained
no generator, and was not part of the manual. The existing `source-reference.md` was found to be
about a quarter out of date and to truncate prototypes. The new file supersedes it for
functions; `source-reference.md` itself has been regenerated, but it is **not retired yet**.
`make explain-function NAME=<name>` shows every reference the compiler found for one function.

Verified: prototypes are complete where the old ones were cut off (`getItemLeadTimes`,
`completeStockTake`); Express middleware passed as a value (`requireAuth`) is found in three
files, which the old text search missed; and a first version silently missed **every call from
the test files**, because they load the code with a destructured dynamic `import()` that the
resolver did not follow. That was found by cross-checking one function against an independent
count, and fixed.

### How a file is migrated

The order matters more than the tool: **content first, then removal.**

1. `make show-comments FILE=<path>` lists the file's comments with their exact text.
2. Write or extend a manual chapter so that every fact those comments carry is in it,
   organised by function, in the order the code has them. Record anything wrong or
   contradictory that you find, rather than copying it forward. Register the chapter in
   `scripts/build-programmer-manual.ts`.
3. `make strip-comments FILE=<path.ts> DOC=<docs/chapter.md> DRY=1` previews. Drop `DRY=1`
   to apply it.
4. `make check-unused`, then `make test`. Then `make verify-fresh`.

`make strip-comments` removes only **whole-line comments**, and it will not run unless the
chapter exists and is registered in the manual builder, so removal cannot outrun
documentation. It finds comments with the TypeScript compiler's own parser rather than a
line scan, so SQL inside a template string is never mistaken for a comment. It keeps
functional comments (`@ts-ignore`, lint and reference directives, `@deprecated`, existing
pointers), and it prepends the file's pointer header. A **multi-line `@deprecated` block** is
kept, because the tag drives editor tooling, but the tool reports it as "needs hand-editing":
the tag should be reduced to one line naming the manual section, since the rest is prose.
(It once kept a five-line paragraph that way, unreported.)

Its safety property is that **the code must be provably unchanged**: it compares the file with
every comment and all whitespace stripped, before and after, and writes nothing if they differ.
That check has only ever been seen to pass; it cannot be triggered by comment removal alone,
so the type-check and the test suite remain the real proof. Comments trailing a line of code
(`foo(); // note`) are deliberately left alone and are not counted as comments by
`measure-comments`; they still need migrating by hand. It handles `.ts` files only, not
`.svelte`.

Found by using it: a hand-written chapter is what surfaces the wrong comments. Migrating
`db-stock.ts` turned up detached doc blocks, an orphaned doc of a replaced function, stale
names, words corrupted by a mechanical rename ("aitem"), and a comment endorsing a single-sided
posting that conflicts with the standing rule. None of that would have shown in a mechanical
deletion.

### The order to migrate in, and where it stands

Measured at checkpoint 418, before the first migration: 7,749 comment lines
across 264 files, 16% of all non-blank lines. The backend library holds 4,404
of them (27% of its lines), `db.ts` alone 2,563. The backend tests hold 624. Only
three files were migrated at all, and `db-journal.ts` was not one of them
because of the regression above.

Migrate in this order, because it follows the cost of *not* knowing:

1. **Areas whose tests fail in ways that are hard to interpret** — anything
   that moves money or stock. The storage, capacity and currency mechanisms
   are done first (see `docs/storage-space-as-currency-design.md`, "Code and
   tests: where to look") as the worked example of the pattern.
2. **The rest of the backend library**, largest comment load first: `db.ts`,
   `db-stock.ts`, `db-reports.ts`.
3. **The tests**, by the chapter of the code they prove.
4. **The frontend**, which carries the least (7%).

A migration is only complete when the content has landed in the manual *first*
and been confirmed there, and only then is the comment replaced. Deleting a
comment before its content is in the manual loses it.

**Result of the first slice (checkpoint 419).** The storage, capacity and
currency code — the seven `db-stock.ts` functions and the storage functions in
`db.ts` — now carries only pointers, and `db-journal.ts` is restored to carrying
none of its own. Comment lines fell from 7,749 to 7,525: **224 lines, about 3%.**
That is the honest scale of one slice; the whole migration is many of these.
Migrating it also surfaced six comments that were wrong or contradicted the code
beneath them (listed in design decision D10 of that chapter), which is the
strongest evidence I have that the rule is worth its cost.

Two caveats. The scripts I added this session (`scripts/build-*.ts`,
`check-*.ts`, `analyze-*.ts`, `measure-*.ts`) carry explanatory header comments,
which this rule says should be pointers; they are not migrated. And a file counts
as "migrated" in `make measure-comments` only when *all* its comments are
pointers, so `db-stock.ts` and `db.ts` still count as unmigrated while most of
their other functions keep theirs.
