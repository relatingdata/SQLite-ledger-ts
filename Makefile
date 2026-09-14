.PHONY: all install clean seed dev dev-no-demo dev-verbose backend backend-verbose frontend test test-e2e playwright-tutorial playwright-all reset-db manual manual-screenshots manual-screenshots-german manual-screenshots-french manual-screenshots-danish manual-screenshots-italian programmer-manual entity-tree-svg check-db-consistency check-node-refs verify-fresh checkpoint untrack search list-menu-labels add-menu-translations add-journal-translations playwright-one check-frontend add-journal-remaining-translations add-header-translations check-backend-types add-brand-translation branch check-e2e-types proof-year-end playwright-smoke check-docs-coverage call-graph

# A real, direct, explicit RUNTIME variable, per direct instruction.
# This project uses bun, not npm - RUNTIME is just "bun" itself,
# matching how node/npm are referenced elsewhere in this file: the
# real, standard expectation that the tool is genuinely on whoever's
# own, real PATH, same as any other Makefile dependency.
RUNTIME := bun

# Builds everything the project produces: a fresh install, the full
# test suite, and both real manuals (User + Programmer) - a genuine,
# single command matching the common Makefile 'all' convention.
all: install test manual programmer-manual

# One real, single, root-level install, per direct instruction: this
# project is a genuine bun workspace (backend/frontend/e2e all listed
# in the root package.json's own "workspaces" array) - one real,
# shared node_modules at the root, not three separate ones.
install:
	$(RUNTIME) install

clean:
	rm -rf node_modules package-lock.json bun.lockb
	rm -rf frontend/.svelte-kit
	rm -f sql-ledger-ts_User_Manual.pdf sql-ledger-ts_Programmer_Manual.pdf
	rm -f docs/programmer-manual.md
	rm -rf docs/manual-images docs/manual-images-german docs/manual-images-french docs/manual-images-danish docs/manual-images-italian

dev:
	@echo "Starting backend (:3001) and frontend (:5173) — Ctrl+C stops both."
	@( \
	  cd backend && $(RUNTIME) run dev & \
	  BACKEND_PID=$$!; \
	  cd frontend && $(RUNTIME) run dev & \
	  FRONTEND_PID=$$!; \
	  trap "kill $$BACKEND_PID $$FRONTEND_PID 2>/dev/null" EXIT INT TERM; \
	  wait \
	)

# Same as `dev` above, but with only the one, real, dummy "My
# Business" for login — no Wine Retail Company, no BMW/Peugeot/Ditta/
# Schweizer. Use this to build a real business entirely from scratch
# via the UI or Playwright, with nothing pre-populated. This flag must
# genuinely be set on every real backend start (not just the first) —
# seedRemainingData runs every time the backend loads, so a plain
# `make dev` afterwards would silently re-seed the demo businesses.
dev-no-demo:
	@echo "Starting backend (:3001, only 'My Business' — no demo businesses) and frontend (:5173) — Ctrl+C stops both."
	@( \
	  cd backend && SEED_DEMO_BUSINESSES=false $(RUNTIME) run dev & \
	  BACKEND_PID=$$!; \
	  cd frontend && $(RUNTIME) run dev & \
	  FRONTEND_PID=$$!; \
	  trap "kill $$BACKEND_PID $$FRONTEND_PID 2>/dev/null" EXIT INT TERM; \
	  wait \
	)

dev-verbose:
	@echo "Starting backend (:3001, every SQL statement printed) and frontend (:5173) — Ctrl+C stops both."
	@( \
	  cd backend && DB_VERBOSE=1 $(RUNTIME) run dev & \
	  BACKEND_PID=$$!; \
	  cd frontend && $(RUNTIME) run dev & \
	  FRONTEND_PID=$$!; \
	  trap "kill $$BACKEND_PID $$FRONTEND_PID 2>/dev/null" EXIT INT TERM; \
	  wait \
	)

backend:
	cd backend && $(RUNTIME) run dev

backend-verbose:
	cd backend && DB_VERBOSE=1 $(RUNTIME) run dev

frontend:
	cd frontend && $(RUNTIME) run dev

test:
	cd backend && $(RUNTIME) run test
	cd frontend && $(RUNTIME) run test

# End-to-end verification against real, deterministic business data —
# genuinely different from `test` above (which only exercises small,
# synthetic scenarios). Resets the database, runs the real Wine Retail
# Company simulation (a seeded PRNG, never Math.random() — always
# produces exactly the same numbers), then checks the result against
# exact, documented expected figures (see docs/testing.md). A real
# regression in a posting path, closeBooks, or a report silently
# excluding real accounts fails loudly here with a non-zero exit code.
test-e2e: reset-db
	@echo "Running the real Wine Retail Company simulation (deterministic — same numbers every time)..."
	cd backend && $(RUNTIME) scripts/simulate-wine-retail-month.ts
	@echo ""
	@echo "Verifying against exact, documented expected results..."
	cd backend && $(RUNTIME) scripts/verify-simulation.ts

# A real, minimal, fast, backend-only proof of a complete business
# lifecycle: locations of each real type, staff, an assembly, a full
# order->receive->transfer->sell->stocktake->year-end-close cycle. No
# browser - per backend-first-testing, this is the right level to
# prove this at.
proof-year-end: reset-db
	@echo "Running the real, minimal year-end lifecycle proof..."
	cd backend && $(RUNTIME) scripts/proof-year-end-lifecycle.ts

