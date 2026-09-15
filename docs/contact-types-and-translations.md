# Language-neutral translation, and contact types — one real entity, many real, coexisting facts

Two, real, related design decisions covered together: how this application translates every real, user-facing word without treating English as a privileged, untranslated default, and how one real entity (a person, a company) can genuinely be a customer, a vendor, and an employee all at once, each real role coexisting rather than forcing a choice.

## Language-neutral translation: every real language, including English, a peer

An earlier design treated `translation` as its own dedicated database
table (`entity_id`, `language_id`, `text`), with English implicitly
privileged as "the" real, canonical text every other language
translated *from*. Per direct instruction, this is wrong on two
counts: first, no dedicated table is permitted anywhere in this
application, under any circumstances — the same, entity-only principle
already applied to division, location, and part; second, English
itself should hold no privileged status at all — it is one real
language among several, not the source of truth being translated out
of.

**The corrected model**: a real, direct, language-neutral *concept*
entity holds no text of its own beyond an internal key. Every real
language — English included — is a peer, with its own real vocabulary
of direct child entities living under it: one real child per concept
it has a word for, that child's own name being the actual word or
phrase in that language, its own `relation_id` pointing back at the
shared concept.

```typescript
export function setTranslation(conceptName: string, languageName: string, text: string, userId: UserId): void {
  const conceptId = (db.prepare(`SELECT id FROM current_entities WHERE name = ?`).get(conceptName) as { id: number } | undefined)?.id;
  const languageId = (db.prepare(`SELECT id FROM current_entities WHERE name = ?`).get(languageName) as { id: number } | undefined)?.id;
  const stale = db.prepare(`SELECT e.id, e.name FROM current_entities e WHERE e.parent_id = ? AND e.relation_id = ?`).get(languageId, conceptId) as { id: number; name: string } | undefined;
  if (stale) {
    if (stale.name === text) return;
    deleteEntity(stale.id, userId);
  }
  const created = createEntity({ name: text, parentId: languageId }, userId);
  updateEntity(created.id, { relation: conceptName }, userId);
}
```

For "Balance Sheet": one real concept entity exists. Under `English`,
a real entity named `Balance Sheet` exists with its own `relation_id`
pointing at the concept. Under `German`, `Bilanz`; under `French`,
`Bilan` — each structurally identical, none privileged.

`getVocabularyWords` — the real, single source of truth the
Translations admin screen reads from — reflects this directly: a real
concept is genuinely any entity with at least one real, direct child
translation under any real language, not merely a direct child of a
`Vocabulary` node (an earlier, narrower definition that silently
excluded genuinely translatable words like `Balance Sheet`, which
lives structurally under `Business Reports`, its own real menu
parent, rather than under `Vocabulary` directly):

```typescript
export function getVocabularyWords(): VocabularyWord[] {
  const concepts = db.prepare(
    `SELECT DISTINCT c.name FROM current_entities e
     JOIN current_entities c ON c.id = e.relation_id
     JOIN current_entities lang ON lang.id = e.parent_id
     WHERE lang.parent_id = (SELECT id FROM current_entities WHERE name = 'Languages')
     ORDER BY c.name`
  ).all() as { name: string }[];
  // ... each concept's own translations read via getTranslation, per real language
}
```

**A genuine, real consequence worth documenting plainly**: two
different, real concepts can genuinely share the exact same word in
the exact same language — "Setup" and "Configuration" both translate
to "Configuration" in French; "Qty" and "Quantity" both translate to
"Menge" in German. This is not a bug to silently work around with a
disambiguating suffix — it is a genuine collision in how this
application's own words are used, or a genuine ambiguity in human
language itself, and is treated as exactly that: `createEntity`'s own,
already-established scoped uniqueness (one real name per real parent)
naturally rejects it, and `setTranslation` catches this specific case
and logs it plainly for further, real study, rather than crashing the
whole database load or silently resolving it:

```typescript
  } catch (e) {
    const existing = db.prepare(
      `SELECT c.name AS concept FROM current_entities e JOIN current_entities c ON c.id = e.relation_id WHERE e.parent_id = ? AND e.name = ?`
    ).get(languageId, text) as { concept: string } | undefined;
    console.error(`FLAGGED COLLISION, for further study: "${conceptName}" and "${existing?.concept}" both genuinely translate to "${text}" in ${languageName} — a real, human-language ambiguity, not silently resolved.`);
    return;
  }
```

Migrating this application's own, several thousand existing
translation rows to this model surfaced over a hundred such genuine
collisions in practice — evidence this is a real, common linguistic
phenomenon worth surfacing, not a hypothetical edge case.

## Contact types — one real contact, any real combination of roles

A customer, a vendor, and an employee were originally three,
structurally separate parents in the entity tree — `Accounts
Receivable`, `Accounts Payable`, `Employees` — meaning a real contact
could only ever be exactly one of these, by construction, since
`parent_id` is a single value. This is wrong: in reality, these
categories are not mutually exclusive — a real person can genuinely be
both an employee and a customer at once.

**The corrected model**: `Contacts` (scoped per-business — see
`business-evolution-plan.md`'s own real, planned Chart of Accounts
class/instance work, which this depends on) is the one, real,
structural home every real contact's own `parent_id` points to,
regardless of how many roles it plays. A "contact type" (`Customer`,
`Vendor`, `Employee`, or any further, real, user-defined type — itself
a real, extensible Vocabulary concept, the same pattern as `Division
Type`/`Location Type`) is a real, named relationship, not a structural
parent — built directly on the dimension mechanism (see
`multi-dimensional-reporting.md`), since a contact genuinely needs to
hold more than one type at once:

```typescript
export function setContactType(contactName: string, typeName: string, userId: UserId): void {
  setEntityLink(contactName, `Contact Type: ${typeName}`, typeName, userId);
}

export function getContactTypes(contactName: string): string[] {
  const rows = db.prepare(
    `SELECT target.name AS target FROM current_entities child
     JOIN current_entities target ON target.id = child.relation_id
     WHERE child.parent_id = (SELECT id FROM current_entities WHERE name = ?) AND child.name LIKE ?`
  ).all(contactName, `${contactName} — Contact Type: %`) as { target: string }[];
  return rows.map((r) => r.target);
}
```

Each real contact type itself carries its own real base account,
using the same, established `setDimensionParent`/`Header Account`
mechanism already proven for `Suppliers` → `Accounts Payable`:
`Customer` → `Accounts Receivable`, `Vendor` → `Accounts Payable`,
and — a genuine, correct accounting point, not an oversight —
`Employee` → `Accounts Payable` also, since real payroll (salary
owed, tax withheld, other real deductions owed) is genuinely a payable
obligation, not a receivable one. A contact's own real, effective base
account(s) are derived, never stored directly — a contact with more
than one real type can genuinely have more than one real base account:

```typescript
export function getContactBaseAccounts(contactName: string): string[] {
  const types = getContactTypes(contactName);
  const accounts = types.map((t) => getDimensionParent(t, 'Header Account')).filter((a): a is string => !!a);
  return [...new Set(accounts)];
}
```
