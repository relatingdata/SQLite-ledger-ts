# Application Configuration as Entities

Both front ends are generated from configuration kept as entities: part
of the web frontend and part of the TUI today, all of both by rule (see
"One description, two front ends"). The configuration is one ASCII file in git,
`application/application.entities` (about 170 KB, 29 KB compressed):
the current state of the entities, with no history. The words it refers to (labels, titles) are the existing
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
- `app-view` resolves variants (below); `app-lisp` prints configuration
  as Lisp; `app-css` writes the styles (below).
- `app-svelte` holds the templates. Each is an ordinary function run while
  generating: it takes a screen's configuration and returns its page. They
  share smaller functions (a field, a column's header and cell, a money
  input), and the templates contain no characters outside ASCII (HTML
  entities and `\u` escapes instead).
- `app-sveltui` holds the TUI's templates (see "One description, two
  front ends" below).
- `app-generate` is the command line: `generate <application.entities>
  <frontend-dir> [<tui-dir>]` writes `<frontend-dir>/src/routes<route>/+page.svelte`
  for each such screen and, given the TUI's directory, its TUI screen,
  only when its text changed.

`make generate` reruns only when the entities or the generator changed
(stamp: `application/.generated`); `dev`, `dev-verbose`, `web-frontend`,
`test`, `ensure-servers` and `check-frontend` depend on it.

### Templates

58 of the 81 routes are generated. Each screen names its template, or
takes its base screen's (Variants, below):

| Template | Screens | Reads |
|---|---|---|
| `transaction` | Cash Purchase, Cash Sale, AP Purchase, AR Sale, Purchase Order, Sales Order, Stock Receipt, Stock Transfer, Quotations, RFQ | `Title`, `Intro`, `Action`, `Totals`, `Total Label`, `Party` / `Party Label`, `Submit Label`, `Fail Text`; its `Field` and `Column` things |
| `report` | Trial Balance, Balance Sheet, Below Reorder, Inventory and Storage, Aged Receivables/Payables, Reminders, Customer Statement, Sales Report, Cash Flow Forecast, Business Configuration Report, Stock-Out Risk, Journal Entries, Compare Ledgers | `Title`, `Intro` (`{NAME}` in it is the business or ledger, by `Intro Name`; optional), `Report`, `Clear Label`, `Empty Text` with an `Empty Link` to `Empty Href`; parameter `Field`s (`Control=ledger` chooses the ledger); one `Entry` per column |
| `drill` | Profit and Loss, Stock Movement Report, Inventory Listing | `Title`, `Intro`, `Report`, `Title Line`, `Empty Text`, `Clear Label`; parameter `Field`s in a row of controls |
| `forms` | Account Settings, Accounting Periods, Vocabulary, Projects | `Title`, `Intro`, `Status`, `State`, parameter `Field`s; one `Section` per form (`When State`) (`Title`, `Action`, `Submit Label`, `Initial`, `Preview`; or `Each`, `Empty Text`: a form per record), its `Field`s under it |
| `list` | Bank Accounts, Hierarchies, Translations, Users | `Title`, `Intro`, `Records`, `Key`, `Insert`, `Delete`, `List Title`, `Hint`, `Empty Text`, `Lists Title`, `Lists Class`, `Modes`, `Needs Role`; `Entry` columns, `Field`s of the insert form; `Section`s with `Records` (more lists, `Of` another), `Table`, `Button`, `Cards`, `Lines`, `Each`, `Search`, `Pickers`, `Grid`, `Form Of`, or an always-open `Card` form |
| `review` | Year End Close | `Title`, `Intro`, `Intro Note`; parameter `Field`s; one `Section` per entry proposed (`Title`, `Intro`, `Hint`, `Propose`, `Propose Label`, `Proposal Title`, `Accept`, `Accept Label`), its own `Field`s under it |
| `pivot` | Stock on Hand (`/reports/new-stock-on-hand`), Sales and Margin (`/reports/sales-margin`) | `Title`, `Intro`, `Row Axis`, `Column Axis`, `Axis Chooser` (`drag` or `select`), `Highlight`, `Highlight Across`, `Empty Text`, `Clear Label`; date `Field`s `fromDate`/`toDate`; one `Entry` per measure |
| `tiles` | AR / AP, Stock, Reports (section index pages) | `Title`, `Intro`; one `Tile` (`Href`, `Title`, `Description`) per link |
| `compose` | AP Payment, AR Receipt | One `Use` per component, its props as `Prop <name>` |
| `not-implemented` | 16 screens not built yet | `Title`, `Description` |