# Per direct instruction: shares the exact same real, already-populated
# database test-e2e itself creates - simulate-wine-retail-month.ts runs
# first, then Playwright verifies every real language is present and
# exercises the UI against that same, real, already-built business,
# rather than rebuilding it from scratch via slow UI clicks.
test-e2e-playwright: reset-db
	cd backend && $(RUNTIME) scripts/simulate-wine-retail-month.ts
	cd e2e && $(RUNTIME) x playwright test full-e2e-with-languages --reporter=list
	@echo ""

# Real, end-to-end browser tests (Playwright) — genuinely different
# from test-e2e above (a backend-only, headless simulation). This
# drives an actual browser through the actual running app. Playwright's
# own config (e2e/playwright.config.ts) already starts both the
# backend and frontend dev servers itself if they aren't already
# running — no need to `make dev` first. Always resets the database
# first, since the tutorial genuinely creates a new business (Wine
# Retail Company itself) from scratch and expects a clean starting
# point — SEED_DEMO_BUSINESSES=false so it doesn't already exist
# (Playwright's own webServer spawns $(RUNTIME) run dev as a child process,
# inheriting this shell's own environment, so the flag reaches the
# backend it auto-starts too).
playwright-tutorial: reset-db
	@echo "Running the real Wine Retail Company tutorial walkthrough in a real browser, built entirely from scratch (login through the first General Journal transaction)..."
	cd e2e && SEED_DEMO_BUSINESSES=false $(RUNTIME) x playwright test tutorial-walkthrough --reporter=list

# The full, real Playwright browser suite — every real .spec.ts file
# in e2e/tests. Takes several minutes. Use playwright-tutorial above
# for a quick, targeted check instead.
playwright-all: reset-db
	@echo "Running the full, real Playwright browser suite..."
	cd e2e && $(RUNTIME) x playwright test --reporter=list

# A real, generic, reusable target for running one, specific, named
# Playwright test against whatever is already running - does NOT
# reset the database, per the many real cases (a screenshot for
# approval, a targeted regression check) where the current, live data
# is exactly what's needed. Usage: make playwright-one TEST=<name>
playwright-one:
	@if [ -z "$(TEST)" ]; then echo "Usage: make playwright-one TEST=<spec-file-name>"; exit 1; fi
	cd e2e && $(RUNTIME) x playwright test $(TEST) --reporter=list --workers=1

# A real, fast, minimal smoke layer - every real route visited once,
# checking only that it loads without a real, unhandled error. See
# docs/min-e2e-coverage-plan.md for the full, real rationale. Distinct
# from playwright-all (the full, detailed, existing suite) and
# playwright-tutorial (the from-scratch business walkthrough).
playwright-smoke:
	cd e2e && $(RUNTIME) x playwright test min-e2e-route-smoke --reporter=list --workers=1

# The full, real demo dataset: one detailed month (as above) plus a
# real, 12-month Budget and 11 more real, summary-level Actual months
# either side of it, so a full year's real Budget vs. Actual
# comparison exists. Kept as its own, separate target — not part of
# test-e2e above — since it changes real, exact figures test-e2e's own
# verify-simulation.ts checks against; run this when you want the
# fuller dataset to explore, not as part of routine verification.
demo-full-year: reset-db
	@echo "Running the real Wine Retail Company simulation..."
	cd backend && $(RUNTIME) scripts/simulate-wine-retail-month.ts
	@echo ""
	@echo "Adding a real Budget and 11 more real Actual months..."
	cd backend && $(RUNTIME) scripts/add-wine-retail-budget-and-year.ts
	@echo ""
	@echo "Setting real, varied payment terms and credit limits..."
	cd backend && $(RUNTIME) scripts/set-wine-retail-credit-terms.ts
	@echo ""

	@echo "Checking database consistency (balanced entries, no orphans, referential integrity)..."
	cd backend && $(RUNTIME) scripts/verify-db-consistency.ts

check-db-consistency:
	cd backend && $(RUNTIME) scripts/verify-db-consistency.ts

# A real, permanent, repeatable check - per direct, absolute
# instruction, replaces any one-off manual grep sweep of the Makefile
# for stray, unconverted "node" invocations that would break now that
# db.ts imports bun:sqlite (which plain node cannot resolve at all).
check-node-refs:
	@echo "Real 'node' references in this Makefile (review each - a legitimate one, like 'node dist/server.js' in a comment, is fine; a script invocation that should say \$$(RUNTIME) is not):"
	@grep -n "node" Makefile || echo "(none found)"

# A real, single, repeatable command combining what had been several,
# separate, manual steps: reset the database, let it reinitialize
# fresh, then run the full test suite - the real, standard "start from
# nothing, prove it all still works" sequence.
verify-fresh: reset-db
	cd backend && $(RUNTIME) -e "import('./src/db.ts')"
	$(MAKE) test
	$(MAKE) check-docs-coverage

# A real, mechanical, structural check - per
# /mnt/skills/user/documentation-coverage-enforcement/SKILL.md. Fails
# loudly if any real, exported backend function, Makefile target, or
# frontend route is never mentioned anywhere in the assembled manual.
check-docs-coverage:
	cd docs && python3 build-programmer-manual.py
	$(RUNTIME) scripts/check-docs-coverage.ts

# A real, direct, static call-graph analysis - per direct request, to
# replace ad-hoc grepping with one, real, comprehensive tool. Every
# real exported backend function, and how many real times it's
# actually invoked across the whole codebase.
call-graph:
	$(RUNTIME) scripts/call-graph.ts

