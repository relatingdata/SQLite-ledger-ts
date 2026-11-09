# Chapter 4b --- The Manufacturing Tutorial, in the Terminal

Chapter 3b showed the terminal (text) user interface against the wine retailer. This short chapter is its own, honest sibling for the **Tutorial Window & Door Manufacturing** business instead --- the same real terminal client, the same real backend, a genuinely different kind of business behind it. It is not a second walk through Chapter 4's own story; it only shows what the terminal frontend genuinely covers for this business, and says plainly where it doesn't.

**The TUI's own real screen list hasn't grown for this business** --- it is the same twelve real, working screens Chapter 3b already documents: Login, the Menu, General Journal, Balance Sheet, New Business, Business Structure, Purchase, Cash Purchase, Purchase Order, Payment, AR Sale, Cash Sale, Customers, and POS Terminal. Five of those (Purchase, Purchase Order, Payment, AR Sale, POS Terminal) and two of Business Structure's own three tabs (Item Categories, Other Hierarchies) work identically here --- same real screen, same real mechanism, nothing about this business changes how they behave --- so this chapter doesn't re-capture them a second time; Chapter 3b already shows them, truthfully, once. What this chapter captures instead is every screen where this business's own real data genuinely looks different: a different business name throughout, two real storage locations instead of one shop floor, and a Balance Sheet carrying fifteen real raw-material and assembly inventory accounts instead of one.

**There is still no TUI screen at all for Items or the Bill of Materials.** Chapter 4's own web story is built entirely around the Items page's BOM card --- creating the raw materials, defining each assembly's exact component list, assembling, and selling. None of that has a terminal screen yet. That is the one real, honest gap this chapter exists to name plainly, not paper over: the web app remains the only way to set up or inspect a Bill of Materials today.

Every transcript below is real text, captured directly from a live, passing run of the real terminal program --- never hand-typed --- against the exact same **Tutorial Window & Door Manufacturing** business this manual's Chapter 4 builds (created fresh via the same, shared `shared-fixtures/manufacturing-tutorial-steps.csv` fixture, including its own real builder house-door orders, run through the fast, backend-only `--path api` route rather than re-driven screen by screen). A terminal's own natural "screenshot" is its real text output, captured with `terminal.text()` against a genuine, running `@microsoft/tui-test` session rather than a bitmap of one --- see `backend/scripts/capture-manufacturing-tui-transcripts.ts`, run fresh by `make tutorial-section-user-manual-manufacturing-tui`.

## Logging in

The same account, the same backend, the same real Login screen Chapter 3b already shows --- captured again here only because it is this chapter's own real, first step:

```
sql-ledger-ts — text user interface (test implementation: Login, Menu, General Journal, Balance
Sheet, New Business, Business Structure, Purchase, Cash Purchase, Purchase Order, Payment, AR Sale,
Cash Sale, Customers, POS Terminal)
╭──────────────────────────────────────────────────────────────────────────────────────────────────╮
│ sql-ledger-ts — Log in                                                                           │
│                                                                                                  │
│ Username                                                                                         │
│                                                                                                  │
│ Password                                                                                         │
│                                                                                                  │
│ Enter on Username moves to Password · Enter on Password logs in                                  │
╰──────────────────────────────────────────────────────────────────────────────────────────────────╯
```

## Choosing a business, then a ledger

This account's own, real **Tutorial Window & Door Manufacturing** business now sits alongside everything else it has access to --- its own small, personal **admin** business included, same real rule as Chapter 3b:

```
╭──────────────────────────────────────────────────────────────────────────────────────────────────╮
│ Choose a business                                                                                │
│                                                                                                  │
│ ❯ admin                                                                                          │
│   Tutorial Window & Door Manufacturing                                                           │
╰──────────────────────────────────────────────────────────────────────────────────────────────────╯
```

Choosing it offers its own real ledgers --- the Actual ledger this tutorial trades in, and the Budget ledger created alongside it:

```
╭──────────────────────────────────────────────────────────────────────────────────────────────────╮
│ Choose a ledger — Tutorial Window & Door Manufacturing                                           │
│                                                                                                  │
│ ❯ Actual                                                                                         │
│   Budget 2026-27                                                                                 │
╰──────────────────────────────────────────────────────────────────────────────────────────────────╯
```

## The Menu

The same real, live, server-computed menu --- same sections, same labels, same standing rule that the GUI and TUI must line up completely. The business name in the header is the only real difference from Chapter 3b's own capture:

```
╭──────────────────────────────────────────────────────────────────────────────────────────────────╮
│ Menu — Tutorial Window & Door Manufacturing                                                      │
│                                                                                                  │
│ ❯ General Ledger                                                                                 │
│   test                                                                                           │
│   Accounts Receivable (Debtors / Sales)                                                          │
│   Accounts Payable (Creditors / Purchasing)                                                      │
│   Inventory                                                                                      │
│   Cash                                                                                           │
│   Vouchers                                                                                       │
│   HR                                                                                             │
│   Logistics                                                                                      │
│   Shipping                                                                                       │
│   Projects & Jobs                                                                                │
│   Configuration                                                                                  │
│ ↑/↓ move · Enter open a section · q quit                                                         │
╰──────────────────────────────────────────────────────────────────────────────────────────────────╯
```

