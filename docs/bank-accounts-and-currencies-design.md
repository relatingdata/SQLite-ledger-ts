## Bank accounts × currencies at business creation — real design, not yet built

**Not yet implemented — written up here for approval first, per direct instruction.**
Per direct instruction, captured here exactly as specified, not paraphrased into
something looser.

### The real setup flow, in order

1. **Nominate the business's home/reporting currency** — already real, already built
   (`setBusinessHomeCurrency`).
2. **Ask: does this business bank at one bank, or more than one?**
3. **Nominate one or more real bank accounts** — each with its own real **name**, real
   **BSB** (or equivalent routing/branch code), and real **account number**, as
   required for genuine electronic transactions.
4. **Ask: does this business trade in one currency, or more than one?**
5. **Present the real, full cartesian product — every nominated bank account ×
   every nominated currency — as tick-boxes**, so the person selects exactly which
   real combinations genuinely apply (a given bank account need not support every
   nominated currency).
6. **The exact, same nomination — bank account(s) × currency(ies) — applies to each
   real partner's own drawing account**, for a partnership: a partner's own Capital/
   Drawing pair gets the same real tick-box treatment, not a single, bare account.

### "Cash at Bank" — header only when it needs to be

Per direct correction: `"Cash at Bank"` is the right, real name, but its own real
shape depends on what was actually nominated:

- **One bank, one currency** (the trivial, common case): `"Cash at Bank"` stays a
  single, real, plain, postable account — no header, no further structure, exactly
  as simple as the business genuinely is.
- **More than one bank, or more than one currency, or both**: `"Cash at Bank"`
  becomes a real, non-postable **header**, with one real, postable leaf per ticked
  cartesian combination underneath — `"Cash at Bank — Westpac Business Cheque
  (AUD)"`, `"Cash at Bank — Westpac Business Cheque (EUR)"`,
  `"Cash at Bank — ANZ Savings (AUD)"`, and so on, only for the combinations
  actually ticked, never the full, untamed cartesian product blindly.

This mirrors the exact, same collapsing principle already established elsewhere in
this codebase (a single-currency business never sees per-currency account
mechanics at all) — complexity appears only when the business genuinely has it.

### Where the real bank name/BSB/account number live

Each real, nominated bank account is a genuine entity in its own right (name, BSB,
account number as real, structured detail — not folded into a free-text account
name), which the cartesian-product leaves are then built from — the same, real
"nominate the dimensions, then their combination" pattern already used for
Division × Location and Category × Product × Item.

### The real, open question from the prior message — Collections, now decided

A `"Bank Accounts"` kind under a real, global `Collections` root, copied per
business the same way `Vocabulary`/CoA categories now are, was raised as a
possible foundation for this. **Decided: shape A.** `Collections` holds only the
real *shape* a bank account needs (name, BSB, account number) — never default
instances. Reasoning: the setup flow above asks for real, actual bank details from
the very first step; there is no real, generic "Cash and Bank"-style default any
two, real, different bank accounts would actually share, unlike Division/Category,
where "Division" genuinely is a meaningful, reusable, empty starting shape.

### What this document does not yet cover

The actual schema/entity shape for a nominated bank account record itself (is it a
child of `Collections`, or does it live directly under the business once
nominated, with `Collections` only ever holding the abstract kind marker?), the
exact UI flow for the setup wizard, and how an already-existing business adds a
further bank account or currency later (not just at creation time) are all real,
further, open questions, not yet designed.