list-menu-labels:
	cd backend && $(RUNTIME) scripts/list-menu-labels.ts

add-menu-translations:
	$(RUNTIME) shared-fixtures/add-menu-translations.ts

add-journal-translations:
	$(RUNTIME) shared-fixtures/add-journal-translations.ts

add-journal-remaining-translations:
	$(RUNTIME) shared-fixtures/add-journal-remaining-translations.ts

add-header-translations:
	$(RUNTIME) shared-fixtures/add-header-translations.ts

add-brand-translation:
	$(RUNTIME) shared-fixtures/add-brand-translation.ts

check-frontend:
	cd frontend && $(RUNTIME) run check

check-backend-types:
	cd backend && $(RUNTIME) x tsc --noEmit

check-e2e-types:
	cd e2e && $(RUNTIME) x tsc --noEmit

reset-db:
	@if [ -f backend/data/entities.sqlite ]; then \
		mkdir -p backend/data/archive; \
		cp backend/data/entities.sqlite backend/data/archive/entities-$$(date +%Y%m%d-%H%M%S).sqlite; \
		echo "Preserved the outgoing database at backend/data/archive/ before removing it."; \
	fi
	rm -f backend/data/entities.sqlite backend/data/entities.sqlite-wal backend/data/entities.sqlite-shm
	@echo "Database removed — it will reinitialize from backend/schema/*.sql on next backend start."

# Builds the User Manual PDF from its own, single, real Markdown
# source (docs/user-manual.md) — pandoc + xelatex, real, automatic
# Table of Contents, List of Figures, running headers/footers, and
# widow/orphan control, all genuinely handled by LaTeX itself, not
# hand-tracked. See docs/user-manual.md's own front matter for why
# this replaced an earlier, hand-written reportlab script.
# Real, explicit prerequisites: every chapter/appendix .md file
# build-user-manual.py actually gathers, so touching any one chapter
# genuinely makes this target stale - matching the same, established
# pattern already used for programmer-manual.
USER_MANUAL_CHAPTERS := \
	docs/user-manual-frontmatter.md \
	docs/user-manual-ch0-how-it-started.md \
	docs/user-manual-ch1-introduction.md \
	docs/user-manual-ch2-configuration.md \
	docs/user-manual-ch3-tutorial.md \
	docs/user-manual-appendix-screens.md \
	docs/user-manual-glossary.md \
	docs/user-manual-contributors-suggestions-notes.md

manual: docs/build-user-manual.py $(USER_MANUAL_CHAPTERS) manual-screenshots
	cd docs && python3 build-user-manual.py
	cd docs && pandoc user-manual.md -o ../sql-ledger-ts_User_Manual.pdf \
	  --pdf-engine=xelatex -V documentclass=book -V geometry:margin=1in \
	  -H manual-header-includes.tex -f markdown+raw_tex --resource-path=.
	@echo "Built sql-ledger-ts_User_Manual.pdf"

# Real, individual, per-screenshot targets - each depends on the
# actual +page.svelte source file(s) it captures, plus the capture
# script itself, so touching one Svelte file only invalidates the
# screenshots that genuinely depend on it, not all of them.
docs/manual-images/setup_chart_of_accounts.png: e2e/tests/capture-manual-screenshots.spec.ts frontend/src/routes/setup/chart-of-accounts/+page.svelte
	cd e2e && MANUAL_SCREEN=setup_chart_of_accounts $(RUNTIME) x playwright test capture-manual-screenshots --reporter=list

docs/manual-images/setup_periods.png: e2e/tests/capture-manual-screenshots.spec.ts frontend/src/routes/setup/periods/+page.svelte
	cd e2e && MANUAL_SCREEN=setup_periods $(RUNTIME) x playwright test capture-manual-screenshots --reporter=list

docs/manual-images/setup_translations.png: e2e/tests/capture-manual-screenshots.spec.ts frontend/src/routes/setup/translations/+page.svelte
	cd e2e && MANUAL_SCREEN=setup_translations $(RUNTIME) x playwright test capture-manual-screenshots --reporter=list

docs/manual-images/setup_users.png: e2e/tests/capture-manual-screenshots.spec.ts frontend/src/routes/setup/users/+page.svelte
	cd e2e && MANUAL_SCREEN=setup_users $(RUNTIME) x playwright test capture-manual-screenshots --reporter=list

docs/manual-images/setup_vocabulary.png: e2e/tests/capture-manual-screenshots.spec.ts frontend/src/routes/setup/vocabulary/+page.svelte
	cd e2e && MANUAL_SCREEN=setup_vocabulary $(RUNTIME) x playwright test capture-manual-screenshots --reporter=list

docs/manual-images/setup_yearend.png: e2e/tests/capture-manual-screenshots.spec.ts frontend/src/routes/setup/yearend/+page.svelte
	cd e2e && MANUAL_SCREEN=setup_yearend $(RUNTIME) x playwright test capture-manual-screenshots --reporter=list

docs/manual-images/stock_listing.png: e2e/tests/capture-manual-screenshots.spec.ts frontend/src/routes/stock/listing/+page.svelte
	cd e2e && MANUAL_SCREEN=stock_listing $(RUNTIME) x playwright test capture-manual-screenshots --reporter=list

docs/manual-images/stock_restock.png: e2e/tests/capture-manual-screenshots.spec.ts frontend/src/routes/stock/restock/+page.svelte
	cd e2e && MANUAL_SCREEN=stock_restock $(RUNTIME) x playwright test capture-manual-screenshots --reporter=list

