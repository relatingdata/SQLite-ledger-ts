# User Guide

A walkthrough for someone using this application for the first time —
not a developer reference (see `README.md` for that), a guide for
actually running it and posting real entries. Every number in this guide
was captured from the running application, not invented — you'll see the
exact same figures if you follow along.

## 1. First run

```bash
make install
make dev
```

Open http://localhost:5173. The very first thing you'll see is the
**choice screen** — pick a business, a ledger, and a language before
anything else. Every other screen redirects here if you haven't chosen
yet. To start, pick "My Business", "Actual", and "English" — we'll set
up a second, brand-new business further down.

## 2. The three things you choose up front

- **Business** — a company or entity you're keeping books for. The app
  ships with one seeded example, "My Business".
- **Ledger** — a named *scenario* within that business. "Actual" is
  always the real books. Anything else — a budget, a growth projection —
  is a completely separate, isolated set of entries. You can post the
  same kind of transaction to two different ledgers and compare them
  side by side without either ever affecting the other.
- **Language** — which language the interface displays vocabulary in
  (buttons, field labels). English is complete by definition; German has
  15 of 16 words translated, including the real German accounting terms
  `Soll`/`Haben` for Debit/Credit; Klingon has exactly one word
  translated (`choq`, "save" — genuine attested vocabulary), everything
  else falls back to English. Pick "Switch business/ledger/language" at
  the top of any page to change any of these later.

## 3. Setting up a second business, with its own Actual and Budget ledgers

This is the actual worked example. We'll create **Acme Retail Co**, give
it its own real books, and a separate budget scenario to compare against.

### Create the business

Go to **Structured Editor**. Under "New entity":
- Name: `Acme Retail Co`
- Parent: `Businesses`
- Relation: *(leave blank)*
- Account number: *(leave blank — a business isn't a postable account)*

Click **Create**.

### Give it an Actual ledger

**Important naming detail, worth knowing up front:** entity names are
globally unique across the *entire* application — the same design that
lets "Save" exist as one single translatable word everywhere also means
you can't create a second entity literally named "Actual" once one
already exists (My Business already has one). So new businesses need a
distinguishing name for theirs. Still in the Structured Editor:

- Name: `Acme Retail Co Actual`
- Parent: `Acme Retail Co`

Click **Create**. This step doesn't happen automatically yet — every new
business needs its ledgers created explicitly, the same way you just
created the business itself. (Worth automating in a future pass, but
that's how it works today.)

### Give it a budget ledger too

- Name: `2027 Growth Budget`
- Parent: `Acme Retail Co`

Click **Create**. Go back to the choice screen and confirm — switching
to "Acme Retail Co" as your business should now show both
`Acme Retail Co Actual` and `2027 Growth Budget` as ledger options.

### A structural note: the chart of accounts is shared

Acme Retail Co doesn't need its own "Cash and Bank" or "Sales Revenue" —
those account entities already exist under the global Chart of Accounts,
and any business can post to them. A business's `business_id` on each
journal entry, and a ledger's `ledger_id`, are what separate one
business's books from another's — not a separate copy of the chart of
accounts for each one.

## 4. Posting real transactions to Actual

Switch to **Acme Retail Co** / **Acme Retail Co Actual** on the choice
screen, then go to **Post Journal Entry**.

**A cash sale** — a customer paid $1,200 on the spot:
- Reference: `CS-001`
- Account: `Cash and Bank`, Debit, `1200.00`, click **Add line**
- Account: `Sales Revenue`, Credit, `1200.00`, click **Add line**
- Once both lines are staged, the entry shows **✓ Balanced** — click
  **Post entry**.

**A rent payment** — January's lease, paid in cash:
- Reference: `RENT-001`
- Account: `Rent`, Debit, `500.00`
- Account: `Cash and Bank`, Credit, `500.00`
- Post it.

## 5. Posting a budget scenario, completely separately

Switch the ledger (not the business) to **2027 Growth Budget** on the
choice screen. This is a *different, isolated* set of books for the same
business — post a planned, aspirational number here without it ever
touching the real figures above.

**Planned Q1 sales** — an ambitious growth target, not something that's
actually happened yet:
- Reference: `BUDGET-Q1`
- Account: `Cash and Bank`, Debit, `5000.00`
- Account: `Sales Revenue`, Credit, `5000.00`
- Post it.

## 6. Comparing Actual against Budget in the reports

Go to **Reports → Trial Balance**, with your ledger set to
**Acme Retail Co Actual**:

| Account | Debit | Credit |
|---|---|---|
| Cash and Bank | 700.00 | |
| Rent | 500.00 | |
| Sales Revenue | | 1,200.00 |
| **Total** | **1,200.00** | **1,200.00** |

Switch the ledger to **2027 Growth Budget** and reload the same report:

| Account | Debit | Credit |
|---|---|---|
| Cash and Bank | 5,000.00 | |
| Sales Revenue | | 5,000.00 |
| **Total** | **5,000.00** | **5,000.00** |

Same business, same chart of accounts, completely different numbers —
because the two ledgers are genuinely isolated. **Reports → Profit and
Loss Statement** makes the comparison starker: Actual shows **$700.00
net income** ($1,200 sales − $500 rent); the budget scenario shows
**$5,000.00 net income** (no expenses planned yet) — the gap between
what's actually happened and what's aspirational, side by side, just by
switching the ledger selector.

**Reports → Compare Ledgers** does this without the switching — pick
"Acme Retail Co Actual" as your current ledger, then "2027 Growth Budget"
as the one to compare against, and both a Trial Balance and a
Profit and Loss appear together, column by column, with a **Variance**
column (budget minus actual — positive means the plan is ahead of where
things actually stand).

## 7. The Entity Tree Report and Structured Editor, briefly

- **Entity Tree** (`/`) is read-only — the entire application, one tree,
  starting from a single root. Useful for seeing where anything sits:
  Acme Retail Co, its two ledgers, and every account it can post to, all
  in one view.
- **Structured Editor** (`/editor`) is where you create, rename,
  reparent, or delete anything — the same mechanism you just used to set
  up Acme Retail Co works identically for a new customer, a new expense
  account, or a new sub-account under Accounts Receivable.

## 8. Known limitations, stated plainly

- Creating a new business does not automatically create its Actual
  ledger — that's a manual second step today, as shown above.
- The chart of accounts is global, not per-business — if two businesses
  need genuinely different accounts, you'd give them different entities
  rather than relying on any built-in separation.
- Ledger names must be globally unique, not just unique per business —
  the naming-convention workaround above (`<Business> Actual`) is the
  practical way to handle that today.
