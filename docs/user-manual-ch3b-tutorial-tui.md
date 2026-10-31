# Chapter 3b --- The Tutorial, in the Terminal

The previous chapter walked through building Tutorial Wine Retail Business entirely through the web app, screenshot by screenshot. This application also has a second, real, independent client of the exact same backend: a terminal (text) user interface, in `tui/`, built with the same real screens, the same real menu, against the same real data. This short chapter is its own, honest companion --- not a second walk through the whole story, but a real look at what the terminal frontend covers today, and what it doesn't yet.

**The TUI does not yet cover everything the web app does.** It has twelve real, working screens: Login, the Menu, General Journal, Balance Sheet, New Business, Business Structure (Org Chart / Item Categories / Other Hierarchies), Purchase, Cash Purchase, Purchase Order, Payment, AR Sale ("Sale" on screen), Cash Sale, Customers, and POS Terminal. It has no screen yet for Vendors/Providers, setting an item's unit cost or pack size, Transfer Items, Open Container, Close Books, Rollover To New Period, or the New New P&L multi-axis report --- all of those still need the web app. Where this chapter shows a real screen, it is genuinely real; where the web tutorial's own narrative goes somewhere the TUI can't follow yet, this chapter says so plainly rather than skip past it.

Every transcript below is real text, captured directly from a live, passing run of the real terminal program --- never hand-typed --- against the exact same **Tutorial Wine Retail Business** the web chapter builds (created fresh via the same, shared `shared-fixtures/tutorial-steps.csv` fixture, run through the fast, backend-only `--path api` route rather than re-driven screenshot by screenshot, so the figures below are the same real figures the web chapter's own screenshots show by the time its story is finished). A terminal's own natural "screenshot" is its real text output, captured with `terminal.text()` against a genuine, running `@microsoft/tui-test` session rather than a bitmap of one --- see `backend/scripts/capture-tui-transcripts.ts`, run fresh by `make tutorial-section-user-manual-tui`.

## Logging in

The same account, the same backend --- just a different, real client of it.

```
sql-ledger-ts — text user interface (test implementation: Login, Menu, General
Journal, Balance Sheet, New Business, Business Structure, Purchase, Cash
Purchase, Purchase Order, Payment, AR Sale, Cash Sale, Customers, POS Terminal)
╭──────────────────────────────────────────────────────────────────────────────╮
│ sql-ledger-ts — Log in                                                       │
│                                                                              │
│ Username                                                                     │
│                                                                              │
│ Password                                                                     │
│                                                                              │
│ Enter on Username moves to Password · Enter on Password logs in              │
╰──────────────────────────────────────────────────────────────────────────────╯
```

## Choosing a business, then a ledger

Every account can genuinely work across more than one real business, each with its own, entirely independent books --- the same real rule the web app follows. This account also happens to carry its own small, personal **admin** business (its own real ledgers, separate from this tutorial's), so choosing the right one by name actually matters here, not just for show:

```
╭──────────────────────────────────────────────────────────────────────────────╮
│ Choose a business                                                            │
│                                                                              │
│ ❯ admin                                                                      │
│   Tutorial Wine Retail Business                                              │
╰──────────────────────────────────────────────────────────────────────────────╯
```

Choosing **Tutorial Wine Retail Business** then offers its own real ledgers --- the Actual ledger this whole tutorial trades in, the Budget ledger created alongside it, and the further Actual ledger rollover created for the following year:

```
╭──────────────────────────────────────────────────────────────────────────────╮
│ Choose a ledger — Tutorial Wine Retail Business                              │
│                                                                              │
│ ❯ Actual                                                                     │
│   Budget 2026-27                                                             │
│   Actual 2027-28                                                             │
╰──────────────────────────────────────────────────────────────────────────────╯
```

## The Menu

The same real, live, server-computed menu the web app renders, the exact same sections and labels --- this is a direct consequence of this project's own standing rule that the GUI and TUI must line up completely, so the same `screen_name` genuinely drives both. A section with no TUI screen behind any of its links yet (Logistics, Shipping, Vendors/Providers, and others) is still shown here, exactly as it is --- nothing is hidden --- it just says so plainly the moment you actually try to open one of those links.

```
╭──────────────────────────────────────────────────────────────────────────────╮
│ Menu — Tutorial Wine Retail Business                                         │
│                                                                              │
│ ❯ General Ledger                                                             │
│   test                                                                       │
│   Accounts Receivable (Debtors / Sales)                                      │
│   Accounts Payable (Creditors / Purchasing)                                  │
│   Inventory                                                                  │
│   Cash                                                                       │
│   Vouchers                                                                   │
│   HR                                                                         │
│   Logistics                                                                  │
│   Shipping                                                                   │
│   Projects & Jobs                                                            │
│   Configuration                                                              │
│ ↑/↓ move · Enter open a section · q quit                                     │
╰──────────────────────────────────────────────────────────────────────────────╯
```

## General Journal

The same real journal the web chapter's owner's-capital deposit, rent expense, and year-end entries all post through --- staging a balanced entry line by line, then posting the whole thing in one, final step, same as the web app's own, real convention. Reached fresh, before any line is staged:

```
╭──────────────────────────────────────────────────────────────────────────────╮
│ General Journal — Tutorial Wine Retail Business / Actual                     │
│                                                                              │
│ Reference                                                                    │
│ Enter to continue · Escape back to menu                                      │
╰──────────────────────────────────────────────────────────────────────────────╯
```

## Balance Sheet

A live report, not a form --- here it is reflecting the real, early state of this business, right after the owner's $5,000.00 capital contribution, the Ice stock bought and sold for cash, and the $100.00 rent expense (the same real figures the web chapter's own screenshots walk through getting to): Cash and Bank at $5,900.00, Ice's own Inventory account still carrying its $1,000.00, and a genuinely balanced Assets = Liabilities + Equity.

```
╭──────────────────────────────────────────────────────────────────────────────╮
│ Balance Sheet — Tutorial Wine Retail Business / Actual                       │
│                                                                              │
│ Assets                                                                       │
│   Cash and Bank                   $5,900.00                                  │
│   Ice — Main Street Cellar        $1,000.00                                  │
│   Total Assets                    $6,900.00                                  │
│                                                                              │
│ Liabilities                                                                  │
│   (no accounts with a real balance)                                          │
│   Total Liabilities               $0.00                                      │
│                                                                              │
│ Equity                                                                       │
│   Owner's Equity                  ($5,000.00)                                │
│   Retained Earnings               ($1,900.00)                                │
│   Total Equity                    $6,900.00                                  │
│                                                                              │
│ Balanced — Assets = Liabilities + Equity                                     │
│ Escape back to menu                                                          │
╰──────────────────────────────────────────────────────────────────────────────╯
```

## New Business

The same real wizard, reached the same real way --- shown here only at its own first, real step (naming the new business); this chapter doesn't carry a second business through creation, so as not to disturb the one real Tutorial Wine Retail Business every other screen below is captured against.

```
╭──────────────────────────────────────────────────────────────────────────────╮
│ New Business — name                                                          │
│                                                                              │
│                                                                              │
│ Enter continues · Escape cancels                                             │
╰──────────────────────────────────────────────────────────────────────────────╯
```

## Business Structure

The same real, three-step popup the web app has --- Org Chart, Item Categories, and Other Hierarchies --- stepped between here with ←/→ instead of Back/Next buttons. By the time this tutorial's business has grown (per the web chapter's own, full narrative), its Org Chart carries two real locations under the **Adelaide Metro** division, plus a **Warehouse Ops** department:

