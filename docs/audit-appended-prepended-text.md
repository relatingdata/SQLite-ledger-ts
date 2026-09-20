# Audit: appended/prepended text on names throughout the frontend

Per direct instruction: a complete audit of every place in the frontend where display
text glues extra content onto a real name, triggered by a real, confirmed bug found
in the POS Store dropdown (`"Main Street Cellar (Adelaide)"` — the appended city broke
label-based selection because the underlying `<option value>` was just the plain name).

Nothing below has been fixed. This is a record of findings only, for further
consideration.

## Confirmed functional bugs — `<option>` value ≠ displayed label

This is the exact class of bug that caused the real, confirmed hang: the option's
`value` is the plain name, but the displayed label has extra text glued onto it, so
anyone selecting "by label" (a person reading the screen, or a test) sees something
that doesn't match the real, underlying value.

**`{accountnumber} — {name}` prepended to account names in `<select>` dropdowns**, in
4 files (6 occurrences), all following the identical, broken pattern
`<option value={a.name}>{a.accountnumber} — {a.name}</option>`:

- `frontend/src/routes/post/+page.svelte`
- `frontend/src/routes/arap/ap-purchase/+page.svelte`
- `frontend/src/routes/stock/stock-dispatch/+page.svelte` (×2)
- `frontend/src/routes/stock/stock-receipt/+page.svelte` (×2)

**`(city)` appended to location names**, in `frontend/src/routes/pos/+page.svelte` —
the one already found and fixed in the tutorial e2e test script itself (matching on
`value` instead of `label` there), but the application code producing this display
text was not changed.

## Purely cosmetic/informational — a value shown next to a label, not a name being altered for identification

These don't create the value/label mismatch bug (they're not used as select options),
but they do append or prepend text to something, which the "no appending or
prepending anything anywhere" directive covers:

- Headings with contextual suffixes:
  - `"Weekly schedule — {location}"` — `frontend/src/routes/setup/business-setup/+page.svelte` (×2)
  - `"Sale complete — {reference}"` — `frontend/src/routes/pos/+page.svelte`
  - `"Trial Balance — {ledgerA} vs {ledgerB}"` and `"Profit and Loss — {ledgerA} vs {ledgerB}"` — `frontend/src/routes/reports/compare/+page.svelte`
  - `"Picking List — {warehouseName}"` — `frontend/src/routes/stock/restock/+page.svelte`
  - `"{location} — {date} <span>({status})</span>"` — `frontend/src/routes/stock/stock-take/+page.svelte`
- Amounts/dates shown with a label:
  - `"Paid: {reference}"`, `"Gross: {amount}"`, `"Medicare levy withheld: {amount}"`, `"Superannuation (employer cost): {amount}"` — `frontend/src/routes/hr/+page.svelte`
  - `"{amount} ({date})"` — `frontend/src/routes/reports/cash-flow-forecast/+page.svelte`
  - `"{item} (+{variance})"` — `frontend/src/routes/stock/stock-take/+page.svelte`
  - `"Closed: {reference}"`, `"Net Income: {amount}"`, `"Accounts zeroed: {count}"` — `frontend/src/routes/setup/yearend/+page.svelte`
  - `"Sale complete: {reference}"`, `"Total: {amount}"` — `frontend/src/routes/pos/+page.svelte`
  - `"{result.reference} — {amount}"` — `frontend/src/lib/components/CashTransaction.svelte`
- Item source pricing added this session: `"{price} ({currency})"` — `frontend/src/routes/items/+page.svelte`

## Open question, not resolved here

Whether the second group should be changed at all is a content/design decision, not a
bug fix — these headings and informational suffixes don't break anything functionally,
and removing them everywhere would be a much larger, more invasive change than fixing
the first group's dropdowns. The first group is a real, confirmed defect class worth
fixing the same way the POS one was worked around; the second group needs an explicit
decision on the intended design before any of it is touched.
