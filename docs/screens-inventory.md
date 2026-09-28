# Screens Inventory

Every real frontend route (`+page.svelte`), its source file, a real code/comment line split (blank lines excluded from both, per direct instruction), and whether it's genuinely implemented, a thin wrapper around a shared component, or still a `NotImplemented` stub. Generated directly from source by `scripts/generate-screens-inventory.ts` (`make screens-inventory`) — never hand-edited.

| Route | Source File | Code Lines | Comment Lines | Status |
|---|---|---|---|---|
| / | frontend/src/routes/+page.svelte | 27 | 0 | Implemented |
| /account/password | frontend/src/routes/account/password/+page.svelte | 89 | 0 | Implemented |
| /arap | frontend/src/routes/arap/+page.svelte | 47 | 0 | Implemented |
| /arap/ap-payment | frontend/src/routes/arap/ap-payment/+page.svelte | 4 | 0 | Thin wrapper (shared component) |
| /arap/ap-purchase | frontend/src/routes/arap/ap-purchase/+page.svelte | 280 | 6 | Implemented |
| /arap/ar-receipt | frontend/src/routes/arap/ar-receipt/+page.svelte | 4 | 0 | Thin wrapper (shared component) |
| /arap/ar-sale | frontend/src/routes/arap/ar-sale/+page.svelte | 301 | 9 | Implemented |
| /arap/cash-purchase | frontend/src/routes/arap/cash-purchase/+page.svelte | 4 | 0 | Thin wrapper (shared component) |
| /arap/cash-sale | frontend/src/routes/arap/cash-sale/+page.svelte | 4 | 0 | Thin wrapper (shared component) |
| /arap/quotations | frontend/src/routes/arap/quotations/+page.svelte | 7 | 0 | Not implemented |
| /arap/rfq | frontend/src/routes/arap/rfq/+page.svelte | 7 | 0 | Not implemented |
| /cash | frontend/src/routes/cash/+page.svelte | 7 | 0 | Not implemented |
| /contacts | frontend/src/routes/contacts/+page.svelte | 454 | 27 | Implemented |
| /customer-terminal | frontend/src/routes/customer-terminal/+page.svelte | 120 | 1 | Implemented |
| /editor | frontend/src/routes/editor/+page.svelte | 408 | 60 | Implemented |
| /exchange-rates | frontend/src/routes/exchange-rates/+page.svelte | 7 | 0 | Not implemented |
| /gl/fx-adjustment | frontend/src/routes/gl/fx-adjustment/+page.svelte | 7 | 0 | Not implemented |
| /goods-services | frontend/src/routes/goods-services/+page.svelte | 7 | 0 | Not implemented |
| /hr | frontend/src/routes/hr/+page.svelte | 317 | 0 | Implemented |
| /invoices | frontend/src/routes/invoices/+page.svelte | 652 | 4 | Implemented |
| /items | frontend/src/routes/items/+page.svelte | 658 | 46 | Implemented |
| /jobs | frontend/src/routes/jobs/+page.svelte | 7 | 0 | Not implemented |
| /journal | frontend/src/routes/journal/+page.svelte | 72 | 0 | Implemented |
| /journal/[id]/[date] | frontend/src/routes/journal/[id]/[date]/+page.svelte | 119 | 0 | Implemented |
| /locations | frontend/src/routes/locations/+page.svelte | 680 | 37 | Implemented |
| /login | frontend/src/routes/login/+page.svelte | 127 | 20 | Implemented |
| /logistics/assembly-bom | frontend/src/routes/logistics/assembly-bom/+page.svelte | 7 | 0 | Not implemented |
| /order-entry/generate-invoices | frontend/src/routes/order-entry/generate-invoices/+page.svelte | 7 | 0 | Not implemented |
| /order-entry/generate-po | frontend/src/routes/order-entry/generate-po/+page.svelte | 7 | 0 | Not implemented |
| /pos | frontend/src/routes/pos/+page.svelte | 515 | 21 | Implemented |
| /post | frontend/src/routes/post/+page.svelte | 427 | 28 | Implemented |
| /projects | frontend/src/routes/projects/+page.svelte | 151 | 0 | Implemented |
| /reconciliation | frontend/src/routes/reconciliation/+page.svelte | 7 | 0 | Not implemented |
| /recurring | frontend/src/routes/recurring/+page.svelte | 7 | 0 | Not implemented |
| /reports | frontend/src/routes/reports/+page.svelte | 55 | 0 | Implemented |
| /reports/aged | frontend/src/routes/reports/aged/+page.svelte | 160 | 0 | Implemented |
| /reports/balance-sheet | frontend/src/routes/reports/balance-sheet/+page.svelte | 279 | 36 | Implemented |
| /reports/below-reorder | frontend/src/routes/reports/below-reorder/+page.svelte | 77 | 0 | Implemented |
| /reports/business-configuration | frontend/src/routes/reports/business-configuration/+page.svelte | 128 | 0 | Implemented |
| /reports/cash-flow-forecast | frontend/src/routes/reports/cash-flow-forecast/+page.svelte | 214 | 0 | Implemented |
| /reports/compare | frontend/src/routes/reports/compare/+page.svelte | 195 | 11 | Implemented |
| /reports/new-new-pl | frontend/src/routes/reports/new-new-pl/+page.svelte | 228 | 38 | Implemented |
| /reports/new-pl | frontend/src/routes/reports/new-pl/+page.svelte | 258 | 9 | Implemented |
| /reports/new-stock-on-hand | frontend/src/routes/reports/new-stock-on-hand/+page.svelte | 238 | 0 | Implemented |
| /reports/old-pl | frontend/src/routes/reports/old-pl/+page.svelte | 215 | 14 | Implemented |
| /reports/pl-pivot | frontend/src/routes/reports/pl-pivot/+page.svelte | 307 | 17 | Implemented |
| /reports/profit-and-loss | frontend/src/routes/reports/profit-and-loss/+page.svelte | 228 | 38 | Implemented |
| /reports/reminders | frontend/src/routes/reports/reminders/+page.svelte | 145 | 0 | Implemented |
| /reports/sales | frontend/src/routes/reports/sales/+page.svelte | 188 | 3 | Implemented |
| /reports/statement | frontend/src/routes/reports/statement/+page.svelte | 207 | 9 | Implemented |
| /reports/stock-movement | frontend/src/routes/reports/stock-movement/+page.svelte | 250 | 6 | Implemented |
| /reports/stock-out-risk | frontend/src/routes/reports/stock-out-risk/+page.svelte | 77 | 0 | Implemented |
| /reports/trial-balance | frontend/src/routes/reports/trial-balance/+page.svelte | 147 | 1 | Implemented |
| /session | frontend/src/routes/session/+page.svelte | 181 | 7 | Implemented |
| /setup | frontend/src/routes/setup/+page.svelte | 129 | 1 | Implemented |
| /setup/bank-accounts | frontend/src/routes/setup/bank-accounts/+page.svelte | 224 | 0 | Implemented |
| /setup/business-setup | frontend/src/routes/setup/business-setup/+page.svelte | 644 | 26 | Implemented |
| /setup/chart-of-accounts | frontend/src/routes/setup/chart-of-accounts/+page.svelte | 269 | 9 | Implemented |
| /setup/currencies | frontend/src/routes/setup/currencies/+page.svelte | 7 | 0 | Not implemented |
| /setup/hierarchy | frontend/src/routes/setup/hierarchy/+page.svelte | 261 | 4 | Implemented |
| /setup/new-business | frontend/src/routes/setup/new-business/+page.svelte | 429 | 42 | Implemented |
| /setup/periods | frontend/src/routes/setup/periods/+page.svelte | 152 | 0 | Implemented |
| /setup/taxes | frontend/src/routes/setup/taxes/+page.svelte | 7 | 0 | Not implemented |
| /setup/translations | frontend/src/routes/setup/translations/+page.svelte | 242 | 9 | Implemented |
| /setup/tree | frontend/src/routes/setup/tree/+page.svelte | 87 | 0 | Implemented |
| /setup/users | frontend/src/routes/setup/users/+page.svelte | 164 | 0 | Implemented |
| /setup/vocabulary | frontend/src/routes/setup/vocabulary/+page.svelte | 130 | 24 | Implemented |
| /setup/yearend | frontend/src/routes/setup/yearend/+page.svelte | 287 | 0 | Implemented |
| /shipping | frontend/src/routes/shipping/+page.svelte | 7 | 0 | Not implemented |
| /stock | frontend/src/routes/stock/+page.svelte | 47 | 0 | Implemented |
| /stock/listing | frontend/src/routes/stock/listing/+page.svelte | 240 | 8 | Implemented |
| /stock/po | frontend/src/routes/stock/po/+page.svelte | 229 | 18 | Implemented |
| /stock/restock | frontend/src/routes/stock/restock/+page.svelte | 285 | 13 | Implemented |
| /stock/so | frontend/src/routes/stock/so/+page.svelte | 168 | 0 | Implemented |
| /stock/stock-dispatch | frontend/src/routes/stock/stock-dispatch/+page.svelte | 251 | 1 | Implemented |
| /stock/stock-receipt | frontend/src/routes/stock/stock-receipt/+page.svelte | 238 | 1 | Implemented |
| /stock/stock-take | frontend/src/routes/stock/stock-take/+page.svelte | 215 | 2 | Implemented |
| /stock/transfer | frontend/src/routes/stock/transfer/+page.svelte | 107 | 4 | Implemented |
| /stock/write-offs | frontend/src/routes/stock/write-offs/+page.svelte | 288 | 2 | Implemented |
| /vouchers/general-ledger | frontend/src/routes/vouchers/general-ledger/+page.svelte | 7 | 0 | Not implemented |
| /vouchers/payable | frontend/src/routes/vouchers/payable/+page.svelte | 7 | 0 | Not implemented |
| /vouchers/payment | frontend/src/routes/vouchers/payment/+page.svelte | 7 | 0 | Not implemented |

**82 screens total** — 60 implemented, 4 thin wrapper (shared component), 18 not yet implemented. 14449 total code lines, 612 total comment lines across all screens (blank lines excluded from both).
