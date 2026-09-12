# Svelte 4 → 5 Runes Migration: Process, Scripts, and Lessons

A real, direct record of how this codebase's own migration from Svelte
4 legacy reactivity (`export let`, `$:`) to Svelte 5 runes (`$props()`,
`$state()`, `$derived()`, `$effect()`) was actually done — not a
theoretical guide, a record of what genuinely happened, including the
mistakes.

## Starting point and current status

At the start of this migration: 89 `.svelte` files, of which ~41 still
used `$:` reactive statements. As of this entry: 13 files remain (the
5 real, master-detail "parent-child" forms — General Journal, AP/AR
purchase and sale, purchase/sales orders — saved deliberately for
last, plus a handful of library components and two deprioritized
report pages). See `docs/RELEASE-NOTES.md` for the checkpoint-by-
checkpoint record of exactly which files were converted when.

## The automated tool that didn't work

Svelte ships an official codemod, `npx svelte-migrate svelte-5`,
which in principle handles this mechanically via AST transformation —
the safe, correct way to do a bulk syntax change. It was tried first,
genuinely, before any manual approach:

```
cd frontend && npx svelte-migrate svelte-5
```

This did not work in this environment. It presents an interactive TUI
(arrow-key menus, not a simple y/N prompt) that could not be
automated non-interactively — piping `yes` or simulated Enter
keystrokes toggled the menu selection without ever confirming it, and
there is no documented non-interactive flag. This was confirmed
directly (multiple real attempts, including simulated keystrokes)
before being abandoned in favor of manual conversion, not assumed to
be broken from a single failed try.

## The actual process used, file by file

For each file, in order:

1. **Find every `$:` statement**: `grep -n "^\s*\$:" path/to/file.svelte`
2. **Find every mutable `let` declaration**: `grep -n "^\s*let " path/to/file.svelte`
   — this step matters because adding even one `$derived` or `$state`
   to a file flips that whole component into runes mode, and Svelte 5
   does not allow mixing runes and legacy reactivity in the same
   component. Every other mutable variable must be converted in the
   same pass, or the file won't compile.
3. **Classify each `$:` statement**:
   - A pure computed value (`$: x = someExpression`) → `$derived(...)`
   - A statement with a side effect (calling a function, mutating
     something else) → `$effect(() => { ... })`
   - Already written as an IIFE (`$: x = (() => { ... })();`, a
     pattern already common in this codebase before this migration,
     for a multi-statement computation) → this converts directly and
     trivially to `$derived.by(() => { ... })`, since the shapes are
     identical.
4. **Convert every mutable `let`** to `let x = $state(initialValue)`.
5. **Run `svelte-check`** (`cd frontend && npm run check`) and fix
   whatever it reports before moving to the next file. This step is
   not optional — see the recurring bug below, which was only ever
   caught this way.

### The bulk script, for files with many single-line declarations

For files with a large, flat list of simple `let name = value;`
declarations (double digits, common in older pages with lots of local
form state), converting each one by hand invited transcription
mistakes. A small, throwaway Python script did this mechanically for
each file:

```python
import re

path = '/path/to/+page.svelte'
with open(path) as f:
    content = f.read()

lines_to_convert = [
    "let foo: SomeType = [];",
    "let bar = '';",
    # ... every real, single-line declaration from that file, copied verbatim
]

count = 0
for line in lines_to_convert:
    m = re.match(r"^let (\w+)(: [^=]+)? = (.+);$", line)
    if not m:
        print("NO MATCH:", line)
        continue
    name, typeann, value = m.groups()
    typeann = typeann or ''
    new_line = f"let {name}{typeann} = $state({value});"
    if line not in content:
        print("NOT FOUND:", line)
        continue
    content = content.replace(line, new_line, 1)
    count += 1

with open(path, 'w') as f:
    f.write(content)

print(f"Converted {count} declarations")
```

This was written fresh, by hand, for each file's own exact
`lines_to_convert` list (copied directly from that file's own `grep`
output) rather than as one generic, reusable tool — deliberately: a
single shared regex that tried to match *any* `let` declaration
across *any* file risked silently mangling a declaration with an
unusual shape (a multi-line object literal, a type with an embedded
`=` in a generic, a trailing comment). Scoping the script to one
file's own, already-inspected list of lines each time meant every
match was against real, known-good input, and the script's own "NO
MATCH"/"NOT FOUND" print statements caught the couple of cases where
a line's shape didn't fit the simple pattern (multi-line
declarations, described next) before they could be silently skipped.

### What had to be done by hand — genuinely, every time

**Multi-line declarations.** A declaration spanning several lines
(an object literal with several keys, or an array/object default
split across lines for readability) never matched the single-line
script's own regex, and had to be wrapped in `$state(...)` by hand,
directly:

```ts
// Before
let contact: Pick<Contact, 'email' | 'payment_terms_days'> = {
  email: null,
  payment_terms_days: null,
};

// After
let contact: Pick<Contact, 'email' | 'payment_terms_days'> = $state({
  email: null,
  payment_terms_days: null,
});
```