## General Journal

The same real journal every one of this tutorial's own entries posts through --- the owner's $20,000.00 capital contribution, every raw-material purchase, both rounds of BOM reclassification (raw materials into frames, frames into complete units), and all three real builder-order sales. Reached fresh, before any line is staged:

```
╭──────────────────────────────────────────────────────────────────────────────────────────────────╮
│ General Journal — Tutorial Window & Door Manufacturing / Actual                                  │
│                                                                                                  │
│ Reference                                                                                        │
│ Enter to continue · Escape back to menu                                                          │
╰──────────────────────────────────────────────────────────────────────────────────────────────────╯
```

## Balance Sheet

A live report, not a form --- here it is reflecting the real, final state after every purchase, both rounds of assembly, and all three real builder orders (BuildRight Constructions' two orders, and Coastal Home Builders' own order) have posted. Fifteen real inventory accounts are still carrying a genuine leftover buffer of raw materials and partially-assembled frame stock --- this tutorial deliberately buys and assembles a little more than its own three orders consume, same real convention as Chapter 4's own web narrative --- and the books are genuinely balanced:

```
sql-ledger-ts — text user interface (test implementation: Login, Menu, General Journal, Balance
Sheet, New Business, Business Structure, Purchase, Cash Purchase, Purchase Order, Payment, AR Sale,
Cash Sale, Customers, POS Terminal)
╭──────────────────────────────────────────────────────────────────────────────────────────────────╮
│ Balance Sheet — Tutorial Window & Door Manufacturing / Actual                                    │
│                                                                                                  │
│ Assets                                                                                           │
│   Aluminum Extrusion              $32.00                                                         │
│   Aluminum Sill                   $80.00                                                         │
│   Cash and Bank                   $24,433.00                                                     │
│   Door Hardware Kit               $135.00                                                        │
│   Door Slab - External            $150.00                                                        │
│   Door Slab - Internal            $140.00                                                        │
│   Glass Pane                      $100.00                                                        │
│   Hardware Kit                    $60.00                                                         │
│   Hinge Set                       $120.00                                                        │
│   Internal Door Latch Kit         $70.00                                                         │
│   Packaging Kit                   $40.00                                                         │
│   Sliding Door Track Kit          $240.00                                                        │
│   Timber Rail                     $50.00                                                         │
│   Timber Stile                    $48.00                                                         │
│   Weatherseal Kit                 $50.00                                                         │
│   Total Assets                    $25,748.00                                                     │
│                                                                                                  │
│ Liabilities                                                                                      │
│   (no accounts with a real balance)                                                              │
│   Total Liabilities               $0.00                                                          │
│                                                                                                  │
│ Equity                                                                                           │
│   Owner's Equity                  ($20,000.00)                                                   │
│   Current Year Earnings           ($5,748.00)                                                    │
│   Total Equity                    $25,748.00                                                     │
│                                                                                                  │
│ Balanced — Assets = Liabilities + Equity                                                         │
│ Escape back to menu                                                                              │
╰──────────────────────────────────────────────────────────────────────────────────────────────────╯
```

## New Business

The same real wizard Chapter 3b's own capture already shows, reached the same real way --- shown here again only at its own first, real step, then cancelled, so as not to disturb the real Manufacturing business every other screen in this chapter is captured against:

```
╭──────────────────────────────────────────────────────────────────────────────────────────────────╮
│ New Business — name                                                                              │
│                                                                                                  │
│                                                                                                  │
│ Enter continues · Escape cancels                                                                 │
╰──────────────────────────────────────────────────────────────────────────────────────────────────╯
```

## Business Structure

The same real Org Chart tab Chapter 3b documents --- shown here because this business's own real story genuinely differs: its two real locations (Raw Materials Store, Finished Goods Store) were never assigned to a Division, so both land under **Unassigned**. That is a real, honest result of this tutorial's own setup, not a richer structure like the wine retailer's own Adelaide Metro division --- Item Categories and Other Hierarchies, the Org Chart's two sibling tabs, work identically to Chapter 3b's own capture and aren't repeated here.

```
╭──────────────────────────────────────────────────────────────────────────────────────────────────╮
│ Org Chart — Tutorial Window & Door Manufacturing                                                 │
│                                                                                                  │
│ Divisions                                                                                        │
│ › Unassigned (no division) (2)                                                                   │
│ Departments                                                                                      │
│   Unassigned (no department) (0)                                                                 │
│ ↑/↓ highlight · Enter open a bucket · I add Location/Division/Department · D delete highlighted  │
│ (not Unassigned) · ←/→ Item Categories / Other Hierarchies · Escape back to menu                 │
╰──────────────────────────────────────────────────────────────────────────────────────────────────╯
```

## Purchasing and Sales

