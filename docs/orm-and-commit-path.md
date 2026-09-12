# How data actually moves — ORM usage, and the real commit path from a panel to the database

Per direct request: a plain, honest description of how limited this
application's use of an ORM actually is, and, concretely, how a real
edit made on a real, on-screen panel actually reaches the database.

## 1. There is, genuinely, no ORM at all

The honest, direct answer: this application uses `better-sqlite3`
directly — a real, synchronous SQLite driver, not an Object-
Relational Mapper. There is no Prisma, no TypeORM, no Drizzle, no
query builder of any kind standing between the application code and
SQL. Every real read and every real write is a real, hand-written SQL
string, executed directly:

```typescript
db.prepare(`SELECT * FROM current_entities WHERE id = ?`).get(id);
db.prepare(`INSERT INTO entity_update (entity_id, name, parent, relation, updated_by)
             VALUES (?, ?, ?, ?, ?)`).run(id, name, parentName, relationName, userId);
```

This was a deliberate, ongoing choice, not an oversight: the real,
central "everything is an entity, reached through a real, general
tree" model this application is built around doesn't map cleanly onto
a real, conventional ORM's own assumptions (one table per real
concept, with a real, fixed set of typed columns). Writing SQL
directly keeps that model honest — a real query can walk the real
tree, resolve a real dimension link, or read a real historical value
exactly as the model requires, without an ORM's own abstraction
getting in the way or silently assuming a shape the data doesn't
actually have.

## 2. The real, append-only pattern underneath most writes

A second, real, deliberate choice, worth being explicit about: many
of this application's own core tables are genuinely append-only, not
mutated in place. `updateEntity`, for a real, concrete example, never
runs a real SQL `UPDATE` on an entity's own row at all — it inserts a
new, real row into `entity_update`, recording the real, new name/
parent/relation alongside who changed it and when. The `current_
entities` table a real query actually reads from is itself a real,
computed view over this full, real history — always resolving to the
latest, real state, while the full, real history of every change
remains intact underneath it.

This is why `getEntityHistory` (the real "History" tab a real,
individual entity's own edit screen can show) is possible at all —
there's a real, genuine, complete record of every past name, every
past parent, every past relation, not just whatever the current
value happens to be.

This isn't universal, and it's worth being honest about the real
exceptions rather than implying a blanket rule: a real entity's own
account number (`account.accountnumber`), for one, direct, concrete
example, genuinely is mutated in place with a plain SQL `UPDATE` —
no real history of a past account number is kept. The real, guiding
distinction is whether a past value is genuinely worth keeping (an
entity's own name or structural position, yes; an account number
correction, generally not) — not a single, universal rule applied
everywhere without exception.

## 3. The real, concrete commit path — from a panel to the database

Using the Structured Editor's own "Save" button as a real, direct,
worked example:

1. **On screen**: a real, ordinary Svelte component holds a real,
   local, in-memory copy of the fields being edited — `editName`,
   `editParent`, `editRelation` — plain, real, reactive variables, not
   backed by any real, client-side database or cache.
2. **On Save**: the component calls a real, typed function from
   `frontend/src/lib/api.ts` (`updateEntity(id, { name, parent,
   relation })`), which is a thin, direct wrapper around the browser's
   own `fetch`, sending a real HTTP `PATCH` request to the backend.
3. **The backend route** (`backend/src/routes/entities.ts`) receives
   this request, validates its own shape (via `zod`), and calls the
   real, corresponding function in `backend/src/db.ts`.
4. **`updateEntity` (db.ts)** runs the real, direct SQL shown above —
   inserting into `entity_update`, never mutating a row in place.
5. **The response**: the backend returns the real, freshly re-read,
   current state of that entity (via `getEntity`, which reads back
   from `current_entities`), and the frontend replaces its own, local
   copy with it — so what's on screen always reflects what was
   actually, successfully committed, not just what was optimistically
   typed.

There is no real, separate "ORM layer" at any point in this chain —
each step is a real, direct, individually readable piece: a Svelte
component, an HTTP call, an Express route, a SQL statement.
