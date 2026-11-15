# Application Configuration as Entities

The frontends are to be generated from a small amount of configuration
kept as entities, not from stored source code. That configuration lives in
git as one ASCII file, `application/application.entities` (about 170 KB,
about 25 KB compressed): the current state of the entities, with no history
and nothing else. The words it refers to (labels, titles) are the existing
vocabulary and translation entities, by key.

## What it holds

| Under `Application/` | One per | Taken from |
|---|---|---|
| `Calls` | Backend call | The step runner's screens (`shared-fixtures/screens.csv`, read only): the call's parameters in field order, with their field types. The frontend's API module (`frontend/src/lib/api.ts`): the client function that makes the call (`Client`) and, for calls the step runner does not make, the arguments it passes |
| `Components` | Shared component in `frontend/src/lib/components` | The component's source (see below) |
| `Screens` | Page in `frontend/src/routes`, named by route | The page's source |

A component or screen records its `Title`, the calls it makes
(`Calls <name>` → the call), its `Source` file, and in document order its
things:

| Kind | Is | Relations |
|---|---|---|
| `Use` | A component it uses | `Component` → the component, one `Prop <name>` per prop given |
| `Heading` | A legend or heading | `Text` |
| `Field` | An input, select or textarea | `Control`, `Bind` (what it is bound to), `Type`, `Placeholder`, `Label` (the nearest enclosing legend or label) |
| `Action` | A button | `Label`, `Handler` |
| `Column` | A table column | `Label` |

Calls and parameters, components and screens are ordered, through the
`Ordered` relation on their kinds.

`backend/scripts/extract-application-config.ts` wrote the first version of
the file from what exists today; from here on the file is the source. It
is not yet edited by any tool other than a text editor, and nothing is yet
generated from it: the generator that produces the Svelte web and terminal
screens from it is the next step.

## The ASCII form (`backend/src/entities/entities-text.ts`)

`dumpEntitiesText(store)` writes a store's entities, and
`loadEntitiesText(store, text)` reads them into an empty store. Writing what
was read gives back the same text.

- One line per entity, indented one space per level of depth.
- The line starts with the entity's name, or `-` for an ordered child (the
  loader gives it the next order key, `a0`, `a1`, …).
- `:KIND` is its `Kind` relation, to `/Root/Application/Kinds/KIND`.
- `>PATH` is what the entity itself points at.
- `KEY=VALUE` is a relation to a value of its own (a child named `VALUE`
  that the relation points at).
- `KEY>PATH` is a relation to another entity, by absolute path
  (`/Root/Application/Calls/save`).
- An entity's things are ordered, and written as `-`, when it or its kind
  has `Ordered>/Root/Active`.
- Names, keys, values and path segments are bare when made only of
  letters, digits and `_ . + $ @ -`, and are otherwise JSON strings, with
  every character outside printable ASCII escaped (`×`).
- Only the current version of each entity is written; hidden entities
  (`Hidden>/Root/Active`) are left out.

## Unit tests (`backend/test/application-config.test.ts`)

- "the ASCII form of the entities loads and writes back unchanged"
- "values, references, kinds, ordered children and escapes survive the ASCII form"
- "every call the step runner makes is configured with its parameters in screen order"