In `transaction`, fields before the first column go above the line grid
and the rest below it. A `Field` has a `Name`, `Label` and `Control`:
`text` (`Placeholder`), `date`, `number`, `quantity`, `amount`, `percent`,
`textarea`, `pick` (a select of fixed `Options`), `toggle`, `checkbox` (`yes` when ticked), `choose` (choices from the named `Choices` source, an `Empty`
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
a parameter changes. A footer row has the class `totals-row`, and its cells `amount-<entry>`;
the status line has the class `status`. Entries with a `Table` form another table, shown for
groups whose `table` names it (Aged: summary or detail). A group can
relabel headings (`labels`), and the report can give a title and intro of
its own for its parameters (Aged Payables). `Command` things are buttons
on each row, as in listed records; a `toggle` field is a row of buttons
(`Options`), and a field's `Query` takes its first value from the page
address (`/reports/aged?type=AP`). A parameter that `Reacts` runs its
reaction when it changes (Compare Ledgers keeps Ledger B other than
Ledger A). An `Entry` with `Control=link` links each cell to its `Href`,
where `{name}` stands for the row's cell of that name (Journal Entries:
`/journal/{id}/{date}`). A `Print Label` adds a print button; a group's
`meta` lines show above its table (who and when, on a statement). A table whose entries all have an empty
`Label` has no heading row. In
`Options`, an underscore in a label stands for a space.

In `drill`, the parameters sit in a row of controls (`.controls`; none,
none shown); a `choose` field can `React`, be `Filter`ed and show its
choices under headings (`Grouped=yes`). A `Title Line` puts a title block
naming the business above the report. The named report returns sections:
each a heading line with its name and figures (and a detail and tags)
that opens to its table and the sections under it, drawn by
`frontend/src/lib/DrillSection.svelte`, a building block that knows no
one report. A section's table has its own columns (none given: an
account as a tree, its debit and its credit); an `input` column is a
number field whose change saves the row through the section's `save`.
The report can end with a total line (`grandTotal`, class `grand-total`)
or give a message in place of its sections.

In `forms`, each `Section` is a form drawn by
`frontend/src/lib/components/Form.svelte` under its `Title`: its fields
(`Control` `text`, `number`, `select` with options from its `Choices`
source, `password` or `date`; `Min`, `Max`, `Hint`, `Autocomplete`), saved
by its `Action` (`formActions`), started from its `Initial`
(`formInitials`), with a line from its `Preview` (`previews`) under it. A screen's `Status`
names a line (`statuses`: `periodStatus`) shown above its forms and
reloaded after each is saved; a `Section` with no fields is its button
(Reopen period). A `Section` with `Each` is a card per record that the
runtime's `formRecords` returns (`key`, `title`, `note`, `values`, and
the `options` of each select), its fields a form of that record; saving
passes the record's `key` with the values, and the records are reloaded
after each save. With no records it shows its `Empty Text`.
A screen's own `Field`s are its parameters, choices in a row above
the forms (`Choices`, `Empty`), passed to every form's action. Its
`State` names a state (`states`) worked out from the parameters and
reloaded as they change and after each save: a name, and lines shown
above the forms; a `Section` with `When State` is shown only in that
state. A select field's `Empty` is its first choice, nothing chosen
yet; an action returning a `message` shows it under the forms.