docs/manual-images/reports_new_pl.png: e2e/tests/capture-manual-screenshots.spec.ts frontend/src/routes/reports/new-pl/+page.svelte
	cd e2e && MANUAL_SCREEN=reports_new_pl $(RUNTIME) x playwright test capture-manual-screenshots --reporter=list

docs/manual-images/reports_new_stock_on_hand.png: e2e/tests/capture-manual-screenshots.spec.ts frontend/src/routes/reports/new-stock-on-hand/+page.svelte
	cd e2e && MANUAL_SCREEN=reports_new_stock_on_hand $(RUNTIME) x playwright test capture-manual-screenshots --reporter=list

docs/manual-images/reports_old_pl.png: e2e/tests/capture-manual-screenshots.spec.ts frontend/src/routes/reports/old-pl/+page.svelte
	cd e2e && MANUAL_SCREEN=reports_old_pl $(RUNTIME) x playwright test capture-manual-screenshots --reporter=list

docs/manual-images/reports_profit_and_loss.png: e2e/tests/capture-manual-screenshots.spec.ts frontend/src/routes/reports/profit-and-loss/+page.svelte
	cd e2e && MANUAL_SCREEN=reports_profit_and_loss $(RUNTIME) x playwright test capture-manual-screenshots --reporter=list

docs/manual-images/reports_reminders.png: e2e/tests/capture-manual-screenshots.spec.ts frontend/src/routes/reports/reminders/+page.svelte
	cd e2e && MANUAL_SCREEN=reports_reminders $(RUNTIME) x playwright test capture-manual-screenshots --reporter=list

docs/manual-images/reports_sales.png: e2e/tests/capture-manual-screenshots.spec.ts frontend/src/routes/reports/sales/+page.svelte
	cd e2e && MANUAL_SCREEN=reports_sales $(RUNTIME) x playwright test capture-manual-screenshots --reporter=list

docs/manual-images/reports_statement.png: e2e/tests/capture-manual-screenshots.spec.ts frontend/src/routes/reports/statement/+page.svelte
	cd e2e && MANUAL_SCREEN=reports_statement $(RUNTIME) x playwright test capture-manual-screenshots --reporter=list

docs/manual-images/reports_stock_movement.png: e2e/tests/capture-manual-screenshots.spec.ts frontend/src/routes/reports/stock-movement/+page.svelte
	cd e2e && MANUAL_SCREEN=reports_stock_movement $(RUNTIME) x playwright test capture-manual-screenshots --reporter=list

docs/manual-images/reports_trial_balance.png: e2e/tests/capture-manual-screenshots.spec.ts frontend/src/routes/reports/trial-balance/+page.svelte
	cd e2e && MANUAL_SCREEN=reports_trial_balance $(RUNTIME) x playwright test capture-manual-screenshots --reporter=list

docs/manual-images/setup_bank_accounts.png: e2e/tests/capture-manual-screenshots.spec.ts frontend/src/routes/setup/bank-accounts/+page.svelte
	cd e2e && MANUAL_SCREEN=setup_bank_accounts $(RUNTIME) x playwright test capture-manual-screenshots --reporter=list

docs/manual-images/account_password.png: e2e/tests/capture-manual-screenshots.spec.ts frontend/src/routes/account/password/+page.svelte
	cd e2e && MANUAL_SCREEN=account_password $(RUNTIME) x playwright test capture-manual-screenshots --reporter=list

docs/manual-images/customer_terminal.png: e2e/tests/capture-manual-screenshots.spec.ts frontend/src/routes/customer-terminal/+page.svelte
	cd e2e && MANUAL_SCREEN=customer_terminal $(RUNTIME) x playwright test capture-manual-screenshots --reporter=list

docs/manual-images/editor.png: e2e/tests/capture-manual-screenshots.spec.ts frontend/src/routes/editor/+page.svelte
	cd e2e && MANUAL_SCREEN=editor $(RUNTIME) x playwright test capture-manual-screenshots --reporter=list

docs/manual-images/invoices.png: e2e/tests/capture-manual-screenshots.spec.ts frontend/src/routes/invoices/+page.svelte
	cd e2e && MANUAL_SCREEN=invoices $(RUNTIME) x playwright test capture-manual-screenshots --reporter=list

docs/manual-images/journal.png: e2e/tests/capture-manual-screenshots.spec.ts frontend/src/routes/journal/+page.svelte
	cd e2e && MANUAL_SCREEN=journal $(RUNTIME) x playwright test capture-manual-screenshots --reporter=list

docs/manual-images/reports_aged.png: e2e/tests/capture-manual-screenshots.spec.ts frontend/src/routes/reports/aged/+page.svelte
	cd e2e && MANUAL_SCREEN=reports_aged $(RUNTIME) x playwright test capture-manual-screenshots --reporter=list

docs/manual-images/reports_below_reorder.png: e2e/tests/capture-manual-screenshots.spec.ts frontend/src/routes/reports/below-reorder/+page.svelte
	cd e2e && MANUAL_SCREEN=reports_below_reorder $(RUNTIME) x playwright test capture-manual-screenshots --reporter=list

docs/manual-images/reports_cash_flow_forecast.png: e2e/tests/capture-manual-screenshots.spec.ts frontend/src/routes/reports/cash-flow-forecast/+page.svelte
	cd e2e && MANUAL_SCREEN=reports_cash_flow_forecast $(RUNTIME) x playwright test capture-manual-screenshots --reporter=list

