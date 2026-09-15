# Entity Chains — A Real, Live Snapshot

Generated directly from a real, fully-simulated database (`make demo-full-year`), not hand-written — every name, count, and chain below is what actually exists at generation time, not what was intended or assumed. Regenerate after any real, structural change: `node --import tsx backend/scripts/generate-entity-chains-doc.ts`.

Total real entities in this snapshot: **533**

See `docs/entity-model.md` for the deeper mechanics (`parent_id` vs. `relation_id`, the relationship-type pattern, typed addresses/phones). This document is the map; that one is the explanation of how the map is drawn.

## The 13 real, top-level classes

Every real entity in this app has exactly one parent, walked recursively — a real tree, not a general graph. These 13 are the direct children of the root `Application` entity.

Table: The 13 direct children of the root `Application` entity

| Class | Direct children | What it is |
|---|---|---|
| Business Reports | 5 | The 5 real, shared top-level report categories (Asset/Liability/Equity/Income/Expense) — genuinely shared across every business. |
| Businesses | 6 | Every real company using this system — each with its own real ledgers and (where applicable) its own real locations sub-tree. |
| Chart of Accounts | 5 | Country-specific families of named, postable leaf accounts — English, German, French, Italian, Swiss. |
| Divisions | 2 | Real profit/cost centers — one per real location (see `cityDivisionFor`, which resolves a location's own city to its matching division). |
| Employees | 18 | Every real staff member, across every business, as real AP counterparties. |
| Languages | 5 | The 5 real, supported display languages. |
| Locations | 0 | The real, generic root — actual, real locations live reparented under `{Business} Locations`, see below, not directly here. |
| Manufacturers | 0 | Real product manufacturers/brand owners. |
| Orders | 0 | Real, individual purchase/sales order records (the older Qty/Value-account mechanism) — the single largest class. |
| Parts | 5 | The real, shared product catalog — categories, subcategories, and individual products. |
| Stock Quantities | 0 | A real, generic root for quantity-tracking; the real, per-product On Order/Units Sold accounts (see below) live under each product itself, not here. |
| Transaction Templates | 1 | A real, now-mostly-dead design direction — see `docs/entity-model.md` and the recent table-audit commit for what remains and why. |
| Vocabulary | 259 | Every real, translatable UI word/phrase — the largest, single flat category, with real translations in `translation_entry`. |

## Businesses and their own real sub-trees

Every real business is its own, top-level entity under `Businesses`, and where a business has real, posted activity, it grows its own child sub-trees (ledgers, and — for a retail business — its own locations).

### BMW M GmbH

- **BMW M GmbH Actual**

### Ditta Italiana Srl

- **Ditta Italiana Srl Actual**

### My Business

- **Actual**
- **Proposed Growth Budget 2026-27**

### Peugeot Citroën Sochaux SNC

- **PCS Actual**

### Schweizer KMU AG

- **Schweizer KMU AG Actual**

### Wine Retail Business

- **Wine Retail Business Actual**
- **Wine Retail Business Locations** (7 real children: Eastside Cellar Door, Harbourside Bottle Shop, Head Office, Market Square Liquor, Riverside Cellars, Uptown Wine & Spirits, Warehouse B)

## Real, deeper chains — a sample of each

### Parts: category → subcategory → product

- **Beer**
  - Ale (2 real products: Amber Ale 330ml, Pale Ale 330ml)
  - Lager (2 real products: Golden Lager 330ml, Premium Pilsner 330ml)
  - Stout (2 real products: Classic Stout 330ml, Imperial Stout 330ml)
- **Red Wine**
  - Cabernet Sauvignon (2 real products: Coonawarra Cabernet 2021, Napa Ridge Cabernet Sauvignon 2020)
  - Merlot (2 real products: Barossa Valley Merlot 2022, Château Dubois Merlot 2021)
  - Pinot Noir (2 real products: Central Otago Pinot Noir 2022, Côte de Nuits Pinot Noir 2021)
  - Shiraz (2 real products: Barossa Shiraz 2021, Hunter Valley Shiraz 2020)
- **Sparkling Wine**
  - Cava (2 real products: Cava Rosé, Penedès Cava Brut)
  - Champagne (2 real products: Grande Maison Champagne Brut, Grande Maison Champagne Rosé)
  - Prosecco (2 real products: Prosecco Extra Dry, Veneto Prosecco DOC)
- **Spirits**
  - Gin (2 real products: Botanical Gin 700ml, London Dry Gin 700ml)
  - Rum (2 real products: Dark Rum 700ml, Spiced Rum 700ml)
  - Vodka (2 real products: Craft Vodka 700ml, Premium Vodka 700ml)
  - Whisky (2 real products: Blended Scotch 700ml, Highland Single Malt 700ml)
- **White Wine**
  - Chablis (2 real products: Chablis Premier Cru 2021, Petit Chablis 2022)
  - Chardonnay (2 real products: Margaret River Chardonnay 2022, Sonoma Chardonnay 2021)
  - Riesling (2 real products: Clare Valley Riesling 2021, Mosel Riesling 2022)
  - Sauvignon Blanc (2 real products: Loire Valley Sauvignon Blanc 2022, Marlborough Sauvignon Blanc 2023)

### A single, real product — its full, real chain of accounts

`Golden Lager 330ml` (a real, live product) has 0 real, direct child accounts:


These are exactly the real accounts a real sale/receipt/transfer posts against — see `postQuantityMovement`, `receiveStockAtLocation`, and `dispatchStockFromLocation` in `backend/src/db-stock.ts` for how each is actually used, and `docs/money-model.md` for why quantity and value are tracked as two independent facts.

### Employees — a real, complete roster sample

18 real employees exist across every business. A sample of 5, with their real, configured pay structure:

Table: A sample of 5 real employees, out of 18 total, with their configured pay structure

| Name | Pay structure | Address |
|---|---|---|
| Amelia Standish | $28.50/hour | 18 Cobblestone Way, Rivertown |
| Beatrix Solano | $32.00/hour | 41 Fernhill Avenue, Springfield |
| Callum Restrepo | $29.50/hour | 85 Industrial Drive, Springfield |
| Chloe Ferraro | $28.50/hour | 14 Willow Court, Springfield |
| Diego Fontaine | $28.50/hour | 44 Market Street, Rivertown |

### Locations — the real, business-specific sub-tree, not the generic root

A real, important structural note: `Locations` (the generic, top-level class above) has zero real, direct children in a live database. Every real, actual location lives reparented under its own business — e.g. `Wine Retail Business Locations` — confirmed directly, not assumed.

**Wine Retail Business Locations** (7 real locations):

Table: The 7 real locations under Wine Retail Business

| Location | Type | City |
|---|---|---|
| Eastside Cellar Door | retail | Rivertown |
| Harbourside Bottle Shop | retail | Rivertown |
| Head Office | warehouse | Springfield |
| Market Square Liquor | retail | Rivertown |
| Riverside Cellars | retail | Springfield |
| Uptown Wine & Spirits | retail | Springfield |
| Warehouse B | warehouse | Rivertown |

### Divisions — real profit/cost centers

- **Rivertown** (4: Eastside Cellar Door Division, Harbourside Bottle Shop Division, Market Square Liquor Division, Warehouse B Division)
- **Springfield** (3: Head Office Division, Riverside Cellars Division, Uptown Wine & Spirits Division)

### Vocabulary — the largest, flat class, a real sample

259 real, translatable words/phrases exist. An alphabetically-first sample of 10:

- A customer's committed order — memo only, no real ledger effect until a Stock Dispatch fulfills it (all or part).
- A direct, multi-line entry into the ledger — debits and credits across any accounts, balanced to zero. Fill in the header fields, add lines until the entry balances, then Save.
- A part's canonical details are separate from who supplies it. The same part is routinely available from more than one manufacturer, through more than one vendor, at different prices and package sizes — and which one you prefer isn't always about price. Mark one preferred and say why: local stock, package size, reliability, whatever the real reason is.
- A payment received from a customer (cash, cheque, or EFT) — debits Cash and Bank, credits their Accounts Receivable balance.
- A payment to a vendor — debits their Accounts Payable balance, credits Cash and Bank.
- A physical inventory count for one location — the sheet is ordered the way you actually walk the floor (shelf side, then rack, then top to bottom), not alphabetically by part name. Completing it posts any real variance to the ledger and corrects quantity on hand to match what was actually counted.
- A purchase from a vendor on credit — debits an expense or asset account, credits their Accounts Payable balance.
- A sale to a customer on credit — debits their Accounts Receivable balance, credits Sales Revenue.
- Account
- Account Number