In `list`, records are selectable lists
(`$lib/components/SelectableListEditor`), a line per record with its
`Entry` columns (`Control=amount`: a figure, right-aligned;
`Control=hint`: a note), each record identified by its `Key`. The
screen's own `Records` (`records`) is a list on its own, under its `List
Title`. A `Section` with `Records` is one of the lists drawn side by
side, under the screen's `Lists Title`, with its `Lists Class` on them;
one with `Of` naming another lists the records of the row selected
there (`records` is given that row), titled with the selected row's
`Show`. Insert opens a form of the list's `Field`s (`Choices`: a source;
`Step` for a number; `Options` as `value=Label`) saved by its `Insert`
(`formActions`; a detail list's parent key as `parent`): a `Form`, or
with `Inline` plain controls that save on Enter and close on Escape.
Delete runs its `Delete` (`commands`) on the selected record, after
asking when it has `Confirm`.

A `Section` with `Table` is a table of figures under its `Title`, from
the runtime's `tables` (columns, and rows of cells with any cell's
class), shown when it has rows. A `Section` with `Button` opens a small
form of its `Field`s (class: its `Class`) with its `Submit Label` and
`Cancel Label` buttons; Enter saves and Escape closes. Its `Action`
(`formActions`, given the key selected in its `When Selected` list as
`selected`) may return a `message`, shown under it, or a key to
`select` in its `Selects` list. It is offered while its `When Choices`
field has choices, or while its `When Selected` list has a selection
whose `Selected Has` is set. A `Section` with `Cards` shows groups of
items (`cards`) under its `Title` and `Hint`, or its `Empty Text`; one
with `Lines` is growable rows of its `Field`s (`Add Label` adds one),
saved together by its `Action` (`lineActions`) with its `Submit Label`.
A choice field with `Default=first` starts on its first choice (of
those its `Filter` leaves), any other `Default` on that value; a field
with a `Label` is in a fieldset under it.

A list `Section` with `Search` has a search box (that placeholder)
filtering it by its `Search On` field, with how many it finds, showing
at most its `Limit`; a `Section` with `Search` alone is that box
counting its `Counts` list. A `Section` with `Each` is a form per
record (`formRecords`), each saved on its own by its `Action` with the
record's `key` (and the selected key of its `Of` list as `parent`): with
`Of`, the selected row's records under its `Show`, or the `Empty Text`
until one is selected; otherwise records from the pickers' values and
the search, reloaded as they change, a line each with `Rows`. A
`Section` with an `Action` and a `Card` but no `Button` is a form always
open under its `Title`. `Card` puts a section in a card of that class
(`Card Title` above it). The screen's `Modes` (`value=Label ...`) are
buttons choosing what is shown: a `Section` with `Mode` is shown only
in that mode, and one with `Pickers` holds that mode's choices.

A `Section` with `Grid` is a table from the runtime's `grids`: text
columns, a checkbox per check column, and each row's buttons, under its
`Title` and `Intro`, with its own `Field`s as its parameters above it
(the grid is reloaded as they change). Ticking a box runs its `Toggle`
(`gridToggles`); a row's button runs a `rowActions` entry, first asking
for a value when the button says so (Reset password), and a text it
returns is shown as done. With `Insert`, the Insert key opens the
`Section` whose `Form Of` names the grid: a `Form` of its fields in a
card under its `Title`, saved by its `Action` (a multiselect's values
comma-separated). Its `Delete` (`rowActions`) runs on the selected row
when that row allows it. The keys work anywhere in the grid's card; its
`Hint` line is the toolbar to focus. A screen with `Needs Role` shows
only its `Needs Role Text` to a user without that role.
Everything is reloaded after each change.

In `review`, the screen's `Field`s are parameters in a card at the top
(`Control` `select`, `date` or `text`; `Label`, `Hint`, `Placeholder`,
`Default`). Each `Section` is a card with its own fields and a button
(`Propose Label`) that asks `proposals` for an entry (its `Propose`),
shown under its `Proposal Title` account by account (debit, credit),
with the proposal's figures and listings, to Reject or accept (`Accept
Label`): `accepts` (its `Accept`) posts it and returns what was done, a
title, lines, listings and a note. An error is shown in the section
(class `error`). Changing any value drops what was proposed or done; the
choices are reloaded after each proposal and acceptance. A `select`'s
choices come from its `Choices` source after its `Empty` choice; one
with no `Empty` always holds one of its choices. A field with `Reacts`
runs that reaction when changed; one with `When Empty` naming another
field is shown only while that one is empty (the new ledger's name,
while no existing ledger is chosen).

### The general report cube, and the `pivot` template

Every financial event is a journal posting to an account, and every
account resolves to an Item, a Location, a Category and the business's own
hierarchies. So a report on sales, cost of goods sold or stock is a set of
measures broken down by two axes, and the backend answers all of them with
one call, `getCube` (`backend/src/db-matrix-reports.ts`; tests in
`backend/test/cube.test.ts`). A measure is configuration, sent as text
(`name=source`) and read by `parseCubeMeasure`:

| Source | Totals |
|---|---|
| `postings:-Sales Revenue` | journal postings to every account under the named roots, sign flipped (`+` keeps it); several roots with `\|`; `#TAG` for accounts tagged TAG (`#COGS`, each item's own cost of goods sold account) |
| `onHand` | stock on hand now, per item and location |
| `stockValue` | what that stock cost, as the books hold it (its first-in, first-out layers) |
| `onHandAt:cost`, `onHandAt:retail` | on-hand quantity at the preferred source's unit cost, or the retail price |

