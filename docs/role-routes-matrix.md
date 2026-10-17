# Role × Route Matrix

Every real backend route guarded by `requireRole(...)`/`requireGlobalRole(...)`, grouped by the real role(s) that may call it — read directly from source, never hand-maintained. This is the real, enforced half of "screens v roles": a "screens v roles" matrix does not exist anywhere in this project (no screens.csv column, no doc table, no code) and is not a small, honest thing to fabricate here — one real screen often calls several, independently role-gated routes, and most report screens call none at all. "Roles v users" already exists, fully built: a real, per-business User × Role Cartesian Product (see `docs/user-business-role-matrix-design.md`), edited through a real checkbox grid on the Users screen. Generated directly from source by `scripts/generate-role-routes-matrix.ts` (`make role-routes-matrix`) — never hand-edited.

## Administrator

| Method | Route | Source File | Also requires |
|---|---|---|---|
| POST | / | backend/src/routes/businesses.ts | — |
| GET | / | backend/src/routes/entities.ts | Bookkeeper |
| POST | / | backend/src/routes/entities.ts | Bookkeeper |
| POST | / | backend/src/routes/invoices.ts | Bookkeeper |
| POST | / | backend/src/routes/locations.ts | Bookkeeper |
| GET | / | backend/src/routes/products.ts | Bookkeeper |
| POST | /:counterparty/reset | backend/src/routes/invoices.ts | Bookkeeper |
| POST | /:counterparty/send | backend/src/routes/invoices.ts | Bookkeeper |
| PATCH | /:id | backend/src/routes/entities.ts | Bookkeeper |
| DELETE | /:id | backend/src/routes/entities.ts | — |
| POST | /:id/:date/reverse | backend/src/routes/journal.ts | Bookkeeper |
| POST | /:id/allocate | backend/src/routes/invoices.ts | Bookkeeper |
| POST | /:id/complete | backend/src/routes/locations.ts | Bookkeeper |
| POST | /:id/confirm-picked | backend/src/routes/invoices.ts | Bookkeeper |
| POST | /:id/count | backend/src/routes/locations.ts | Bookkeeper |
| POST | /:id/dispatch-order | backend/src/routes/invoices.ts | Bookkeeper |
| POST | /:id/post | backend/src/routes/invoices.ts | Bookkeeper |
| PUT | /:name | backend/src/routes/contacts.ts | Bookkeeper |
| PUT | /:name | backend/src/routes/items.ts | Bookkeeper |
| POST | /:name | backend/src/routes/locations.ts | Bookkeeper |
| PUT | /:name | backend/src/routes/locations.ts | Bookkeeper |
| PUT | /:name/addresses | backend/src/routes/contacts.ts | Bookkeeper |
| DELETE | /:name/addresses/:addressType | backend/src/routes/contacts.ts | Bookkeeper |
| POST | /:name/bank-accounts | backend/src/routes/businesses.ts | — |
| GET | /:name/bank-accounts | backend/src/routes/businesses.ts | — |
| POST | /:name/bank-currency-structure | backend/src/routes/businesses.ts | — |
| PUT | /:name/bom | backend/src/routes/items.ts | Bookkeeper |
| DELETE | /:name/bom/:componentItem | backend/src/routes/items.ts | Bookkeeper |
| POST | /:name/business-type-answers | backend/src/routes/businesses.ts | — |
| GET | /:name/configuration-report | backend/src/routes/businesses.ts | Bookkeeper |
| PUT | /:name/contact-persons | backend/src/routes/contacts.ts | Bookkeeper |
| DELETE | /:name/contact-persons/:contactType | backend/src/routes/contacts.ts | Bookkeeper |
| POST | /:name/currencies | backend/src/routes/locations.ts | Bookkeeper |
| POST | /:name/dispatch | backend/src/routes/locations.ts | Bookkeeper |
| PUT | /:name/items/:itemName | backend/src/routes/locations.ts | Bookkeeper |
| PUT | /:name/open-hours | backend/src/routes/locations.ts | Bookkeeper |
| PUT | /:name/phones | backend/src/routes/contacts.ts | Bookkeeper |
| DELETE | /:name/phones/:phoneType | backend/src/routes/contacts.ts | Bookkeeper |
| POST | /:name/profit-centers | backend/src/routes/businesses.ts | Bookkeeper |
| POST | /:name/receive | backend/src/routes/locations.ts | Bookkeeper |
| POST | /:name/receive-stock | backend/src/routes/locations.ts | Bookkeeper |
| POST | /:name/sources | backend/src/routes/items.ts | Bookkeeper |
| PUT | /:name/storage-origin | backend/src/routes/items.ts | Bookkeeper |
| PUT | /bank-accounts/:accountName | backend/src/routes/reports.ts | Bookkeeper |
| DELETE | /bank-accounts/:accountName | backend/src/routes/reports.ts | Bookkeeper |
| GET | /businesses/:business/role-matrix | backend/src/routes/auth.ts | — |
| PUT | /businesses/:business/role-matrix/:user/:role | backend/src/routes/auth.ts | — |
| DELETE | /businesses/:business/role-matrix/:user/:role | backend/src/routes/auth.ts | — |
| POST | /close | backend/src/routes/period.ts | — |
| POST | /close-books | backend/src/routes/journal.ts | Bookkeeper |
| POST | /complete-cash-purchase | backend/src/routes/pos.ts | Bookkeeper |
| POST | /complete-sale | backend/src/routes/pos.ts | Bookkeeper |
| POST | /convert-storage | backend/src/routes/locations.ts | Bookkeeper |
| POST | /create-ledger | backend/src/routes/journal.ts | Bookkeeper |
| GET | /default-language | backend/src/routes/i18n.ts | — |
| POST | /dispatch-stock | backend/src/routes/pos.ts | Bookkeeper |
| PUT | /employees/:employeeName/schedule | backend/src/routes/locations.ts | Bookkeeper |
| POST | /groupings | backend/src/routes/hierarchy.ts | Bookkeeper |
| POST | /import-e-invoice | backend/src/routes/invoices.ts | Bookkeeper |
| PUT | /item-assignment | backend/src/routes/products.ts | Bookkeeper |
| PUT | /language-direction/:language | backend/src/routes/i18n.ts | — |
| POST | /lead-time | backend/src/routes/locations.ts | Bookkeeper |
| PUT | /line-type | backend/src/routes/entities.ts | Bookkeeper |
| POST | /lots | backend/src/routes/stock-lots.ts | Bookkeeper |
| POST | /lots/consume | backend/src/routes/stock-lots.ts | Bookkeeper |
| POST | /open-container | backend/src/routes/locations.ts | Bookkeeper |
| GET | /org-chart/:businessName | backend/src/routes/pos.ts | Bookkeeper |
| POST | /override | backend/src/routes/menu.ts | Bookkeeper |
| DELETE | /override | backend/src/routes/menu.ts | Bookkeeper |
| POST | /parent | backend/src/routes/hierarchy.ts | Bookkeeper |
| DELETE | /parent | backend/src/routes/hierarchy.ts | Bookkeeper |
| POST | /pay-wages | backend/src/routes/pos.ts | Bookkeeper |
| GET | /pending | backend/src/routes/customer-registration.ts | Bookkeeper |
| POST | /post | backend/src/routes/journal.ts | Bookkeeper |
| POST | /preview-close-books | backend/src/routes/journal.ts | Bookkeeper |
| POST | /receive-stock | backend/src/routes/pos.ts | Bookkeeper |
| POST | /recurring | backend/src/routes/journal.ts | Bookkeeper |
| POST | /relationship | backend/src/routes/entities.ts | Bookkeeper |
| POST | /reopen | backend/src/routes/period.ts | — |
| POST | /reorder | backend/src/routes/entities.ts | Bookkeeper |
| POST | /resolve-cash-transaction-accounts | backend/src/routes/pos.ts | Bookkeeper |
| POST | /resolve-open-container-accounts | backend/src/routes/locations.ts | Bookkeeper |
| POST | /resolve-receive-accounts | backend/src/routes/locations.ts | Bookkeeper |
| POST | /resolve-rollover-lines | backend/src/routes/journal.ts | Bookkeeper |
| POST | /resolve-sale-accounts | backend/src/routes/pos.ts | Bookkeeper |
| POST | /resolve-transfer-accounts | backend/src/routes/locations.ts | Bookkeeper |
| POST | /restock/:runReference/confirm-picked | backend/src/routes/locations.ts | Bookkeeper |
| POST | /restock/:runReference/dispatch | backend/src/routes/locations.ts | Bookkeeper |
| POST | /rollover-to-new-period | backend/src/routes/journal.ts | Bookkeeper |
| POST | /shapes | backend/src/routes/hierarchy.ts | Bookkeeper |
| DELETE | /sources/:id | backend/src/routes/items.ts | Bookkeeper |
| POST | /staging | backend/src/routes/journal.ts | Bookkeeper |
| DELETE | /staging/:reference/:business/:ledger/:account | backend/src/routes/journal.ts | Bookkeeper |
| POST | /terminals/:locationName | backend/src/routes/pos.ts | Bookkeeper |
| POST | /transfer | backend/src/routes/locations.ts | Bookkeeper |
| POST | /transfer-stock | backend/src/routes/locations.ts | Bookkeeper |
| GET | /types | backend/src/routes/locations.ts | Bookkeeper |
| GET | /users | backend/src/routes/auth.ts | — |
| PUT | /users/:id/active | backend/src/routes/auth.ts | — |
| PUT | /users/:id/password | backend/src/routes/auth.ts | — |
| PUT | /users/:id/roles | backend/src/routes/auth.ts | — |
| POST | /values | backend/src/routes/hierarchy.ts | Bookkeeper |
| POST | /write-off | backend/src/routes/stock-lots.ts | Bookkeeper |

