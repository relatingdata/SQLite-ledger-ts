## A real, top-level Root - Application and Businesses as true, disjoint siblings

**Not yet implemented — written up here for approval first, per direct instruction.**

### The real, confirmed structural fact behind tonight's "Equity" bug

Checked directly against the actual schema: `Businesses` (`backend/schema/00-core.sql`,
row 34) has `parent_id = 1` — the same, real id as `Application` itself. `Businesses`
is not `Application`'s sibling today; it is `Application`'s own, direct child. This
means `Application`'s own subtree and every real business's own subtree are not
genuinely disjoint at all — a business lives *inside* Application's own tree,
alongside `Vocabulary`, `Chart of Accounts` (the global template), `Vendors`, and
everything else Application-level.

This is the real, structural reason a bare `fetch('Equity', typeBusinessName)` could
resolve to the global CoA category `Equity` (a real, direct descendant of
`Application` → `Chart of Accounts`) instead of a real business named `"Equity"` (also
a real, direct descendant of `Application`, just one level further down, via
`Businesses`) — both are genuinely, actually reachable by walking down from the same,
one, real ancestor, with nothing structurally separating "Application-level" concepts
from "a specific business's own" concepts.

### The real, proposed fix

A new, further, real, top-level `Root` entity, pre-seeded at database initialization,
with `Application` and `Businesses` becoming its own two, real, direct, sibling
children — never one nested inside the other:

```
Root
├── Application   (global: Vocabulary, the shared Chart of Accounts template, Vendors, System Users, ...)
└── Businesses
    ├── Wine Retail Business
    ├── Riverside Cellars
    └── ...
```

`Application` keeps every one of its own, real, existing children exactly as they are
today — `Vocabulary`, `Chart of Accounts`, `Vendors`, `System Sessions`, and so on —
it simply stops being `Businesses`' own real parent. `Businesses` itself moves to
become `Root`'s own second, real, direct child, a true, structural sibling of
`Application`, not a descendant of it.

### Why this genuinely fixes the class of bug, not just this one instance

With `Application` and `Businesses` as genuine, disjoint siblings, a search correctly
scoped to "under Application" (the real, global template, `Vendors`, `Vocabulary`,
anything Application-level) can never, structurally, wander into a specific business's
own tree by accident — and the reverse: a search scoped to "under this one business"
can never accidentally resolve to something Application-level. The two real name-
spaces become genuinely, structurally separate, not just conventionally separate by
habit.

### The real, general principle this establishes, per direct instruction

Every `typeXXXName`-style resolution anywhere in this codebase must be genuinely
scoped to exactly one of two real levels:

- **Application-level** — resolved under `Application` specifically (`fetch(name,
  type, applicationNode)`), for a genuinely global, singleton concept (the CoA
  template's own categories, `Vocabulary` words, a `Location Type`/`Address Type`
  marker word).
- **Business-level** — resolved under one, specific, real business's own node
  (`fetch(name, type, thisBusinessNode)`), for anything that is conceptually repeated
  per business (a business's own `Locations`/`Items`/`Contacts`/`Hierarchies`/
  `Vocabulary`/`Chart of Accounts`, and everything real underneath them — a real
  vendor or customer included, since each is a real contact, tagged with its own real
  Contact Type, living under that one, specific business's own real `Contacts` —
  never Application-wide, however it may be structured in the real, live code today).

A bare, unscoped `fetch(name, type)` — resolving with no parent context at all — is
no longer a safe, default pattern for anything that could conceivably exist at more
than one of these two real levels; it remains correct only for the small, real set of
true, singleton concepts that exist exactly once, ever, with no possible collision
(`Application` and `Root` themselves, and similarly narrow cases).

### A real, confirmed, live violation, found while correcting this document's own example

Checked directly against the real, live code, not assumed: `createProvider` and
`createEmployee` (`backend/src/db.ts`) create every real vendor and every real
employee under a single, bare, global `'Accounts Payable'`/`'Employees'` parent —
shared across every real business at once, not scoped to any one specific business's
own tree at all. Every business's own real vendors and employees are, today, all
genuinely mixed together in one, single, global pool. This is real evidence, not
hypothetical, for why the general principle above matters: `Vendors`/`Employees` are
never Application-wide, and the real, live code currently treats them as if they
were.

### What this does not yet cover

This document proposes the structural fix (the new `Root` node) and states the
general principle. It does **not** yet enumerate every real call site in this
codebase that needs converting to respect it — that audit, and the actual code and
schema changes, follow once this design itself is approved.