Postings fall in the period `fromDate`..`toDate` (with only `toDate`, a
balance as at that date); stock is as it is now. A measure with a
`Formula` instead is arithmetic on the others (`sales - cogs`,
`margin / sales * 100`), worked out from summed totals, so a percentage is
right in a total too; dividing by nothing shows a dash.

The `pivot` template puts this on screen through two traits, written once
as components:

- **Axes** (`AxisChooser.svelte`): drag fields from the tray into Rows and
  Columns (or click them; `Axis Chooser=select` gives two lists instead);
  an empty zone is Consolidated; &#x21C4; swaps rows and columns; either axis
  narrows to one value. Fields of the same side never cross (Item with
  Category or an item hierarchy such as Size; Location with a location
  hierarchy such as Division): the one dropped bounces back. Which side a
  hierarchy is on comes from `getAxisValues`'s `group` column; a hierarchy
  with no values in the ledger is not offered.
- **Pivot** (`PivotGrid.svelte`): each cell shows the measures, with row,
  column and grand totals and the `Summary=yes` measures' totals above.
  The `Highlight` measure shades each row (or column) from its worst, red,
  to its best, green: an item's under-performing and excellent locations,
  or the reverse after a swap. Clicking a measure's heading shades by it.

Its tests (`backend/test/cube.test.ts`), on a business with two items
bought at a cost and sold unevenly at two locations:

- "getCube: sales by item and location, positive, each in its own cell"
- "getCube: on-hand quantity is what was received less what was sold, per item and location"
- "getCube: stock on hand at what it cost, as the books hold it"
- "getCube: swapping the axes transposes the cells, and Consolidated totals them"
- "getCube: a period counts only the postings in it"
- "getCube: cost of goods sold per item and location, at what the units sold cost"
- "getCube agrees with getStockOnHandMatrix"
- "parseCubeMeasure: rejects what it cannot read"

Stock measures count only the business's own locations. Cost of goods
sold is posted per item and location when a POS sale is made, at what the
units cost first in, first out (below), so margin shows per location.

`getCube` tells sales from cost of goods sold by where the account sits
(under Sales Revenue or Cost of Goods Sold), not by its name.

### First in, first out (default middleware)

`stockValue` and the cost of goods sold in these cubes are first in,
first out: `stockCostLayers` and `fifoCostMinor` (`backend/src/db-stock.ts`)
read an item's stock at a location back from the journal as the layers it
arrived in, oldest first, each at its cost, a transferred-in batch arriving
as the layers it left with. The rules, a worked example and how the two
middlewares compare are in *Stock API*, "First-in, first-out cost".
`make seed-pivot-demo` adds a demo business, Pivot Demo Wines, with three
wines bought at two prices and sold unevenly at three shops.

### The Paged trait

