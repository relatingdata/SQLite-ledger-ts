# Plan: Chart of Accounts as class/instance — a real, per-business copy, not a shared tree

*Not yet built.* Investigating the `Contacts`-per-business fix (see
`contact-types-and-translations.md`) surfaced a genuine, deeper,
pre-existing issue: `Accounts Receivable`, `Accounts Payable`, and the
entire Chart of Accounts beneath them are, today, a single, global
tree every real business shares — confirmed directly, not assumed:
`Accounts Receivable` exists as exactly one entity, `id=12`, and every
real customer any business has ever created lives under that one,
shared node. The existing "CoA family" mechanism (see
`docs/glossary.md`) already reflects half of the right idea — a
business picks which real family (German/Italian/generic/...) to
use — but a family today is a shared tag on one, single, global set of
leaf accounts, not a real, independent copy.

## The corrected model, using the classes/instances analogy directly

The system-supplied Chart of Accounts templates — one per real,
applicable combination of jurisdiction/location, language, and legal
entity type (`Sole Trader`, `Partnership`, `Incorporated Company`,
`Trustee`, ... — itself a real, user-extensible Vocabulary concept,
the same pattern as `Division Type`/`Contact Type`) — are the real
*classes*, living at the application level. When a business is
created, it receives its own, real, independent *instance*: a full,
eager copy of the applicable template's own real account tree, made
once, at creation time — not a lazily-shared reference, and
deliberately not a copy-on-write scheme, which is more machinery than
this genuinely requires right now. From that moment on, that
business's own copy is entirely its own: renaming, adding, or removing
an account in one business's own instance never touches any other
business's, even one instantiated from the identical class.

## What must build out from this real, per-business instance

Per direct instruction: Products, Locations, Divisions, Categories,
Vendors/Suppliers, Customers, and Employees are every one of them
genuinely scoped to one business's own, real instance — never shared
or visible across businesses, the same real principle this session's
`{business} Contacts`/`{business} Locations` fix already applies, now
extended to the Chart of Accounts itself, the root every one of those
other real hierarchies ultimately hangs off of.

## Open, real questions for whoever picks this up

- How a template's own, later, real correction (a genuine error found
  in the German class, say) should or shouldn't propagate to instances
  already made from it. This plan's own working assumption: it should
  not — matching real class/instance semantics, an instance, once
  made, is its own, independent, mutable copy, not a live reference
  back to its class.
- How CoA-family selection at business-creation time maps onto
  choosing a template class — likely a direct, natural fit for the
  existing "which real family" UI already in place, requiring little
  or no change to the actual choosing experience, only to what happens
  structurally once a family is chosen.
- The real, concrete migration for every business that already exists
  today under the old, shared-tree model — each one needs its own,
  real, retroactive copy made, with every one of its own, real,
  existing customers/vendors/employees/products re-pointed at that
  business's own new, independent instance rather than the one,
  shared, global tree they currently, incorrectly, all share.