docs/manual-images/reports_compare.png: e2e/tests/capture-manual-screenshots.spec.ts frontend/src/routes/reports/compare/+page.svelte
	cd e2e && MANUAL_SCREEN=reports_compare $(RUNTIME) x playwright test capture-manual-screenshots --reporter=list

docs/manual-images/reports_new_new_pl.png: e2e/tests/capture-manual-screenshots.spec.ts frontend/src/routes/reports/new-new-pl/+page.svelte
	cd e2e && MANUAL_SCREEN=reports_new_new_pl $(RUNTIME) x playwright test capture-manual-screenshots --reporter=list

docs/manual-images/ar_sale.png: e2e/tests/capture-manual-screenshots.spec.ts frontend/src/routes/arap/ar-sale/+page.svelte
	cd e2e && MANUAL_SCREEN=ar_sale $(RUNTIME) x playwright test capture-manual-screenshots --reporter=list

docs/manual-images/ar_receipt.png: e2e/tests/capture-manual-screenshots.spec.ts frontend/src/routes/arap/ar-receipt/+page.svelte frontend/src/lib/components/PaymentReceipt.svelte
	cd e2e && MANUAL_SCREEN=ar_receipt $(RUNTIME) x playwright test capture-manual-screenshots --reporter=list

docs/manual-images/ap_purchase.png: e2e/tests/capture-manual-screenshots.spec.ts frontend/src/routes/arap/ap-purchase/+page.svelte
	cd e2e && MANUAL_SCREEN=ap_purchase $(RUNTIME) x playwright test capture-manual-screenshots --reporter=list

docs/manual-images/ap_payment.png: e2e/tests/capture-manual-screenshots.spec.ts frontend/src/routes/arap/ap-payment/+page.svelte frontend/src/lib/components/PaymentReceipt.svelte
	cd e2e && MANUAL_SCREEN=ap_payment $(RUNTIME) x playwright test capture-manual-screenshots --reporter=list

docs/manual-images/cash_sale.png: e2e/tests/capture-manual-screenshots.spec.ts frontend/src/routes/arap/cash-sale/+page.svelte frontend/src/lib/components/CashTransaction.svelte
	cd e2e && MANUAL_SCREEN=cash_sale $(RUNTIME) x playwright test capture-manual-screenshots --reporter=list

docs/manual-images/cash_purchase.png: e2e/tests/capture-manual-screenshots.spec.ts frontend/src/routes/arap/cash-purchase/+page.svelte frontend/src/lib/components/CashTransaction.svelte
	cd e2e && MANUAL_SCREEN=cash_purchase $(RUNTIME) x playwright test capture-manual-screenshots --reporter=list

docs/manual-images/projects.png: e2e/tests/capture-manual-screenshots.spec.ts frontend/src/routes/projects/+page.svelte
	cd e2e && MANUAL_SCREEN=projects $(RUNTIME) x playwright test capture-manual-screenshots --reporter=list

docs/manual-images/hr_wages.png: e2e/tests/capture-manual-screenshots.spec.ts frontend/src/routes/hr/+page.svelte
	cd e2e && MANUAL_SCREEN=hr_wages $(RUNTIME) x playwright test capture-manual-screenshots --reporter=list

docs/manual-images/write_offs.png: e2e/tests/capture-manual-screenshots.spec.ts frontend/src/routes/stock/write-offs/+page.svelte
	cd e2e && MANUAL_SCREEN=write_offs $(RUNTIME) x playwright test capture-manual-screenshots --reporter=list

docs/manual-images/stock_take.png: e2e/tests/capture-manual-screenshots.spec.ts frontend/src/routes/stock/stock-take/+page.svelte
	cd e2e && MANUAL_SCREEN=stock_take $(RUNTIME) x playwright test capture-manual-screenshots --reporter=list

docs/manual-images/stock_transfer.png: e2e/tests/capture-manual-screenshots.spec.ts frontend/src/routes/stock/transfer/+page.svelte
	cd e2e && MANUAL_SCREEN=stock_transfer $(RUNTIME) x playwright test capture-manual-screenshots --reporter=list

docs/manual-images/stock_dispatch.png: e2e/tests/capture-manual-screenshots.spec.ts frontend/src/routes/stock/stock-dispatch/+page.svelte
	cd e2e && MANUAL_SCREEN=stock_dispatch $(RUNTIME) x playwright test capture-manual-screenshots --reporter=list

docs/manual-images/stock_receipt.png: e2e/tests/capture-manual-screenshots.spec.ts frontend/src/routes/stock/stock-receipt/+page.svelte
	cd e2e && MANUAL_SCREEN=stock_receipt $(RUNTIME) x playwright test capture-manual-screenshots --reporter=list

docs/manual-images/sales_order.png: e2e/tests/capture-manual-screenshots.spec.ts frontend/src/routes/stock/so/+page.svelte
	cd e2e && MANUAL_SCREEN=sales_order $(RUNTIME) x playwright test capture-manual-screenshots --reporter=list

docs/manual-images/general_journal.png: e2e/tests/capture-manual-screenshots.spec.ts frontend/src/routes/post/+page.svelte
	cd e2e && MANUAL_SCREEN=general_journal $(RUNTIME) x playwright test capture-manual-screenshots --reporter=list

docs/manual-images/pos_terminal.png: e2e/tests/capture-manual-screenshots.spec.ts frontend/src/routes/pos/+page.svelte
	cd e2e && MANUAL_SCREEN=pos_terminal $(RUNTIME) x playwright test capture-manual-screenshots --reporter=list