A list longer than the user's page size (their `Page Size`, 20 by
default) shows one page at a time with the page buttons every paged list
shares (`frontend/src/lib/PageButtons.svelte`: first, previous, "Page n of
m", next, last). It applies to every report group and every listed-records
table; a screen that should show everything at once says `Paged=no`
(Trial Balance, Balance Sheet). Generated screens page rows they have
already loaded (`pageRows`, `pageCount` and `movePage` in
`frontend/src/lib/pagination.ts`); a report that pages on the server says
`Paged=server` (Journal Entries): it is asked for one page (`limit`,
`offset`) and returns its `total`.

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

- `sources`: a choose field's choices, given the business and ledger
  (`locations`, `items`, `providers`, `customers`, `postableAccounts`,
  `axes`, `ledgers`, `stockGroupings`, `numberFormats`, `dateFormats`,
  `reportingPeriods`, `equityAccounts`, `bankAccountCandidates`,
  `bankScopes`, `hierarchyPrototypes`, `languages`, `roles`, `businesses`,
  `employees`, `expenseAccounts`);
  a choice can name its `group`;
- `filters`: narrowing one field's choices by the others (`sameCityAsFrom`,
  `againstInner`, `againstOuter`, `otherThanLedgerA`, `otherThanReference`);
- `reactions`: run when a field changes, returning a patch of values,
  narrowed choices and an information line (`onHand`,
  `fromLocationChanged`, `itemSources`, `providerPrice`, `orderStatus`,
  `outerAxisChanged`, `innerAxisChanged`, `ledgerAChanged`, `periodChosen`);
- `totals`: `lineTax`, `taxRate`, `valueTaxRate`, `quantityTimesPrice`;
- `actions`: the backend calls a submit makes (`purchase` and `sale`, on
  account or, when the party is `Cash`, paid at once; `transfer`,
  `purchaseOrder`, `salesOrder`, `orderReceipt`, `quotation`);
- `reports`: `trialBalance`, `balanceSheet`, `belowReorder`, `storageSpace`, `aged`, `reminders`, `statement`, `sales`, `cashFlow`, `businessConfiguration`, `stockOutRisk`, `journalEntries`, `compareLedgers`, and for `drill` `profitAndLossByAxis`, `stockMovement`, `inventoryListing` (a row can carry a class, `mark`, and cells classes, `marks`);
- `formInitials`, `formActions`, `previews`: a `forms` screen's forms
  (`pageSize`, `formats`, `closeThrough`; `savePageSize`, `saveFormats`,
  `changePassword`, `closePeriod`, `reopenPeriod`, `saveVocabulary`,
  `registerBankAccount`, `createHierarchy`, `createHierarchyValue`,
  `saveHierarchyPrototype`, `createHierarchyFromPrototype`,
  `addVocabularyWord`, `addLanguage`, `setTranslation`, `createUser`,
  `clockIn`, `clockOut`;
  `formats`),
  `formRecords` (`vocabularyConcepts`, `wordTranslations`,
  `wordsToTranslate`), and
  `statuses` (`periodStatus`), `states` (`projectClock`);
- `proposals`, `accepts`: a `review` screen's entries proposed and
  posted (`closeBooks`, `rollover`);
- `grids`, `gridToggles`, `rowActions`: a list screen's grids (`users`,
  `businessRoles`), their ticks (`userRole`, `businessRole`) and their
  rows' buttons (`reactivateUser`, `deactivateUser`, `resetPassword`);
- `tables`, `cards`, `lineActions`: a list screen's tables of figures
  (`cashPosition`), groups of items (`productShapes`), and growable rows
  saved together (`defineProductShape`);
- `records`: what a screen lists (`quotations`, `bankAccounts`,
  `hierarchies`, `hierarchyValues`, `vocabularyWords`, `languages`), and `commands`: what its
  record buttons do (`markSent`, `accept`, `reject`, `sendReminder`, `resetReminder`,
  `unregisterBankAccount`, `deleteHierarchy`, `deleteHierarchyValue`,
  `deleteVocabularyWord`, `removeLanguage`). A validation
  failure throws `Invalid`, whose message is shown.

### Styling

Styling is configuration too: one `Rule` entity per CSS rule under
`Application/Styles`, its `Selector` and one relation per property. The
generator writes them to `frontend/src/lib/generated.css`, every selector
scoped under `.generated` (the class every generated page carries), so no
hand-written page is affected. Templates emit class names only.

### Checking the generated screens

The step runner's browser path drives the generated pages the
tutorials and standalone tests use (Cash Purchase, Cash Sale, Purchase
Order, Stock Transfer, the reports); `every-page-opens` opens every
page, and `svelte-check` (`make check-frontend`) checks them all.