Purchase, Purchase Order, Payment, and AR Sale all work identically to Chapter 3b's own capture, screen for screen --- this business's own real providers and customers simply take their place in those same, unchanged screens, so they aren't re-captured here. Cash Purchase and Cash Sale are shown again below, purely because the one real, live thing that differs is the location picker each one opens with --- this manufacturer's own two real storage locations, in place of the wine retailer's shop floor and head office.

**Cash Purchase** --- receiving raw materials or finished goods, paid off in full the same instant:

```
sql-ledger-ts — text user interface (test implementation: Login, Menu, General Journal, Balance
Sheet, New Business, Business Structure, Purchase, Cash Purchase, Purchase Order, Payment, AR Sale,
Cash Sale, Customers, POS Terminal)
╭──────────────────────────────────────────────────────────────────────────────────────────────────╮
│ Cash Purchase — Tutorial Window & Door Manufacturing / Actual                                    │
│                                                                                                  │
│ A purchase from the 'Cash' provider — posted and paid off in full the same instant.              │
│ Receive at location                                                                              │
│ ❯ Finished Goods Store                                                                           │
│   Raw Materials Store                                                                            │
│ Escape back to menu                                                                              │
╰──────────────────────────────────────────────────────────────────────────────────────────────────╯
```

**Cash Sale** --- dispatching a finished assembly, paid off in full the same instant:

```
sql-ledger-ts — text user interface (test implementation: Login, Menu, General Journal, Balance
Sheet, New Business, Business Structure, Purchase, Cash Purchase, Purchase Order, Payment, AR Sale,
Cash Sale, Customers, POS Terminal)
╭──────────────────────────────────────────────────────────────────────────────────────────────────╮
│ Cash Sale — Tutorial Window & Door Manufacturing / Actual                                        │
│                                                                                                  │
│ A sale to the 'Cash' customer — posted and paid off in full the same instant.                    │
│ Dispatch from location                                                                           │
│ ❯ Finished Goods Store                                                                           │
│   Raw Materials Store                                                                            │
│ Escape back to menu                                                                              │
╰──────────────────────────────────────────────────────────────────────────────────────────────────╯
```

**Customers** --- a real, read-only browse of this business's own two real builders, both from Chapter 4's own real builder-order narrative: **BuildRight Constructions Pty Ltd** (two of the three orders) and **Coastal Home Builders Pty Ltd** (the second, genuinely different builder, its own townhouse-block order). The same real, honest limit Chapter 3b notes applies here too --- a new named customer is still only ever created through the Structured Editor or an API-side fixture step, never from this screen itself.

```
sql-ledger-ts — text user interface (test implementation: Login, Menu, General Journal, Balance
Sheet, New Business, Business Structure, Purchase, Cash Purchase, Purchase Order, Payment, AR Sale,
Cash Sale, Customers, POS Terminal)
╭──────────────────────────────────────────────────────────────────────────────────────────────────╮
│ Customers — Tutorial Window & Door Manufacturing                                                 │
│                                                                                                  │
│ Real, account-based customers — created today only via the Structured Editor or an API-side      │
│ fixture step, not from this screen.                                                              │
│ ❯ BuildRight Constructions Pty Ltd                                                               │
│   Cash                                                                                           │
│   Coastal Home Builders Pty Ltd                                                                  │
│ Enter opens a customer's details · Escape back to menu                                           │
╰──────────────────────────────────────────────────────────────────────────────────────────────────╯
```

POS Terminal, like the Purchasing screens above, works identically to Chapter 3b's own capture and isn't shown a second time here --- this business has no location of type Retail for it to open against in the first place, so the one real difference would only be an empty picker, not a more informative screen.

## What's still web-only

Everything above is real and current, captured from the real, running terminal program against this business's own real figures. Three real things Chapter 4's own web narrative covers still have no TUI screen at all, and this chapter doesn't pretend otherwise:

- **Items and the Bill of Materials.** Every raw material, every assembly, and every one of this tutorial's own BOM lines (the Aluminum Window Frame's four components, each door frame's own list, the second-level "Unit --- Complete" assemblies taking a frame as one of their own real components) was set up and is still only inspectable through the web app's Items page. There is no terminal screen for any of it yet.
- **Stock Receive and Stock Dispatch as their own, separate step.** The real two-round assembly this tutorial's own story depends on --- raw materials physically leaving the Raw Materials Store, finished frames or complete units physically arriving at the Finished Goods Store --- happens through the same real `receiveStock`/`dispatchStock` mechanism Cash Purchase and Cash Sale (and Purchase/AR Sale) already use above, but only ever bundled inside one of those screens, never as a standalone "just move stock" step of its own.
- Everything Chapter 3b already names as web-only for the wine retailer --- Vendors/Providers, an item's own registered unit cost and pack size, Transfer Items, Open/Close Container, the Close Books / Rollover To New Period sequence, and the New New P&L multi-axis report --- remains exactly as web-only here. None of it is specific to retail; it simply hasn't grown a terminal screen yet for either business.

Those steps remain exactly what Chapter 4 shows them as: real, exercised end to end by the automated Manufacturing tutorial test, through the web app.