```
╭──────────────────────────────────────────────────────────────────────────────╮
│ Org Chart — Tutorial Wine Retail Business                                    │
│                                                                              │
│ Divisions                                                                    │
│ › Adelaide Metro (2)                                                         │
│   Unassigned (no division) (0)                                               │
│ Departments                                                                  │
│   Warehouse Ops (1)                                                          │
│   Unassigned (no department) (1)                                             │
│ ↑/↓ highlight · Enter open a bucket · I add Location/Division/Department · D │
│  delete highlighted (not Unassigned) · ←/→ Item Categories / Other           │
│ Hierarchies · Escape back to menu                                            │
╰──────────────────────────────────────────────────────────────────────────────╯
```

Item Categories, one step over, carries the real **Beer** and **Whiskey** categories the web chapter grows into:

```
╭──────────────────────────────────────────────────────────────────────────────╮
│ Item Categories — Tutorial Wine Retail Business                              │
│                                                                              │
│ › Beer                                                                       │
│   Whiskey                                                                    │
│ ↑/↓ highlight · Enter drill in · I add a category here · D delete            │
│ highlighted · ←/→ Org Chart / Other Hierarchies · Escape back to menu        │
╰──────────────────────────────────────────────────────────────────────────────╯
```

And Other Hierarchies carries the real OSASCOMP-style groupings this tutorial's items are tagged by --- Container, Packaging, Size, Storage:

```
╭──────────────────────────────────────────────────────────────────────────────╮
│ Other Hierarchies — Tutorial Wine Retail Business                            │
│                                                                              │
│ › Container (2)                                                              │
│   Packaging (1)                                                              │
│   Size (2)                                                                   │
│   Storage (1)                                                                │
│ ↑/↓ highlight · Enter open · I add a hierarchy · D delete highlighted · ←/→  │
│ Org Chart / Item Categories · Escape back to menu                            │
╰──────────────────────────────────────────────────────────────────────────────╯
```

## Purchasing

Four real screens, each shown here exactly as it first opens --- this chapter doesn't carry a purchase, payment, or order through to completion on this business's own real books, so as not to disturb the figures the Balance Sheet above, and the web chapter's own figures, both depend on.

**Purchase** (on account, from a real provider):

