# A Translator Form, and Real Guard Rails — a plan

Per direct request: a real, dedicated UI for managing translations/
synonyms, and real, concrete "guard rails" in the application itself,
reflecting the hard lessons of this session's own, real mistakes —
prompted directly by the realization that "word" often actually meant
"a word or short phrase giving meaning to a particular, perhaps not
unique, concept in business reporting and accounting" (Vendor/
Supplier, and the deeper B2B/B2C, manufacturing/retail/wholesale
nuance behind it).

This is a plan, not an implementation, for the same reason the menu
plan was written before any code: the stakes of building the wrong
structure here are real and already demonstrated — twice this same
session, on two separate, real, foundational changes.

## 1. The real, underlying problem, restated precisely

`translation_entry` today assumes one, single, canonical English
string per row, with per-language equivalents. That model is correct
for genuine translation ("Customers" → "Kunden") but doesn't capture
what was actually discovered this session: the *same, real business
concept* — "the entity we buy from" — can have more than one, real,
valid **English** name (Vendor, Supplier), and which one is correct
depends on real, situational context (who's asking, B2B vs. B2C,
manufacturing vs. retail vs. wholesale) rather than a fixed, single
truth. A translator form built on the current, one-canonical-string
model would just be a nicer UI for the same, incomplete idea.

## 2. Two real, genuinely different things that must not be conflated

**Cross-language translation** (already built, already working):
one, real, given English term, with real equivalents in German,
French, Danish, Italian. `translation_entry` already handles this
correctly and doesn't need to change.

**Same-language synonym/context choice** (not built at all): more
than one, real, valid English name for the *same* real concept,
where the right one depends on real, situational context — not a
"correct" answer being looked up, but a real, genuine choice.

The real, honest risk in building this next: treating the second as
just a special case of the first ("Vendor" as a pseudo-translation of
"Supplier") would quietly collapse a real, contextual choice into a
fake, fixed lookup — solving the visible symptom while reintroducing
the exact, same flawed assumption underneath.

## 3. A real, proposed shape — concepts, not just words

The real, structural fix mirrors what this session already, directly
proved works for Accounts Receivable/Payable: a *concept* is a real,
genuine entity (already true — "Accounts Payable" already is one);
a *word* is a real, separate, named path to it, via the same, proven
dimension mechanism, not a synonym baked into one row.

A rough, real shape, not yet built:

- A real concept keeps its own, real, existing entity identity — no
  change there.
- Each real, alternate English name for it (Vendor, Supplier) is its
  own, real, distinct entity — the same, established "distinct name,
  linked via relation_id" pattern already proven for menu items this
  session — carrying its own, real cross-language translations via
  the existing, unmodified `translation_entry` mechanism.
- A real business or user then picks *which* real, alternate name is
  their own default, the same, real, already-proven override
  mechanism as the menu (§4 of docs/menu-as-entity-tree-plan.md) —
  not a new, separate mechanism invented from scratch.

## 4. Real, open questions — genuinely unresolved, not glossed over

- **Where the real line sits between "alternate name for the same
  concept" and "a genuinely different concept that only looks
  similar"**: the B2B/B2C realization suggests this isn't always
  obvious. Getting this right needs real, careful, one-at-a-time
  review of real, concrete cases (Vendor/Supplier first, since it's
  already, directly identified), not a bulk, automated pass over
  the whole vocabulary at once.
- **Whether a business-to-business relationship is ever genuinely a
  different concept from its own business-to-consumer counterpart**,
  rather than just a differently-named version of the same one — this
  determines whether Accounts Receivable and Accounts Payable
  themselves ever need their own real, further, structural split, not
  just a naming one.
- **Who decides** a given alternate name is legitimate versus a
  genuine, ordinary translation error — this likely needs to be a
  real, deliberate, Administrator-level action (adding a new,
  alternate concept-name is a real, structural decision, not a casual
  typo fix), not something any real user can casually create.

## 5. Real guard rails — concrete, not aspirational

Per direct request, and drawn directly from this session's own, two,
real, genuine mistakes (attempting to directly re-parent Customers
under Accounts Receivable; the earlier tier-restructuring attempts
before location became genuinely structural):

- **A real, direct, structural-change confirmation**: before any
  action changes a real entity's own, existing `parent_id`, the real,
  current parent and the real, proposed new parent are both shown
  together, explicitly, with a real, direct prompt — not a silent
  operation. This alone would have caught the Customers/Accounts
  Receivable mistake before it was ever written to schema.sql.
- **A real, live, duplicate-intent check** at the moment a new entity
  is about to be created: if a real, existing entity already has the
  exact, same, or a very similar, real name, surface it directly,
  before creation — "Accounts Payable already exists, under Liability
  — did you mean to link to it instead?" — rather than only failing
  after the fact, at the database's own, blunt UNIQUE constraint.
- **A real, visible, "why is this here" trail** on any entity reached
  via a dimension link, not just its own, direct parent chain — so a
  real, future person looking at "Accounts Receivable" can actually,
  directly see that "Customers" reaches it via a real, structural
  link, not stumble on it by accident the way this session did while
  investigating `getBalanceSheet`.

These are real, concrete, buildable guard rails — genuinely smaller
in scope than the translator form itself, and arguably worth building
first, given they would have caught this session's own mistakes
directly, at the moment they happened, rather than requiring a
person's own, careful, after-the-fact review to catch them.

## 6. Suggested, real order of attack

1. The guard rails (§5) — smaller, real, immediately useful
   regardless of how the translator form itself ends up shaped, and
   directly protective against the same, real class of mistake
   already made twice this session.
2. A real, careful, one-at-a-time review of the concept-vs-word
   question for Vendor/Supplier specifically, before generalizing —
   confirming the real, proposed shape (§3) on one, real, concrete
   case before it becomes a general mechanism.
3. The translator form itself, built on whatever real, confirmed
   shape step 2 validates — not before.
