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
the file from what existed then; from here on the file is the source.
After editing it by hand, `make format-application-config`
(`backend/scripts/entities-format.ts`) rewrites it in canonical form.

## The generator (`generator/`, LFE)

Screens that have a `Template` relation are generated: their pages are
build output, ignored by git, written by `make generate`.

- `generator/fetch_deps.sh` fetches LFE, pinned at v2.1.5 (it runs on the
  OTP 25 installed here), into `generator/deps/`.
- `app-entities` reads the ASCII form into a store and answers: a node at a
  path, its things in order, its kind, a relation's value or target.
- `app-view` resolves variants (below); `app-lisp` prints configuration as Lisp.
- `app-svelte` holds the templates. Each is an ordinary function run while
  generating: it takes a screen's configuration and returns its page. They
  share smaller functions (a field, a column's header and cell, a money
  input), and the templates contain no characters outside ASCII (HTML
  entities and `\u` escapes instead).
- `app-generate` is the command line: `generate <application.entities>
  <frontend-dir>` writes `<frontend-dir>/src/routes<route>/+page.svelte`
  for each such screen, only when its text changed.

`make generate` reruns only when the entities or the generator changed
(stamp: `application/.generated`); `dev`, `dev-verbose`, `web-frontend`,
`test`, `ensure-servers` and `check-frontend` depend on it.

### Templates

39 of the 84 routes are generated. Each screen names its template:

| Template | Screens | Reads |
|---|---|---|
| `transaction` | Cash Purchase, Cash Sale, AP Purchase, AR Sale, Purchase Order, Sales Order, Stock Receipt, Stock Transfer, Quotations, RFQ | `Title`, `Intro`, `Action`, `Totals`, `Total Label`, `Party` / `Party Label`, `Submit Label`, `Fail Text`; its `Field` and `Column` things |
| `report` | Trial Balance, Balance Sheet, Below Reorder, Inventory and Storage, Aged Receivables/Payables, Reminders, Customer Statement, Sales Report | `Title`, `Intro` (`{NAME}` in it is the business or ledger, by `Intro Name`), `Report`, `Clear Label`; parameter `Field`s (`Control=ledger` chooses the ledger); one `Entry` per column |
| `tiles` | AR / AP, Stock, Reports (section index pages) | `Title`, `Intro`; one `Tile` (`Href`, `Title`, `Description`) per link |
| `compose` | AP Payment, AR Receipt | One `Use` per component, its props as `Prop <name>` |
| `not-implemented` | 16 screens not built yet | `Title`, `Description` |

In `transaction`, fields before the first column go above the line grid
and the rest below it. A `Field` has a `Name`, `Label` and `Control`:
`text` (`Placeholder`), `date`, `number`, `quantity`, `amount`, `percent`,
`textarea`, `checkbox` (`yes` when ticked), `choose` (choices from the named `Choices` source, an `Empty`
option, `Default=first`, a `Filter`, `Show All Label`) or `one-of`
(`Options` as `value=Label value=Label`). `Reset` clears it after a
successful submit; `Unless` names a checkbox that hides it when ticked; `Reacts` names a reaction run whenever it changes. A
`Column` is `text`, `number`, `money` or `storage-badge`.

A screen with `Records` also lists records below its form (Quotations and
RFQ: `Records=quotations`), refreshed after each submit. Each `Entry`
thing is a column (`Name`, `Label`, `Control` `text` or `status`), and each
`Command` thing a button on every record whose status its `When` names
(`Command`, `Label`, `Style`); `Empty Text` shows when there are none. A
screen's `Side` (`AR` or `AP`) is passed to its actions and records.

In `report`, the named report (in the runtime's `reports`) returns
columns of groups; each group is a table of rows, already formatted, with
a footer, and the report a status line and a note. Rows can form a tree:
a parent row opens and closes the rows under it. An `Entry`'s `Control` is
`tree` (indented, with the open/close mark and any badge), `text`, `mono`
or `amount` (right aligned, red when contra). The report reloads whenever
a parameter changes. Entries with a `Table` form another table, shown for
groups whose `table` names it (Aged: summary or detail). A group can
relabel headings (`labels`), and the report can give a title and intro of
its own for its parameters (Aged Payables). `Command` things are buttons
on each row, as in listed records; a `toggle` field is a row of buttons
(`Options`), and a field's `Query` takes its first value from the page
address (`/reports/aged?type=AP`). A `Print Label` adds a print button; a group's
`meta` lines show above its table (who and when, on a statement). In
`Options`, an underscore in a label stands for a space.

### Variants

A screen that differs from another only in a few places says so:
`Variant Of` → the other screen, then only what differs. Its own values
override the base screen's (an empty value removes one); its things are
merged with the base's by `Name`: the same `Name` overrides that thing's
values, `Remove=yes` removes it, and a new `Name` is added at the end, or
straight after the thing named by its `After`. `app-view` resolves this,
and the templates see only the resolved screen. Cash Purchase and Cash
Sale are variants of AP Purchase and AR Sale: `Party=Cash`, the line tax
column, the payment method, and no reference, party or tax rate fields.
Sales Order is a variant of Purchase Order (a customer instead of the
provider, placed `After=reference`). RFQ is a variant of Quotations: `Side=AP`, providers instead of
customers, its own title, intro and labels.

### Reading the configuration as Lisp

`make print-screen SCREENS="/arap/cash-purchase /arap/ap-purchase"` prints
each screen's configuration (as stored, variants unresolved) as Lisp:
`(screen /arap/cash-purchase (title "Cash Purchase") ... (field location
(label "Receive at location") ...))`. The printing is for reading only;
the entities stay the source.

### Behaviour by name (`frontend/src/lib/screen-runtime.ts`)

What a screen does is named in its configuration and written once, by
hand, in the runtime module:

- `sources`: a choose field's choices (`locations`, `items`, `providers`,
  `customers`, `postableAccounts`);
- `filters`: narrowing one field's choices by the others (`sameCityAsFrom`);
- `reactions`: run when a field changes, returning a patch of values,
  narrowed choices and an information line (`onHand`,
  `fromLocationChanged`, `itemSources`, `providerPrice`, `orderStatus`);
- `totals`: `lineTax`, `taxRate`, `valueTaxRate`, `quantityTimesPrice`;
- `actions`: the backend calls a submit makes (`purchase` and `sale`, on
  account or, when the party is `Cash`, paid at once; `transfer`,
  `purchaseOrder`, `salesOrder`, `orderReceipt`, `quotation`);
- `reports`: `trialBalance`, `balanceSheet`, `belowReorder`, `storageSpace`, `aged`, `reminders`, `statement`, `sales` (a row can carry a class, `mark`, and cells classes, `marks`);
- `records`: what a screen lists (`quotations`), and `commands`: what its
  record buttons do (`markSent`, `accept`, `reject`, `sendReminder`, `resetReminder`). A validation
  failure throws `Invalid`, whose message is shown.

### Styling

Styling is configuration too: one `Rule` entity per CSS rule under
`Application/Styles`, its `Selector` and one relation per property. The
generator writes them to `frontend/src/lib/generated.css`, every selector
scoped under `.generated` (the class every generated page carries), so no
hand-written page is affected. Templates emit class names only.

### Checking the generated screens

The tutorials' browser path is the test: `make test-e2e-tutorial-browser`
(Retail) passes all 75 steps with the same UI results as the hand-written
pages, Cash Purchase, Cash Sale, Purchase Order and Stock Transfer going
through their generated pages; the other generated screens are checked by
`svelte-check`.

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
