# User Manual — a plan, before any more writing happens

Two real, existing documents already exist and shouldn't be thrown away or duplicated:

- **`docs/user-manual.md`** — a real, narrative-style opening (Lars and Mette, Wine Retail Business's own story), 27 lines, explicitly marked "(Continued in later sections...)". Good, real prose; genuinely incomplete.
- **`USER_GUIDE.md`** — a real, technical, step-by-step walkthrough, 176 lines, 8 sections, covering first run, business/ledger setup, posting, and budget comparison. No screenshots. Covers only the earliest, most basic workflows — nothing on payroll, POS, invoicing, stock, or anything built since.

Neither is wrong; both are real starts. The plan below is for finishing the job properly — one real, complete manual, narrative where `user-manual.md` already leads, technical and screenshot-illustrated everywhere `USER_GUIDE.md` was heading.

## Real scope, counted directly

67 real, distinct frontend routes exist today (confirmed via a direct listing, not estimated). Grouped into the real chapters below — not the menu's own grouping, which is organized by app section, not by the order a real business actually needs things.

## Proposed chapter structure

**Part 1 — Starting out** *(narrative, from `user-manual.md`, extended)*
Continue Lars and Mette's story through their actual first real actions: `/setup/new-business`, choosing a Chart of Accounts prototype, `/setup/divisions`, `/locations`. Screenshot each real screen at the point the story reaches it, not before.

**Part 2 — Setting up the business itself**
`/setup/business-setup` (the real, unified screen — the natural anchor for this whole chapter), `/setup/chart-of-accounts`, `/setup/tree`, `/editor` (Structured Editor), `/setup/bank-accounts`, `/setup/currencies`, `/setup/taxes`, `/setup/periods`, `/setup/users`.

**Part 3 — People: contacts, employees, HR**
`/contacts`, `/hr` (Pay Wages + Org Chart tabs), employee scheduling and open hours (part of `/setup/business-setup`, cross-referenced from here rather than re-explained).

**Part 4 — Buying and selling, day to day**
`/arap/cash-sale`, `/arap/cash-purchase`, `/arap/ar-sale`, `/arap/ap-purchase`, `/arap/ar-receipt`, `/arap/ap-payment`, `/arap/quotations`, `/arap/rfq`, `/invoices`, `/pos` (POS Terminal), `/customer-terminal`.

**Part 5 — Items, stock, and locations**
`/goods-services`, `/parts` (Parts Catalog), `/stock/listing`, `/stock/po`, `/stock/so`, `/stock/stock-receipt`, `/stock/stock-dispatch`, `/stock/transfer`, `/stock/restock`, `/stock/stock-take`, `/stock/write-offs`, `/logistics/assembly-bom`, `/order-entry/generate-po`, `/order-entry/generate-invoices`.

**Part 6 — The General Journal and other core postings**
`/post`, `/journal`, `/journal/[id]/[date]`, `/vouchers/general-ledger`, `/vouchers/payable`, `/vouchers/payment`, `/gl/fx-adjustment`, `/recurring`, `/reconciliation`.

**Part 7 — Reports**
`/reports`, `/reports/trial-balance`, `/reports/balance-sheet`, `/reports/profit-and-loss`, `/reports/sales`, `/reports/aged`, `/reports/compare`, `/reports/reminders`, `/reports/below-reorder`, `/reports/stock-movement`.

**Part 8 — Year end**
`/setup/yearend` — the real preview/accept-reject flow, screenshotted step by step (this is a real, natural chapter climax: everything from Parts 1–7 feeding into one, real, closed period).

**Part 9 — Projects, jobs, shipping**
`/projects`, `/jobs`, `/shipping`.

**Part 10 — Account and session basics**
`/login`, `/session`, `/account/password` — kept short and last, since these are real but not narratively interesting.

Not included as their own chapter, cross-referenced instead where relevant: `/exchange-rates` (Part 2), `/setup` itself (just the index page).

## How screenshots actually get captured

This project already has a real, working `make demo-full-year` dataset and a full Playwright suite. The practical path: a real, dedicated Playwright script (not a test — no assertions, just navigation + `page.screenshot()`) that walks every real route above against the real, populated Wine Retail Business data, saving each screenshot to a real, predictable path (`docs/screenshots/{chapter}/{route-slug}.png`). This reuses proven infrastructure rather than manual, one-off capture — the same real pattern already used throughout this session for verifying UI work live.

## Real, honest scope note

67 real screens, several needing multiple screenshots (a before/after for POS sign-on once built, the year-end close's three real states — empty, previewed, closed). This is genuinely a multi-session undertaking, not a single response's worth of work. Proposed order of attack: Parts 1–2 first (they anchor the whole narrative and are what a brand-new reader sees first), then Part 8 (year-end close, already fully built and proven this session, low-risk to screenshot now), then the rest in the order above.

## Explicitly deferred, not forgotten

POS Terminal (`/pos`) screenshots wait until the real clerk sign-on screen is actually built — screenshotting the current, pre-sign-on version would need redoing almost immediately.
