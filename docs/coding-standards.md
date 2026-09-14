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