docs/manual-images/purchase_order.png: e2e/tests/capture-manual-screenshots.spec.ts frontend/src/routes/stock/po/+page.svelte
	cd e2e && MANUAL_SCREEN=purchase_order $(RUNTIME) x playwright test capture-manual-screenshots --reporter=list

docs/manual-images/m_multi_location_schedule.png: e2e/tests/capture-manual-screenshots.spec.ts frontend/src/routes/setup/business-setup/+page.svelte
	cd e2e && MANUAL_SCREEN=m_multi_location_schedule $(RUNTIME) x playwright test capture-manual-screenshots --reporter=list

docs/manual-images/m_contact_persons.png: e2e/tests/capture-manual-screenshots.spec.ts frontend/src/routes/contacts/+page.svelte
	cd e2e && MANUAL_SCREEN=m_contact_persons $(RUNTIME) x playwright test capture-manual-screenshots --reporter=list

docs/manual-images/m_balance_sheet.png: e2e/tests/capture-manual-screenshots.spec.ts frontend/src/routes/reports/balance-sheet/+page.svelte
	cd e2e && MANUAL_SCREEN=m_balance_sheet $(RUNTIME) x playwright test capture-manual-screenshots --reporter=list

docs/manual-images/m_items_new_category_full.png: e2e/tests/capture-manual-screenshots.spec.ts frontend/src/routes/items/+page.svelte
	cd e2e && MANUAL_SCREEN=m_items_new_category_full $(RUNTIME) x playwright test capture-manual-screenshots --reporter=list

docs/manual-images/m_locations.png: e2e/tests/capture-manual-screenshots.spec.ts frontend/src/routes/locations/+page.svelte
	cd e2e && MANUAL_SCREEN=m_locations $(RUNTIME) x playwright test capture-manual-screenshots --reporter=list

docs/manual-images/m_business_setup.png: e2e/tests/capture-manual-screenshots.spec.ts frontend/src/routes/setup/business-setup/+page.svelte
	cd e2e && MANUAL_SCREEN=m_business_setup $(RUNTIME) x playwright test capture-manual-screenshots --reporter=list

docs/manual-images/m_new_business.png: e2e/tests/capture-manual-screenshots.spec.ts frontend/src/routes/setup/new-business/+page.svelte
	cd e2e && MANUAL_SCREEN=m_new_business $(RUNTIME) x playwright test capture-manual-screenshots --reporter=list

docs/manual-images/m_configuration_landing.png: e2e/tests/capture-manual-screenshots.spec.ts frontend/src/routes/setup/+page.svelte
	cd e2e && MANUAL_SCREEN=m_configuration_landing $(RUNTIME) x playwright test capture-manual-screenshots --reporter=list

docs/manual-images/m_login.png: e2e/tests/capture-manual-screenshots.spec.ts frontend/src/routes/login/+page.svelte
	cd e2e && MANUAL_SCREEN=m_login $(RUNTIME) x playwright test capture-manual-screenshots --reporter=list

docs/manual-images/m_home.png: e2e/tests/capture-manual-screenshots.spec.ts frontend/src/routes/+page.svelte
	cd e2e && MANUAL_SCREEN=m_home $(RUNTIME) x playwright test capture-manual-screenshots --reporter=list

docs/manual-images/m_choose_business.png: e2e/tests/capture-manual-screenshots.spec.ts frontend/src/routes/session/+page.svelte
	cd e2e && MANUAL_SCREEN=m_choose_business $(RUNTIME) x playwright test capture-manual-screenshots --reporter=list

# Real, live screenshot capture for the manual, in each real,
# supported language — a real, shared Playwright script
# (e2e/tests/capture-manual-screenshots.spec.ts), driven by a real,
# direct MANUAL_LANGUAGE environment variable, so the same, one real
# script produces the real, correct set for whichever language is
# asked for, rather than four, separate, near-duplicate scripts. Each
# real target also runs the real, direct crop step the tall Parts
# Catalog screenshot needs.
manual-screenshots:
	cd e2e && MANUAL_LANGUAGE=English $(RUNTIME) x playwright test capture-manual-screenshots --reporter=list
	cd docs && python3 crop-parts-screenshot.py

manual-screenshots-german:
	cd e2e && MANUAL_LANGUAGE=German $(RUNTIME) x playwright test capture-manual-screenshots --reporter=list
	cd docs && python3 crop-parts-screenshot.py -german

manual-screenshots-french:
	cd e2e && MANUAL_LANGUAGE=French $(RUNTIME) x playwright test capture-manual-screenshots --reporter=list
	cd docs && python3 crop-parts-screenshot.py -french

manual-screenshots-danish:
	cd e2e && MANUAL_LANGUAGE=Danish $(RUNTIME) x playwright test capture-manual-screenshots --reporter=list
	cd docs && python3 crop-parts-screenshot.py -danish

manual-screenshots-italian:
	cd e2e && MANUAL_LANGUAGE=Italian $(RUNTIME) x playwright test capture-manual-screenshots --reporter=list
	cd docs && python3 crop-parts-screenshot.py -italian