**IIFE-shaped `$:` statements.** These converted mechanically but
still needed a manual edit each time (removing the trailing `()` that
called the IIFE, since `$derived.by()` takes the function itself, not
its already-invoked result):

```ts
// Before
$: divisionGroups = (() => {
  const byDivision = new Map(...);
  // ...
  return [...];
})();

// After
let divisionGroups = $derived.by(() => {
  const byDivision = new Map(...);
  // ...
  return [...];
});
```

**Genuine side-effect statements**, as opposed to pure derived values
— these needed a real judgment call each time, not a mechanical
substitution, since `$:` in legacy Svelte conflates "recompute a
value" and "run this side effect on that dependency changing" into
the same syntax, while runes split them into `$derived` and `$effect`
as genuinely different concepts:

```ts
// Before
$: if (selectedBusinessId) loadLedgers();

// After
$effect(() => {
  if (selectedBusinessId) loadLedgers();
});
```

## The recurring bug: `$derived`'s direct-expression form and TypeScript inference

The single most common, real compile error hit throughout this whole
migration — found independently, the same way, in file after file —
was TypeScript narrowing a value to `never` inside a `$derived(...)`
direct expression, whenever that expression did property access on a
value that could be `null`/optional, or used a callback parameter
whose type Svelte's own compiler couldn't infer from the surrounding
expression:

```
Error: Property 'reference' does not exist on type 'never'. (ts)
  let isAlreadyAReversal = $derived(entry?.reference.includes('-REV-') ?? false);
```

`entry` was correctly typed (`JournalDetail | null`), and `reference`
genuinely exists on that type — this was confirmed directly each
time, not assumed to be a real type error in the surrounding code.
The fix, found once and then applied identically every subsequent
time this exact error shape appeared, is Svelte 5's own explicit
function form:

```ts
let isAlreadyAReversal = $derived.by(() => entry?.reference.includes('-REV-') ?? false);
```

This one substitution — direct expression to `$derived.by(() => ...)`
— resolved every single instance of this error across the whole
migration, including cases with nested `.filter()`/`.map()` callback
parameters that TypeScript separately flagged as `implicitly has an
'any' type` (the same underlying inference gap, not a separate bug).
**Given how reliably this fix works, a real, practical guideline
going forward**: prefer `$derived.by(() => expr)` over
`$derived(expr)` by default for any expression involving property
access on an optional/nullable value, rather than writing the direct
form and only switching after `svelte-check` complains.

## CSS glitches: the unused-selector warnings, and why they appeared

Converting a hand-written form's markup to use the shared
`Form.svelte`/`TypedList.svelte` mechanisms (a separate, related
effort alongside the runes migration proper) reliably left behind
real, orphaned CSS — selectors like `.new-location-form`,
`.role-picker`, or a bare `label { ... }` rule that styled the old,
hand-written `<input>`/`<select>` markup, which `svelte-check` then
correctly flagged as `Unused CSS selector` once that markup moved
into the shared component instead. This was not a runes-specific
issue — it happened whenever markup was replaced, regardless of
whether the same edit also touched reactivity — but it showed up
constantly during this same stretch of work because both efforts
(runes conversion and Form.svelte consolidation) were happening
together, page by page.

The fix was the same every time: after `svelte-check` flags an
orphaned selector, delete that specific CSS rule and re-run the check
to confirm the warning count returns to baseline (this codebase's own
running baseline, tracked deliberately throughout this migration, is
**36 warnings** — any commit that leaves the count higher than that
has left dead CSS behind and should be fixed before committing, not
after).

## Verification discipline used throughout

Per direct instruction partway through this migration ("concentrate
on the conversion and leave all but compile testing till later"),
most individual file conversions were verified with `svelte-check`
only — not a full e2e re-run after every single file — to keep the
actual conversion work moving. This traded a real, small risk (a
DOM-structure change silently breaking an e2e test that references
old markup) for real velocity across many files.

That risk materialized once, genuinely: the full Playwright tutorial
hung on the `locations` page after its own `Form.svelte` conversion,
because the e2e test still referenced `input[placeholder="..."]`
locators from the old, hand-written markup — a real regression not
caught until a full, dedicated e2e verification pass was run later
(see `docs/RELEASE-NOTES.md`, checkpoint 227, for the fix). The
lesson, stated plainly: compile-only verification is a reasonable
default for velocity during a long conversion stretch, but a full
e2e pass is not optional before considering that work genuinely done
— it needs to happen at least once before treating a batch of
DOM-changing conversions as complete, not deferred indefinitely.

## Commands used, for quick reference

```bash
# Find every remaining file with legacy reactivity
grep -rl "^\s*\$:" frontend/src --include="*.svelte" | sort

# Count $: statements in one file, to gauge how much work it needs
grep -c "^\s*\$:" path/to/file.svelte

# Check compile status after every conversion (the mandatory step)
cd frontend && npm run check

# Full verification, run at least once per batch of conversions,
# not deferred indefinitely
cd .. && make test
cd e2e && npx playwright test tutorial-walkthrough --reporter=list
```