## Bookkeeper

| Method | Route | Source File | Also requires |
|---|---|---|---|
| GET | / | backend/src/routes/entities.ts | Administrator |
| POST | / | backend/src/routes/entities.ts | Administrator |
| POST | / | backend/src/routes/invoices.ts | Administrator |
| POST | / | backend/src/routes/locations.ts | Administrator |
| GET | / | backend/src/routes/products.ts | Administrator |
| POST | /:counterparty/reset | backend/src/routes/invoices.ts | Administrator |
| POST | /:counterparty/send | backend/src/routes/invoices.ts | Administrator |
| PATCH | /:id | backend/src/routes/entities.ts | Administrator |
| POST | /:id/:date/reverse | backend/src/routes/journal.ts | Administrator |
| POST | /:id/allocate | backend/src/routes/invoices.ts | Administrator |
| POST | /:id/complete | backend/src/routes/locations.ts | Administrator |
| POST | /:id/confirm-picked | backend/src/routes/invoices.ts | Administrator |
| POST | /:id/count | backend/src/routes/locations.ts | Administrator |
| POST | /:id/dispatch-order | backend/src/routes/invoices.ts | Administrator |
| POST | /:id/post | backend/src/routes/invoices.ts | Administrator |
| PUT | /:name | backend/src/routes/contacts.ts | Administrator |
| PUT | /:name | backend/src/routes/items.ts | Administrator |
| POST | /:name | backend/src/routes/locations.ts | Administrator |
| PUT | /:name | backend/src/routes/locations.ts | Administrator |
| PUT | /:name/addresses | backend/src/routes/contacts.ts | Administrator |
| DELETE | /:name/addresses/:addressType | backend/src/routes/contacts.ts | Administrator |
| PUT | /:name/bom | backend/src/routes/items.ts | Administrator |
| DELETE | /:name/bom/:componentItem | backend/src/routes/items.ts | Administrator |
| GET | /:name/configuration-report | backend/src/routes/businesses.ts | Administrator |
| PUT | /:name/contact-persons | backend/src/routes/contacts.ts | Administrator |
| DELETE | /:name/contact-persons/:contactType | backend/src/routes/contacts.ts | Administrator |
| POST | /:name/currencies | backend/src/routes/locations.ts | Administrator |
| POST | /:name/dispatch | backend/src/routes/locations.ts | Administrator |
| PUT | /:name/items/:itemName | backend/src/routes/locations.ts | Administrator |
| PUT | /:name/open-hours | backend/src/routes/locations.ts | Administrator |
| PUT | /:name/phones | backend/src/routes/contacts.ts | Administrator |
| DELETE | /:name/phones/:phoneType | backend/src/routes/contacts.ts | Administrator |
| POST | /:name/profit-centers | backend/src/routes/businesses.ts | Administrator |
| POST | /:name/receive | backend/src/routes/locations.ts | Administrator |
| POST | /:name/receive-stock | backend/src/routes/locations.ts | Administrator |
| POST | /:name/sources | backend/src/routes/items.ts | Administrator |
| PUT | /:name/storage-origin | backend/src/routes/items.ts | Administrator |
| PUT | /bank-accounts/:accountName | backend/src/routes/reports.ts | Administrator |
| DELETE | /bank-accounts/:accountName | backend/src/routes/reports.ts | Administrator |
| POST | /close-books | backend/src/routes/journal.ts | Administrator |
| POST | /complete-cash-purchase | backend/src/routes/pos.ts | Administrator |
| POST | /complete-sale | backend/src/routes/pos.ts | Administrator |
| POST | /convert-storage | backend/src/routes/locations.ts | Administrator |
| POST | /create-ledger | backend/src/routes/journal.ts | Administrator |
| POST | /dispatch-stock | backend/src/routes/pos.ts | Administrator |
| PUT | /employees/:employeeName/schedule | backend/src/routes/locations.ts | Administrator |
| POST | /groupings | backend/src/routes/hierarchy.ts | Administrator |
| POST | /import-e-invoice | backend/src/routes/invoices.ts | Administrator |
| PUT | /item-assignment | backend/src/routes/products.ts | Administrator |
| POST | /lead-time | backend/src/routes/locations.ts | Administrator |
| PUT | /line-type | backend/src/routes/entities.ts | Administrator |
| POST | /lots | backend/src/routes/stock-lots.ts | Administrator |
| POST | /lots/consume | backend/src/routes/stock-lots.ts | Administrator |
| POST | /open-container | backend/src/routes/locations.ts | Administrator |
| GET | /org-chart/:businessName | backend/src/routes/pos.ts | Administrator |
| POST | /override | backend/src/routes/menu.ts | Administrator |
| DELETE | /override | backend/src/routes/menu.ts | Administrator |
| POST | /parent | backend/src/routes/hierarchy.ts | Administrator |
| DELETE | /parent | backend/src/routes/hierarchy.ts | Administrator |
| POST | /pay-wages | backend/src/routes/pos.ts | Administrator |
| GET | /pending | backend/src/routes/customer-registration.ts | Administrator |
| POST | /post | backend/src/routes/journal.ts | Administrator |
| POST | /preview-close-books | backend/src/routes/journal.ts | Administrator |
| POST | /receive-stock | backend/src/routes/pos.ts | Administrator |
| POST | /recurring | backend/src/routes/journal.ts | Administrator |
| POST | /relationship | backend/src/routes/entities.ts | Administrator |
| POST | /reorder | backend/src/routes/entities.ts | Administrator |
| POST | /resolve-cash-transaction-accounts | backend/src/routes/pos.ts | Administrator |
| POST | /resolve-open-container-accounts | backend/src/routes/locations.ts | Administrator |
| POST | /resolve-receive-accounts | backend/src/routes/locations.ts | Administrator |
| POST | /resolve-rollover-lines | backend/src/routes/journal.ts | Administrator |
| POST | /resolve-sale-accounts | backend/src/routes/pos.ts | Administrator |
| POST | /resolve-transfer-accounts | backend/src/routes/locations.ts | Administrator |
| POST | /restock/:runReference/confirm-picked | backend/src/routes/locations.ts | Administrator |
| POST | /restock/:runReference/dispatch | backend/src/routes/locations.ts | Administrator |
| POST | /rollover-to-new-period | backend/src/routes/journal.ts | Administrator |
| POST | /shapes | backend/src/routes/hierarchy.ts | Administrator |
| DELETE | /sources/:id | backend/src/routes/items.ts | Administrator |
| POST | /staging | backend/src/routes/journal.ts | Administrator |
| DELETE | /staging/:reference/:business/:ledger/:account | backend/src/routes/journal.ts | Administrator |
| POST | /terminals/:locationName | backend/src/routes/pos.ts | Administrator |
| POST | /transfer | backend/src/routes/locations.ts | Administrator |
| POST | /transfer-stock | backend/src/routes/locations.ts | Administrator |
| GET | /types | backend/src/routes/locations.ts | Administrator |
| POST | /values | backend/src/routes/hierarchy.ts | Administrator |
| POST | /write-off | backend/src/routes/stock-lots.ts | Administrator |