# Assembles and builds the real, complete Programmer's Manual — a
# real, direct concatenation of this project's own, already-existing,
# real technical documents (docs/build-programmer-manual.py), then the
# exact, same, real pandoc + LaTeX pipeline the User Manual itself
# uses (its own, separate, correctly-titled running header/footer —
# docs/programmer-manual-header-includes.tex).
# Real, explicit prerequisites: every chapter .md file
# build-programmer-manual.py actually gathers, so touching any one
# chapter genuinely makes this target stale - not just the assembler
# script itself.
PROGRAMMER_MANUAL_CHAPTERS := \
	docs/business-evolution-plan.md \
	docs/cash-flow-and-growth-planning.md \
	docs/chart-of-accounts-hierarchy-editor-plan.md \
	docs/coa-class-instance-plan.md \
	docs/coding-standards.md \
	docs/cold-shelf-storage-inventory-model-plan.md \
	docs/contact-types-and-translations.md \
	docs/css-styling-and-data-entry.md \
	docs/entity-chains.md \
	docs/entity-identity-resolution.md \
	docs/entity-model.md \
	docs/expansion-walker-design.md \
	docs/foreign-currency-receipts-and-payments.md \
	docs/lessons-learned.md \
	docs/menu-as-entity-tree-plan.md \
	docs/money-model.md \
	docs/multi-dimensional-reporting.md \
	docs/multicurrency-design.md \
	docs/one-file-per-page-consolidation-plan.md \
	docs/orm-and-commit-path.md \
	docs/pglite-migration-plan.md \
	docs/programmer-tooling.md \
	docs/scoped-uniqueness-and-location-accounting.md \
	docs/screens-inventory.md \
	docs/screens-staging-triggers-functions.md \
	docs/simulation-prompt.md \
	docs/skill-sql-ledger-ui-conventions.md \
	docs/skill-wine-retail-e2e-and-docs.md \
	docs/skill-git-history-safety.md \
	docs/skill-makefile-only-execution.md \
	docs/skill-backend-first-testing.md \
	docs/skill-manual-as-source-of-truth.md \
	docs/skill-test-driven-development.md \
	docs/skill-design-driven-development.md \
	docs/skill-continual-skill-improvement.md \
	docs/skill-explicit-skill-attribution.md \
	docs/skill-test-writing-standard.md \
	docs/skill-skill-review-after-failure.md \
	docs/skill-no-new-tables.md \
	docs/skill-documentation-coverage-enforcement.md \
	docs/skill-pattern-recognition-to-tooling.md \
	docs/documentation-coverage-baseline.md \
	docs/sql-ledger-comparison.md \
	docs/svelte-5-runes-migration-plan.md \
	docs/svelte-usage.md \
	docs/testing.md \
	docs/translator-form-and-guard-rails-plan.md \
	docs/ui-completeness-plan.md \
	docs/user-manual-plan.md \
	docs/vocabulary-vs-sample-data.md \
	docs/wine-bar-assemblies-plan.md \
	docs/construction-project-management-plan.md \
	docs/stock-lifecycle-review-plan.md \
	docs/min-e2e-coverage-plan.md \
	docs/border-multicurrency-pos-plan.md \
	docs/inventory-lifecycle-blow-by-blow.md \
	docs/file-inventory-appendix.md

# docs/screens-staging-triggers-functions.md references 17 specific
# screenshots directly - a real, explicit Make dependency, so this
# chapter is genuinely stale if any of them are missing or updated.
docs/screens-staging-triggers-functions.md: \
	docs/manual-images/ar_sale.png \
	docs/manual-images/ar_receipt.png \
	docs/manual-images/ap_purchase.png \
	docs/manual-images/ap_payment.png \
	docs/manual-images/cash_sale.png \
	docs/manual-images/cash_purchase.png \
	docs/manual-images/pos_terminal.png \
	docs/manual-images/general_journal.png \
	docs/manual-images/purchase_order.png \
	docs/manual-images/sales_order.png \
	docs/manual-images/stock_receipt.png \
	docs/manual-images/stock_dispatch.png \
	docs/manual-images/stock_transfer.png \
	docs/manual-images/stock_take.png \
	docs/manual-images/write_offs.png \
	docs/manual-images/hr_wages.png \
	docs/manual-images/projects.png

# The same, real, explicit treatment for the 5 other real,
# screenshot-embedding chapters found to be missing it - confirmed
# directly, per direct request, none of these had individual Make
# dependencies on their own specific screenshots before this.
docs/user-manual-ch1-introduction.md: \
	docs/manual-images/m_login.png \
	docs/manual-images/m_choose_business.png \
	docs/manual-images/m_home.png

docs/user-manual-ch2-configuration.md: \
	docs/manual-images/m_configuration_landing.png \
	docs/manual-images/m_new_business.png \
	docs/manual-images/m_business_setup.png \
	docs/manual-images/m_multi_location_schedule.png \
	docs/manual-images/m_locations.png \
	docs/manual-images/m_parts_cropped.png \
	docs/manual-images/storage_origin_verified.png \
	docs/manual-images/m_po_supplier_matching.png \
	docs/manual-images/m_balance_sheet.png \
	docs/manual-images/m_contact_persons.png

docs/user-manual-ch3-tutorial.md: \
	docs/manual-images/t01_login_landing.png \
	docs/manual-images/t02_new_business_form.png \
	docs/manual-images/t03_new_business_created.png \
	docs/manual-images/t04_locations_empty.png \
	docs/manual-images/t05_locations_new_form.png \
	docs/manual-images/t06_locations_created.png \
	docs/manual-images/t07_business_setup_landing.png \
	docs/manual-images/t08_first_division_created.png \
	docs/manual-images/t09_first_warehouse_created.png \
	docs/manual-images/t10_first_employee_created.png \
	docs/manual-images/t11_items_empty.png \
	docs/manual-images/t12_new_category_and_product_form.png \
	docs/manual-images/t13_first_product_created.png \
	docs/manual-images/t14_general_journal_empty.png \
	docs/manual-images/t15_general_journal_filled.png \
	docs/manual-images/t16_general_journal_posted.png \
	docs/manual-images/t17_trial_balance_after_first_transaction.png

