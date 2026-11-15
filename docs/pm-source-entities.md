# Application Source as Entities

The frontend's `.svelte` files are stored as entities in
`application/application.sqlite`, under `Application/Source`, and the
files on disk are regenerated from them. The entities are the source; the
files are a cached output that Vite, `svelte-check` and the tests read.
Today all 107 `.svelte` files (34,569 source nodes, 260,151 entity rows,
19 MB) regenerate byte for byte.

## How a file is stored

`Application/Source` mirrors the repository's paths: one `Folder` entity
per directory and one `File` entity per file (`Application/Source/frontend/src/lib/components/CashTransaction.svelte`).
Under a file, each part is a thing named by an order key (`a0`, `a1`,
`a0V` … from `fractional-indexing`), so sorting children by name gives
their order and a part can be inserted between two others without renaming
anything. Each part's properties are relations, exactly as for any other
entity.

| Kind | Is | Relations |
|---|---|---|
| `Element` | `<tag …>…</tag>`, including components and `svelte:` elements | `Tag`, `Tag End` (text before `>`, e.g. ` /`), `Closed` |
| `Attribute` | Any attribute or directive | `Name` (`class`, `bind:value`, `onclick`), `Assign`, `Quote`, `Space` (when not one space), or `Shorthand` + `Code` for `{x}`, `{...x}`, `{@attach …}`; its value's parts are its things |
| `Text` | Text, and whatever lies between two parts | `Raw` |
| `Expression` | `{x}`, `{@html x}`, `{@const …}`, `{@render …}` | `Code` (inside the braces) |
| `Block` | `{#if}`, `{#each}`, `{#await}`, `{#key}`, `{#snippet}` | `Form`; its tags and content are its things |
| `Block Tag` | `{#if a}`, `{:else}`, `{/if}` | `Code` |
| `Comment` | `<!-- … -->` | `Raw` |
| `Script` | `<script>` | `Tag`, `Tag End`; attributes, then one `Statement` per top-level statement |
| `Statement` | One top-level statement with the text before it | `Code` |
| `Style` | `<style>` | `Tag`, `Tag End`; attributes, then rules |
| `Rule` / `At Rule` | A CSS rule; `@media` and the like | `Selector`, `Before`; `Head`, `Braced` |
| `Declaration` | `property: value` | `Property`, `Separator`, `Value` |

The kinds are part of the core's `KINDS`. A `File` also has a `Digest`
relation, the SHA-256 of its text when it was last written as entities.

## The converter (`backend/src/source/svelte-to-entities.ts`)

`svelteToTree` parses a file with Svelte's own parser (`parse(src, {modern: true})`)
and builds a `SourceNode` tree; `writeTree` writes a tree under a parent
with the four calls; `emitTree` is a reference emitter used to prove the
converter exact before anything is written. `backend/scripts/source-import.ts`
runs them over `frontend/src`:

- `--fresh` builds the database from scratch;
- without it, it absorbs files edited by hand: a file whose digest differs
  is retired (renamed, `Hidden`, kept in the history) and written again; a
  file gone from disk is retired; nothing is deleted.

Absorbing is the bridge until the source tree editor exists.

## The source compiler (`source_compiler/`, LFE)

Written in LFE (Lisp Flavoured Erlang) and run on the BEAM. It reads only
the entities, through the `sqlite3` command-line tool as the storage engine
does, and never the files. `source_compiler/fetch_deps.sh` clones LFE at
v2.1.5 (pinned; the development branch needs a newer OTP than the 25
installed) into `source_compiler/deps/`.

- `source-entities` loads the current version of every entity and answers
  name, kind, relation value and ordered things.
- `source-svelte` emits each kind of node and writes the files, only those
  whose text changed.
- `source-lisp` extracts the Lisp view of a file: elements as
  `(tag.class (attribute value) children…)`, expressions as `(js "…")`,
  blocks as `(if (js "…") … (:else …))`, scripts as `(ts "…")`, rules as
  `(rule "selector" (property "value"))`. Layout whitespace is left out of
  the view; the entities keep it. The view is read-only for now.
- `source-cli` is the command line: `regenerate <db> <out-dir> [<prefix>]`
  and `print <db> <path>`.

## Make targets

| Target | Does |
|---|---|
| `make source` | Make-style: regenerates the files only when `application/application.sqlite` or the compiler changed (stamp: `application/.regenerated`) |
| `make source-regenerate` | Regenerates now; writes only files whose text changed |
| `make source-print FILE=frontend/src/…` | Prints a file's Lisp view |
| `make source-absorb` | Takes hand edits of `.svelte` files back into the entities |
| `make source-import-fresh` | Rebuilds the database from the files, discarding its history |
| `make source-compiler` | Builds the LFE modules (and fetches LFE the first time) |
| `make check-source-regenerates` | Gate, in `verify-fresh`: every `.svelte` file on disk is exactly what the entities generate |

Deleting every `.svelte` file under `frontend/src` and running
`make source-regenerate` leaves `git status` clean.

## Not yet

TypeScript files (`frontend/src/lib/*.ts`), the source tree editor, templates
and traits, compile-time functions, and incremental regeneration per entity
rather than per file are later phases of the plan ("Application Source as
Entities — Implementation Plan").

## Unit tests (`backend/test/source.test.ts`)

- "every .svelte file in the frontend converts to a source tree that emits it back byte for byte"
- "a component becomes elements, attributes, expressions, block tags, statements and style rules"
- "a source tree is written as entities: one thing per node, named by order keys, its properties as relations"