## One description, two front ends

Every screen is described once, in `application/application.entities`,
and both front ends are generated from that description: the web page by
`app-svelte`, the terminal screen by `app-sveltui`. Neither front end has
a screen of its own. A field added to a screen's description appears on
the web and in the TUI, or in neither; nothing in either front end
repeats what the description says.

The two generated screens differ only where the two kinds of display
differ, and that difference lives in one place per front end:

- **The web** draws a template's page in HTML (`app-svelte` writes the
  whole page).
- **The TUI** draws a template's screen with its form for that template
  (`tui/src/forms/TransactionForm.svelte`, `ReportForm.svelte`); `app-sveltui`
  writes the screen's spec, which the form draws: a typed field is a
  text input, a choice is a list, the submit button is the first of the
  actions listed below the form, the web's Insert key is I.
- **The behaviour** is shared, not translated: choice sources, filters,
  reactions, totals, actions and reports are the web's
  `frontend/src/lib/screen-runtime.ts`, which the TUI build
  (`tui/sveltui-build`) compiles from `frontend/src/lib` together with
  the web's API client (`api.ts`), state (`state.svelte.ts`), `format.ts`,
  `money.ts` and `matrix-api.ts`, and imports as `$lib/...` exactly as the
  web does (`$app/environment` is shimmed with `browser = false`). The
  TUI's login sets the web's `auth`, so the shared API client has its
  token.

`make generate` writes the TUI's screens into `tui/src/generated`
(`<route with / as -->.svelte`, and `screens.ts`, their index by route),
build output ignored by git. The TUI's Menu opens a link's generated
screen when its route has one. The generator prints the screens it did
not make for the TUI and why: a template the TUI has no form for yet
(tiles, compose, pivot, forms, not-implemented) or a part its form does not do
yet (listed Records, Commands).

### Hand-written screens: debt

Screens written by hand, in either front end, predate this rule. Each is
to be described in the entities and deleted on both sides; until then
it is listed here, and `make check-screens-described`
(`scripts/check-screens-described.ts`, part of `make check-manual`) fails
on a hand-written screen not listed here, on a listed screen that no
longer exists (so the list only shrinks), and on a route that is both
generated and hand-written.

Hand-written web pages (`frontend/src/routes`, by route):

<!-- hand-written-web -->
- `/`
- `/contacts`
- `/customer-terminal`
- `/editor`
- `/hr`
- `/invoices`
- `/items`
- `/journal/[id]/[date]`
- `/locations`
- `/login`
- `/pos`
- `/post`
- `/session`
- `/setup`
- `/setup/business-setup`
- `/setup/business-structure`
- `/setup/chart-of-accounts`
- `/setup/new-business`
- `/setup/tree`
- `/stock/restock`
- `/stock/stock-dispatch`
- `/stock/stock-take`
- `/stock/write-offs`
<!-- /hand-written-web -->

Hand-written TUI screens (`tui/src/screens`, by file):

<!-- hand-written-tui -->
- `BusinessStructure.svelte`
- `ChooseBusiness.svelte`
- `Customers.svelte`
- `GeneralJournal.svelte`
- `ItemCategories.svelte`
- `ItemsBom.svelte`
- `Locations.svelte`
- `Login.svelte`
- `Menu.svelte`
- `NewBusinessWizard.svelte`
- `OrgChart.svelte`
- `OtherHierarchies.svelte`
- `POS.svelte`
- `Payment.svelte`
<!-- /hand-written-tui -->

The TUI screens generated today: AP Purchase, AR Sale, Cash Purchase,
Cash Sale, Purchase Order, Sales Order, Stock Receipt and Transfer Items
(transaction); Aged, Balance Sheet, Below Reorder, Business
Configuration, Cash Flow Forecast, Sales, Statement, Storage Space, Trial
Balance, Stock-Out Risk, Journal Entries and Compare Ledgers (report);
and Profit and Loss, Stock Movement Report and Inventory Listing (drill,
drawn by the TUI's report form, every section open). Inventory Listing's
levels are edited on the web only.

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
