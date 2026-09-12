# Chapter 1 --- Introduction

## What this application is

Better Brighter Multi-Ledger is a double-entry accounting and retail operations application, built around one, simple, central idea: everything in it --- every account, every business, every division, every location, every product, every employee, even every menu label --- is genuinely the same kind of thing underneath: an *entity*, sitting in one, single, shared tree. There is no separate "customers table" or "products table" living apart from everything else --- a customer, a product, and a bank account are all real rows in the same, one, underlying structure, each simply positioned differently within it.

This manual walks through the application as it actually exists today, using the bundled example business --- Wine Retail Company, a small, multi-location wine and spirits retailer --- to show every real screen with real, live data on it.

## Logging in

Every real session starts with a real, direct login --- a real username and password, checked against the application's own, real, established login screen.

![The Login screen, showing the same, real, established panel-frame title every other screen in the application uses.](manual-images/m_login.png)

## Businesses, ledgers, and language

After logging in, before you reach any real screen, you choose three things: which real **business** you're working in (a company or entity you're keeping books for), which real **ledger** within it --- "Actual" is always the real books; anything else, such as a Budget ledger, is a completely separate, isolated scenario that never affects the real one --- and which **language** the interface displays its labels in.

![The business/ledger/language choice screen, immediately after logging in.](manual-images/m_choose_business.png)

## The main screen, once you're in

Once a business, ledger, and language are chosen, you land on the main screen. The top bar shows every real, major section of the application --- General Ledger, Accounts Receivable, Accounts Payable, Cash, and more --- with a real, contextual sidebar on the left showing every screen within whichever section is currently selected.

![The main screen, General Ledger section selected, showing its full, real sidebar.](manual-images/m_home.png)

## How the menu is organized

The top-level sections are organized around real, everyday workflows rather than abstract categories: **Accounts Receivable (Debtors / Sales)** holds everything related to selling and being paid; **Accounts Payable (Creditors / Purchasing)** holds everything related to buying and paying; **Cash** holds immediate, no-account transactions and the POS register; **General Ledger** holds the core accounting reports and the year-end close; and **Configuration** --- covered in full in Chapter 2 --- holds everything an administrator uses to set the business up in the first place.

A screen shown in italics in the sidebar (such as Reconciliation or FX Adjustment) is a real, acknowledged gap --- a planned screen that doesn't exist yet --- shown honestly rather than hidden, so it's clear what's genuinely available today versus what's still ahead.

## Navigating with the keyboard

The top bar and sidebar both, genuinely, respond to the keyboard, not just the mouse. With a real, top-bar section already focused, the Left/Right arrow keys move between sections, the same, real order they're shown in --- General Ledger, Accounts Receivable, and onward. With a real, sidebar link already focused, Up/Down does the same within that section's own, current list of links.

Pressing **Esc** while working in the main panel returns focus straight to the sidebar's own, currently-active link --- a quick way back to the menu without reaching for the mouse. If the panel has a real, genuine, unsaved edit pending, Esc asks first, rather than silently discarding it: confirm to discard and return to the menu, or cancel to keep working. This is still being extended, screen by screen, across the application; the Structured Editor (Configuration) is the first, real, working example of it today.

\clearpage