## Every real route with no role guard at all (open to any authenticated — or, for a route with no `requireAuth` either, any — caller)

| Method | Route | Source File |
|---|---|---|
| GET | / | backend/src/routes/businesses.ts |
| GET | / | backend/src/routes/hierarchy.ts |
| GET | / | backend/src/routes/invoices.ts |
| GET | / | backend/src/routes/invoices.ts |
| GET | / | backend/src/routes/invoices.ts |
| GET | / | backend/src/routes/invoices.ts |
| GET | / | backend/src/routes/invoices.ts |
| GET | / | backend/src/routes/items.ts |
| GET | / | backend/src/routes/journal.ts |
| GET | / | backend/src/routes/locations.ts |
| GET | / | backend/src/routes/locations.ts |
| GET | / | backend/src/routes/locations.ts |
| GET | / | backend/src/routes/menu.ts |
| GET | / | backend/src/routes/recording.ts |
| GET | /:id | backend/src/routes/entities.ts |
| GET | /:id | backend/src/routes/invoices.ts |
| GET | /:id | backend/src/routes/locations.ts |
| GET | /:id/:date | backend/src/routes/journal.ts |
| GET | /:id/e-invoice | backend/src/routes/invoices.ts |
| GET | /:id/hierarchy-links | backend/src/routes/entities.ts |
| GET | /:id/history | backend/src/routes/entities.ts |
| GET | /:id/outstanding | backend/src/routes/invoices.ts |
| GET | /:id/picking-list | backend/src/routes/invoices.ts |
| GET | /:name | backend/src/routes/items.ts |
| GET | /:name | backend/src/routes/locations.ts |
| GET | /:name/active-ledger | backend/src/routes/businesses.ts |
| GET | /:name/addresses | backend/src/routes/contacts.ts |
| GET | /:name/bom | backend/src/routes/items.ts |
| GET | /:name/contact-persons | backend/src/routes/contacts.ts |
| GET | /:name/credit-status | backend/src/routes/contacts.ts |
| GET | /:name/currencies | backend/src/routes/locations.ts |
| GET | /:name/items/:itemName | backend/src/routes/locations.ts |
| GET | /:name/open-hours | backend/src/routes/locations.ts |
| GET | /:name/phones | backend/src/routes/contacts.ts |
| GET | /:name/profit-centers | backend/src/routes/businesses.ts |
| GET | /:name/schedule | backend/src/routes/locations.ts |
| GET | /:name/sources | backend/src/routes/items.ts |
| GET | /:name/storage-origin | backend/src/routes/items.ts |
| POST | /ap-payment/post | backend/src/routes/arap.ts |
| POST | /ap-payment/stage | backend/src/routes/arap.ts |
| POST | /ar-receipt/post | backend/src/routes/arap.ts |
| POST | /ar-receipt/stage | backend/src/routes/arap.ts |
| GET | /axis-values | backend/src/routes/matrix-reports.ts |
| GET | /balance-sheet | backend/src/routes/reports.ts |
| GET | /bank-accounts | backend/src/routes/reports.ts |
| GET | /business-reports | backend/src/routes/reports.ts |
| GET | /by-location | backend/src/routes/locations.ts |
| GET | /cash-flow-forecast | backend/src/routes/reports.ts |
| GET | /cash-position | backend/src/routes/reports.ts |
| GET | /chart-of-accounts | backend/src/routes/reports.ts |
| POST | /clock-in | backend/src/routes/projects.ts |
| POST | /clock-out | backend/src/routes/projects.ts |
| GET | /coa-prototype/:language | backend/src/routes/businesses.ts |
| GET | /concepts-with-alternates | backend/src/routes/i18n.ts |
| GET | /contact-person-types | backend/src/routes/contacts.ts |
| GET | /drill-down | backend/src/routes/reports.ts |
| GET | /employees/:employeeName/schedule | backend/src/routes/locations.ts |
| GET | /groups | backend/src/routes/hierarchy.ts |
| GET | /languages | backend/src/routes/i18n.ts |
| GET | /ledger-date-range | backend/src/routes/reports.ts |
| POST | /login | backend/src/routes/auth.ts |
| POST | /login | backend/src/routes/customer-registration.ts |
| POST | /logout | backend/src/routes/auth.ts |
| GET | /lookup/:upc | backend/src/routes/pos.ts |
| GET | /lots/expiring | backend/src/routes/stock-lots.ts |
| GET | /me | backend/src/routes/auth.ts |
| PUT | /me/date-format | backend/src/routes/auth.ts |
| PUT | /me/number-format | backend/src/routes/auth.ts |
| PUT | /me/page-size | backend/src/routes/auth.ts |
| PUT | /me/password | backend/src/routes/auth.ts |
| GET | /open-clock | backend/src/routes/projects.ts |
| GET | /parent | backend/src/routes/hierarchy.ts |
| POST | /pdf | backend/src/routes/invoice.ts |
| POST | /po/post | backend/src/routes/stock.ts |
| POST | /po/stage | backend/src/routes/stock.ts |
| GET | /profit-and-loss | backend/src/routes/reports.ts |
| GET | /profit-and-loss-by-axis | backend/src/routes/matrix-reports.ts |
| GET | /profit-and-loss-by-hierarchy | backend/src/routes/reports.ts |
| GET | /profit-and-loss-by-hierarchy-tree | backend/src/routes/reports.ts |
| GET | /profit-and-loss-comparison | backend/src/routes/reports.ts |
| POST | /register | backend/src/routes/customer-registration.ts |
| POST | /restock/:runReference/picking-list | backend/src/routes/locations.ts |
| GET | /sales | backend/src/routes/reports.ts |
| GET | /sales-cogs-matrix | backend/src/routes/matrix-reports.ts |
| POST | /session/business | backend/src/routes/auth.ts |
| POST | /session/profit-center | backend/src/routes/auth.ts |
| GET | /shapes | backend/src/routes/hierarchy.ts |
| POST | /so/post | backend/src/routes/stock.ts |
| GET | /staging/:reference/:business/:ledger | backend/src/routes/journal.ts |
| POST | /start | backend/src/routes/recording.ts |
| GET | /status | backend/src/routes/period.ts |
| GET | /stock-on-hand-matrix | backend/src/routes/matrix-reports.ts |
| POST | /stock-receipt/post | backend/src/routes/stock.ts |
| POST | /stock-receipt/stage | backend/src/routes/stock.ts |
| POST | /stop | backend/src/routes/recording.ts |
| GET | /storage-space | backend/src/routes/locations.ts |
| GET | /summary | backend/src/routes/invoices.ts |
| GET | /terminals/:locationName | backend/src/routes/pos.ts |
| GET | /text/:language | backend/src/routes/i18n.ts |
| POST | /translations | backend/src/routes/i18n.ts |
| GET | /trial-balance | backend/src/routes/reports.ts |
| GET | /trial-balance-comparison | backend/src/routes/reports.ts |
| GET | /vocabulary-alternates/:word | backend/src/routes/i18n.ts |
| DELETE | /vocabulary-preference | backend/src/routes/i18n.ts |

**103 real, role-guarded route(s)** across 2 real role(s); **104 route(s)** with no role guard.