docs/user-manual-appendix-screens.md: \
	docs/manual-images/pos_terminal.png \
	docs/manual-images/general_journal.png \
	docs/manual-images/ar_sale.png \
	docs/manual-images/ar_receipt.png \
	docs/manual-images/sales_order.png \
	docs/manual-images/stock_dispatch.png \
	docs/manual-images/ap_purchase.png \
	docs/manual-images/ap_payment.png \
	docs/manual-images/purchase_order.png \
	docs/manual-images/stock_receipt.png \
	docs/manual-images/stock_take.png \
	docs/manual-images/write_offs.png \
	docs/manual-images/cash_sale.png \
	docs/manual-images/cash_purchase.png \
	docs/manual-images/hr_wages.png \
	docs/manual-images/stock_transfer.png \
	docs/manual-images/projects.png

docs/scoped-uniqueness-and-location-accounting.md: \
	docs/manual-images/pm_new_new_pl_location_axis.png \
	docs/manual-images/pm_translations_add_word.png

programmer-manual: docs/build-programmer-manual.py $(PROGRAMMER_MANUAL_CHAPTERS)
	cd docs && python3 build-programmer-manual.py
	cd docs && pandoc programmer-manual.md -o ../sql-ledger-ts_Programmer_Manual.pdf \
	  --pdf-engine=xelatex -V documentclass=book -V geometry:margin=1in \
	  -H programmer-manual-header-includes.tex -f markdown+raw_tex --resource-path=.
	@echo "Built sql-ledger-ts_Programmer_Manual.pdf"

# Renders a real, complete, vector (SVG) illustration of the entire,
# live entity tree -- every real (id, name, parent_id) triple, plus
# every real, labelled relationship link, overlaid as dashed edges.
# Requires `dot` (graphviz) on PATH; run against whatever database is
# currently loaded, so a genuinely minimal, freshly-reset database
# produces a genuinely minimal tree.
entity-tree-svg:
	cd backend && $(RUNTIME) scripts/generate-entity-tree-svg.ts ../entity_tree.svg
	@echo "Built entity_tree.svg"
# A real, generic, reusable search across real source files, per the
# absolute Makefile-only-execution rule - replaces ad-hoc grep.
# Usage: make search PATTERN=foo [DIR=frontend/src]
search:
	@if [ -z "$(PATTERN)" ]; then echo "Usage: make search PATTERN=<pattern> [DIR=<dir>]"; exit 1; fi
	grep -rn "$(PATTERN)" $(if $(DIR),$(DIR),backend/src backend/scripts frontend/src shared-fixtures docs Makefile) 2>/dev/null || echo "(no matches)"

# A real, permanent, repeatable checkpoint: commit + a real, verified
# git bundle + a real zip, all in one command, replacing what had been
# several, separate, manual steps. The real, detailed commit message
# goes in COMMIT_MSG.txt (not a single-line Make variable) - write that
# file first, then run this. CHECKPOINT must be set to a real,
# sequential number (e.g. `make checkpoint CHECKPOINT=274`).
# A real, generic, reusable correction: removes a file from git
# tracking (e.g. one that should have been gitignored from the start)
# without deleting it from disk. Usage: make untrack FILE=<path>
untrack:
	@if [ -z "$(FILE)" ]; then echo "Usage: make untrack FILE=<path>"; exit 1; fi
	git rm --cached "$(FILE)"
	git commit -m "Untrack $(FILE) - should have been gitignored from the start"

checkpoint:
	@if [ -z "$(CHECKPOINT)" ]; then echo "Usage: make checkpoint CHECKPOINT=<number> (after writing COMMIT_MSG.txt)"; exit 1; fi
	@if [ ! -f COMMIT_MSG.txt ]; then echo "Write the real, detailed commit message to COMMIT_MSG.txt first."; exit 1; fi
	rm -f backend/data/entities.sqlite backend/data/entities.sqlite-wal backend/data/entities.sqlite-shm
	git add -A
	git commit -F COMMIT_MSG.txt
	rm -f COMMIT_MSG.txt
	git bundle create /tmp/sql-ledger-ts_$(CHECKPOINT).bundle --all --quiet
	cp /tmp/sql-ledger-ts_$(CHECKPOINT).bundle /mnt/user-data/outputs/sql-ledger-ts_$(CHECKPOINT).bundle
	rm -rf /tmp/checkpoint-verify
	git clone -q /mnt/user-data/outputs/sql-ledger-ts_$(CHECKPOINT).bundle /tmp/checkpoint-verify
	cd /tmp/checkpoint-verify && git log --oneline -1
	rm -rf /tmp/checkpoint-verify
	rm -f /mnt/user-data/outputs/sql-ledger-ts_$(CHECKPOINT).zip
	cd .. && zip -rq /mnt/user-data/outputs/sql-ledger-ts_$(CHECKPOINT).zip sql-ledger-ts \
	  -x "*/node_modules/*" "*/.svelte-kit/*" "*/.git/*" "*/__pycache__/*" \
	     "*/data/*.sqlite-wal" "*/data/*.sqlite-shm" "*/data/archive/*" \
	     "*/e2e/test-results/*" "*/playwright-report/*" "*/test-results/*" \
	     "*/docs/manual-images*" "*.pdf"
	@echo "Checkpoint $(CHECKPOINT): committed, bundled, and zipped."