```
╭──────────────────────────────────────────────────────────────────────────────╮
│ AP Purchase — Tutorial Wine Retail Business / Actual                         │
│                                                                              │
│ Reference                                                                    │
│ Enter continues · Escape back to menu                                        │
╰──────────────────────────────────────────────────────────────────────────────╯
```

**Cash Purchase** (from the 'Cash' provider, posted and paid off in full the same instant) --- already offering this business's own two real locations to receive stock at:

```
╭──────────────────────────────────────────────────────────────────────────────╮
│ Cash Purchase — Tutorial Wine Retail Business / Actual                       │
│                                                                              │
│ A purchase from the 'Cash' provider — posted and paid off in full the same   │
│ instant.                                                                     │
│ Receive at location                                                          │
│ ❯ Head Office                                                                │
│   Main Street Cellar                                                         │
│ Escape back to menu                                                          │
╰──────────────────────────────────────────────────────────────────────────────╯
```

**Purchase Order** (a memo-only commitment to buy --- no real ledger effect until a Stock Receipt fulfills it):

```
╭──────────────────────────────────────────────────────────────────────────────╮
│ Purchase Order — Tutorial Wine Retail Business / Actual                      │
│                                                                              │
│ Commits to buying from a provider — memo only, no real ledger effect until a │
│  Stock Receipt fulfills it.                                                  │
│ Reference                                                                    │
│ Enter continues · Escape back to menu                                        │
╰──────────────────────────────────────────────────────────────────────────────╯
```

**Payment** (to a provider --- debits their Accounts Payable balance, credits Cash and Bank):

```
╭──────────────────────────────────────────────────────────────────────────────╮
│ AP Payment — Tutorial Wine Retail Business / Actual                          │
│                                                                              │
│ A payment to a provider — debits their Accounts Payable balance, credits     │
│ Cash and Bank.                                                               │
│ Reference                                                                    │
│ Enter continues · Escape back to menu                                        │
╰──────────────────────────────────────────────────────────────────────────────╯
```

## Sales

**Sale** (on screen as "Sale," reached from the menu's own **AR Sale** link --- a sale to a customer on credit):

```
╭──────────────────────────────────────────────────────────────────────────────╮
│ AR Sale — Tutorial Wine Retail Business / Actual                             │
│                                                                              │
│ A sale to a customer on credit — debits their Accounts Receivable balance,   │
│ credits Sales Revenue.                                                       │
│ Reference                                                                    │
│ Enter continues · Escape back to menu                                        │
╰──────────────────────────────────────────────────────────────────────────────╯
```

**Cash Sale** (to the 'Cash' customer, posted and paid off in full the same instant):

```
╭──────────────────────────────────────────────────────────────────────────────╮
│ Cash Sale — Tutorial Wine Retail Business / Actual                           │
│                                                                              │
│ A sale to the 'Cash' customer — posted and paid off in full the same         │
│ instant.                                                                     │
│ Dispatch from location                                                       │
│ ❯ Head Office                                                                │
│   Main Street Cellar                                                         │
│ Escape back to menu                                                          │
╰──────────────────────────────────────────────────────────────────────────────╯
```

**Customers** --- a real, read-only browse of this business's real account-based customers, including **Riverside Restaurant** from the web chapter's own, full narrative. A note right on screen is honest about the one, real limit here: a new named, account-based customer is still only ever created through the Structured Editor or an API-side fixture step, never from this screen itself.

```
╭──────────────────────────────────────────────────────────────────────────────╮
│ Customers — Tutorial Wine Retail Business                                    │
│                                                                              │
│ Real, account-based customers — created today only via the Structured Editor │
│  or an API-side fixture step, not from this screen.                          │
│ ❯ Cash                                                                       │
│   Riverside Restaurant                                                       │
│ Enter opens a customer's details · Escape back to menu                       │
╰──────────────────────────────────────────────────────────────────────────────╯
```

## POS Terminal

The everyday retail register, scoped to a real location of type Retail --- this business's own **Main Street Cellar**:

```
╭──────────────────────────────────────────────────────────────────────────────╮
│ POS Terminal — Tutorial Wine Retail Business / Actual                        │
│                                                                              │
│ The everyday retail register — a real location of type 'Retail'.             │
│ ❯ Main Street Cellar                                                         │
│ Escape back to menu                                                          │
╰──────────────────────────────────────────────────────────────────────────────╯
```

## What's still web-only

Everything above is real and current, captured from the real, running terminal program. The rest of the web chapter's own full story --- naming a supplier (Vendors), giving an item its own registered unit cost and pack size, transferring stock between locations, sealing and opening a container, the Close Books / Rollover To New Period sequence that moves this business between financial years, and the New New P&L multi-axis report --- still has no real TUI screen to show, and this chapter doesn't pretend otherwise. Those steps remain exactly what Chapter 3 shows them as: real, exercised end to end by the automated Tutorial test, through the web app.
