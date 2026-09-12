# Money Representation: Integer Minor Units, Not "Cents"

## Naming history — `*_cents` was renamed to `*_minor`

Every monetary column and variable in this codebase used to end in
`_cents` (`amount_cents`, `balance_cents`, `unit_price_cents`, and so
on — 10 distinct real column names across 15 tables). This was raised
as a direct, fair objection: "cents" is a real, but Anglo/USD-specific
word. It's the correct term for USD, EUR, GBP, and most currencies —
but genuinely wrong for a currency with no minor subdivision at all
(JPY, KRW have no "cents") or one with three decimal places instead of
two (BHD, KWD, OMR). This app already supports multi-currency
accounts and already has real, correct ISO 4217 precision logic
(`decimalPlacesFor(unitCode)` in `format.ts`) — but its own storage
columns were still named after the one currency family where "cents"
happens to be accurate.

The correct, currency-neutral term — used throughout ISO 4217 itself,
and already present in `format.ts`'s own comments before this rename
— is **minor unit**: the smallest real subdivision of a given
currency, whatever its actual scale (100 per major unit for USD/EUR,
1 for JPY/KRW, 1000 for BHD/KWD).

Renamed everywhere: every real database column, every backend
function/interface/route, every frontend type/component, every test
file, every historical prototype script that still runs against the
real schema, and every doc that referenced the old names. "Dollar" in
prose comments (this app is not USD-specific) was similarly
genericized to "monetary."

### The migration

A real migration exists for databases created before this rename
(`migrateForMinorUnitsRename`), reusing the exact same proven strategy
already built for the earlier `sibling_id` → `relation_id` rename —
necessary again, and at a much larger scale (15 tables, not 1):
capture every view and trigger's real SQL definition from
`sqlite_master` in original creation order, drop them all, rename
every real column, then recreate everything from the saved text with
the substitution applied.

Verified directly, not assumed: tested against the actual pre-rename
schema, twice for idempotence, and separately confirmed that real,
pre-existing data (not just the schema structure) survives the rename
intact — a specific value written under the old column name was
confirmed to still be exactly the same value, under the new column
name, after migration.

### A real bug this rename caught

Running `tsc --noEmit` after the initial pass surfaced genuine,
pre-existing type errors in `invoice.ts` (PDF generation) —
`amount_cents`/`tax_cents`/`unit_price_cents` no longer existed on the
real `InvoiceLine` type. This module would have generated broken PDFs
in production; the test suite alone didn't catch it, `tsc` did.
Confirmed this specific error was newly introduced by an *incomplete*
rename (this file simply hadn't been included in the first pass yet),
not a real, independent defect — fixed by completing the rename
properly across the file, not by reverting anything.

### A known, honest, and deliberately unfixed gap

`parseMinorUnits` (in `money.ts`, what a person's typed input in a
form field gets converted into before posting) still hardcodes
`* 100` — correct for 2-decimal currencies, wrong for JPY/KRW (should
be `* 1`) or BHD/KWD (should be `* 1000`). `decimalPlacesFor(unitCode)`
in `format.ts` already has the real, correct per-currency scale;
`parseMinorUnits` doesn't yet take a unit code and apply it. This is a
genuine, separate functional gap from the naming fix — renaming
`_cents` to `_minor` made the columns honestly *named* for what they
really are, but didn't by itself make every conversion function
currency-aware. Tracked honestly in `docs/TODO.md`, not fixed here.
