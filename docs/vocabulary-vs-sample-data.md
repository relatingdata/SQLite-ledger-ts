## Application vocabulary vs. sample business data — what's genuinely translated, and what's just written in another real, direct language

A clear separation between the application's own, real, translated
vocabulary and the real, direct sample data belonging to a demo
business — some of which happens to be written in a language other
than English, not because it's been translated, but because that
specific business genuinely operates in that language. (Several
additional demo businesses exist specifically to exercise this in
multiple real languages at once — see the language/i18n testing
discussion in Part V, not here; this section uses Wine Retail Company
throughout as the one, real, illustrative example.)

### Two, genuinely different things that could easily be confused

1. **Application vocabulary** — every real, direct UI label, button,
   column heading, and field name the interface itself displays
   ("Purchase Order", "Balance Sheet", "Change password", and
   several hundred more). These are real, translated: the exact,
   same, single English word or phrase is shown as German, French,
   Danish, or Italian text depending on the real, current session's
   own chosen language — the underlying, real meaning never changes.
2. **Sample business data** — the real, direct account names,
   product names, customer/vendor names, division and location names
   belonging to one, particular, real demo business. Wine Retail
   Company's own accounts are named in English because it's a real,
   modeled Australian business. This is not a translation of
   anything — it's what that specific business's own real books would
   genuinely be named in, in its own real country. Switching the
   interface's own language setting does not, and should not, change
   a single one of these real, direct names.

### How this is genuinely, structurally separated today

**Application vocabulary** lives as real, direct child entities of
one, single, real "Vocabulary" entity (197 real, direct children at
the time of writing) — plus a real, small, named exception: several
report names ("Trial Balance", "Balance Sheet", and others) live
under "Reports" instead, but are translated through the exact, same,
one, shared mechanism. Every real translation itself lives in one,
single, shared `translation` table, keyed by `(entity_id,
language_id)` — one, real row per vocabulary word, per real language.

**Sample business data** lives as real, direct child entities of the
business's own, real, separate entity (`Wine Retail Company`) —
structurally, completely separate from `Vocabulary`, from the very
first, real, direct parent link. A demo business's own, real account
or product name is never a real, translated vocabulary word at all,
and the reverse is true too — the same, real, structural separation
that already keeps a customer's own name distinct from a report's own
column heading keeps a demo business's own data distinct from the
application's own vocabulary.

### The real, current file-level organization

The application's own, real vocabulary translations are already
genuinely, cleanly separated at the file level — five, real, direct,
single-purpose files, one per real language, containing nothing else:

- `backend/schema/10-vocab-english.sql`
- `backend/schema/10-vocab-german.sql`
- `backend/schema/10-vocab-french.sql`
- `backend/schema/10-vocab-danish.sql`
- `backend/schema/10-vocab-italian.sql`

Wine Retail Company's own sample data lives inside `00-core.sql`
itself, alongside the foundational entity tree and vocabulary
definitions, not in its own, separate, demo-specific file. A concrete,
worthwhile next step: split it into its own, clearly-named file (e.g.
`20-demo-wine-retail.sql`), leaving `00-core.sql` holding only the
genuinely foundational entity tree, vocabulary, and schema definitions
every business relies on — not started yet, flagged here for direct
follow-up.
