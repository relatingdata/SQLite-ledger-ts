.PHONY: all install clean seed dev dev-no-demo dev-verbose backend load-translations-api load-translations-ui backend-verbose frontend test test-e2e test-e2e-tutorial test-e2e-tutorial-browser test-e2e-tutorial-docs e2e-spec-tutorial e2e-spec-all reset-db manual programmer-manual historical-manual entity-tree-svg check-db-consistency check-node-refs verify-fresh checkpoint untrack search list-menu-labels add-menu-translations add-journal-translations e2e-spec-one check-frontend add-journal-remaining-translations add-header-translations check-backend-types check-unused add-brand-translation branch check-e2e-types proof-year-end e2e-spec-smoke check-docs-coverage call-graph svelte-call-trace source-reference manual-diagrams servers-status ensure-servers ensure-servers-no-demo stop-servers documentation-baseline-report check-schema-table-count screens-inventory role-routes-matrix check-no-python analyze-classification measure-comments show-comments find-symbols find-uses function-inventory check-function-inventory explain-function comment-out-functions rename-identifiers sim-golden check-sim-unchanged knip check-cycles cycles-baseline dependency-graph analyze-vocabulary strip-comments check-test-docs test-docs-baseline test-one release

# A real, direct, explicit RUNTIME variable, per direct instruction:
# some real, potential customers' own corporate policy insists on
# node or deno, not bun - override on the command line, e.g.
# `make test RUNTIME=node` or `make dev RUNTIME=deno`. Every other
# variable below is genuinely derived from this one, real switch -
# never hardcode a runtime-specific command anywhere else in this
# file; add a new derived variable here instead. All three verified
# directly, end to end: the full backend test suite passes under
# bun, node (via tsx), and deno (via its own, real Node compatibility
# layer) alike - 173/173 each, confirmed by actually running it under
# each real runtime, not assumed from documentation.
RUNTIME ?= node

ifeq ($(RUNTIME),bun)
  RUN_INSTALL   := bun install
  RUN_SCRIPT    := bun
  RUN_NPM_SCRIPT := bun run
  RUN_BINARY    := bun x
  RUN_TEST      := bun test
else ifeq ($(RUNTIME),node)
  RUN_INSTALL   := npm install
  RUN_SCRIPT    := npx tsx
  RUN_NPM_SCRIPT := npm run
  RUN_BINARY    := npx
  RUN_TEST      := npx tsx --test
else ifeq ($(RUNTIME),deno)
  # --no-check: this project's own check-backend-types/check-e2e-types
  # targets are the one, real, dedicated place type errors are
  # caught - deno's own, additional, real type-checking pass (stricter
  # in several, real, confirmed ways - e.g. it does not permit a bare
  # number literal where a real, branded UserId is expected, unlike
  # bun/tsx at runtime) would otherwise fail on hundreds of real,
  # pre-existing, deliberately-terse test call sites never intended to
  # satisfy it.
  RUN_INSTALL   := deno install --allow-scripts
  RUN_SCRIPT    := deno run -A --no-check
  RUN_NPM_SCRIPT := deno task
  RUN_BINARY    := sh $(CURDIR)/scripts/deno-run-bin.sh
  RUN_TEST      := deno test -A --no-check
else
  $(error Unknown RUNTIME "$(RUNTIME)" - expected bun, node, or deno)
endif

# Builds everything the project produces: a fresh install, the full
# test suite, and all three real manuals (User, Programmer, and the
# full Historical Design & Decision Log the Programmer's Manual was
# trimmed from) - a genuine, single command matching the common
# Makefile 'all' convention.
all: install test manual programmer-manual historical-manual

# One real, single, root-level install, per direct instruction: this
# project is a genuine bun workspace (backend/frontend/e2e all listed
# in the root package.json's own "workspaces" array) - one real,
# shared node_modules at the root, not three separate ones.
install:
	$(RUN_INSTALL)

clean:
	rm -rf node_modules package-lock.json bun.lockb
	rm -rf frontend/.svelte-kit
	rm -f sql-ledger-ts_User_Manual.pdf sql-ledger-ts_Programmer_Manual.pdf sql-ledger-ts_Historical_Design_Log.pdf
	rm -f docs/programmer-manual.md docs/old/historical-manual.md
	rm -rf docs/manual-images docs/manual-images-german docs/manual-images-french docs/manual-images-danish docs/manual-images-italian

dev:
	@echo "Starting backend (:3001) and frontend (:5173) — Ctrl+C stops both."
	@( \
	  cd backend && $(RUN_NPM_SCRIPT) dev & \
	  BACKEND_PID=$$!; \
	  cd frontend && $(RUN_NPM_SCRIPT) dev & \
	  FRONTEND_PID=$$!; \
	  trap "kill $$BACKEND_PID $$FRONTEND_PID 2>/dev/null" EXIT INT TERM; \
	  wait \
	)

# Historically started a backend with SEED_DEMO_BUSINESSES=false to
# get only the one, real, dummy "admin" business, no Wine Retail
# Business pre-populated. That flag, and all demo-business seeding at
# boot, has since been removed entirely (per
# docs/api-e2e-readiness-and-seed-separation-plan.md) — the
# application's own basic initial data load (schema/00-core.sql) now
# NEVER contains a demo business, so plain `make dev` already gives
# you exactly this. Kept as a documented alias so old muscle memory
# still works. To build a real demo business on top of this, use the
# real, in-process scripts/simulate-wine-retail-month.ts (or drive it
# through the UI/API yourself) — never schema seeding.
dev-no-demo: dev

# The two, genuinely foreign demo businesses this project once seeded
# at boot (BMW M GmbH / Peugeot Citroën Sochaux SNC via the deleted
# 20-demo-bmw-peugeot.sql, and Ditta Italiana Srl / Schweizer KMU AG
# via the deleted 20-demo-italian-swiss.sql) have no builder at all
# any more — their schema files and db.ts's SEED_FOREIGN_BUSINESSES
# flag were deleted outright per direct instruction, and no
# simulate-*-style TypeScript script was written to replace them (the
# pattern scripts/simulate-wine-retail-month.ts already proves for
# Wine Retail Business). This is a known, intentionally undecided
# gap — see docs/api-e2e-readiness-and-seed-separation-plan.md §2.6 —
# not something `make dev-with-foreign` can paper over any more, so
# that target has been removed rather than left pointing at a flag
# that no longer does anything.

dev-verbose:
	@echo "Starting backend (:3001, every SQL statement printed) and frontend (:5173) — Ctrl+C stops both."
	@( \
	  cd backend && DB_VERBOSE=1 $(RUN_NPM_SCRIPT) dev & \
	  BACKEND_PID=$$!; \
	  cd frontend && $(RUN_NPM_SCRIPT) dev & \
	  FRONTEND_PID=$$!; \
	  trap "kill $$BACKEND_PID $$FRONTEND_PID 2>/dev/null" EXIT INT TERM; \
	  wait \
	)

backend:
	cd backend && $(RUN_NPM_SCRIPT) dev

backend-verbose:
	cd backend && DB_VERBOSE=1 $(RUN_NPM_SCRIPT) dev

frontend:
	cd frontend && $(RUN_NPM_SCRIPT) dev

test:
	cd backend && $(RUN_TEST) test/*.test.ts scripts/*.test.ts
	cd frontend && $(RUN_TEST) test/*.test.ts

# End-to-end verification against real, deterministic business data —
# genuinely different from `test` above (which only exercises small,
# synthetic scenarios). Resets the database, runs the real Wine Retail
# Company simulation (a seeded PRNG, never Math.random() — always
# produces exactly the same numbers), then checks the result against
# exact, documented expected figures (see docs/testing.md). A real
# regression in a posting path, closeBooks, or a report silently
# excluding real accounts fails loudly here with a non-zero exit code.
test-e2e: reset-db
	@echo "Running the real Wine Retail Business simulation (deterministic — same numbers every time)..."
	cd backend && $(RUN_SCRIPT) scripts/simulate-wine-retail-month.ts
	@echo ""
	@echo "Verifying against exact, documented expected results..."
	cd backend && $(RUN_SCRIPT) scripts/verify-simulation.ts

# The real, augmented tutorial fixture (shared-fixtures/tutorial-steps.csv),
# run via the fast, direct API path - no browser, no running servers
# needed, since runStepViaApi calls the real backend functions directly.
# This fixture creates its own, real "Tutorial Wine Retail Business"
# from scratch and genuinely never wants any other demo business
# pre-seeded alongside it. Historically needed SEED_DEMO_BUSINESSES=
# false to avoid a real demo-seed bug in migrateForWineRetailDemoData;
# that whole code path (and flag) is gone now — boot never seeds a
# demo business at all — so there is nothing left to guard against
# here.
test-e2e-tutorial: reset-db
	@echo "Running the real, augmented tutorial fixture via the API path..."
	cd backend && $(RUN_SCRIPT) scripts/step-runner.ts ../shared-fixtures/tutorial-steps.csv --path api --non-interactive

# The exact, same, real tutorial fixture, driven through an actual,
# real, live browser instead - genuinely proving the real UI screens
# themselves, not just the backend functions behind them.
test-e2e-tutorial-browser: reset-db ensure-servers
	@echo "Running the real, augmented tutorial fixture via the real, driven UI path..."
	cd backend && $(RUN_SCRIPT) scripts/step-runner.ts ../shared-fixtures/tutorial-steps.csv --path ui --non-interactive

# The one, real, test-runner-driven way every non-English translation
# in shared-fixtures/translations.csv is ever loaded into a running
# instance - per direct instruction, no separate script of any kind
# does this; shared-fixtures/translations-steps.csv (+ its own
# .control.csv) is this fixture's own, real, positional data file,
# read by the exact, same step-runner.ts every other real fixture
# already uses. Fast (no browser) - calls db.ts's own setTranslation/
# createEntityRaw directly, in-process. A handful of real, pre-
# existing, genuine translation ambiguities (two different English
# concepts that really do share one translated word, e.g. "Continue"
# and "Next" both meaning "Weiter" in German) are expected to fail
# their own translation_matches verify - logged, not silently
# resolved, see docs/flagged-translation-collisions.log.
load-translations-api: reset-db
	@echo "Loading every real translation via the API path..."
	cd backend && $(RUN_SCRIPT) scripts/step-runner.ts ../shared-fixtures/translations-steps.csv --path api --non-interactive

# The exact, same, real fixture, driven through an actual, real, live
# browser instead - proving the real /setup/translations screen
# itself (search, select, per-language Save), not just the backend
# function behind it. Slower - one real page interaction per real
# translation.
load-translations-ui: reset-db ensure-servers
	@echo "Loading every real translation via the real, driven UI path..."
	cd backend && $(RUN_SCRIPT) scripts/step-runner.ts ../shared-fixtures/translations-steps.csv --path ui --non-interactive

# A real, minimal, fast, backend-only proof of a complete business
# lifecycle: locations of each real type, staff, an assembly, a full
# order->receive->transfer->sell->stocktake->year-end-close cycle. No
# browser - per backend-first-testing, this is the right level to
# prove this at.
proof-year-end: reset-db
	@echo "Running the real, minimal year-end lifecycle proof..."
	cd backend && $(RUN_SCRIPT) scripts/proof-year-end-lifecycle.ts

# Per direct instruction: shares the exact same real, already-populated
# database test-e2e itself creates - simulate-wine-retail-month.ts runs
# first, then the driven browser test verifies every real language is
# present and exercises the UI against that same, real, already-built
# business, rather than rebuilding it from scratch via slow UI clicks.
test-e2e-browser-languages: reset-db
	cd backend && $(RUN_SCRIPT) scripts/simulate-wine-retail-month.ts
	cd e2e && $(RUN_NPM_SCRIPT) browser-run -- test full-e2e-with-languages --reporter=list
	@echo ""

# Real, end-to-end browser tests — genuinely different from test-e2e
# above (a backend-only, headless simulation). This drives an actual
# browser through the actual running app. The browser test runner's
# own config, in e2e/, already starts both the
# backend and frontend dev servers itself if they aren't already
# running — no need to `make dev` first. Always resets the database
# first, since the tutorial genuinely creates a new business (Wine
# Retail Company itself) from scratch and expects a clean starting
# point — boot itself never seeds any demo business any more, so
# there's nothing left to additionally suppress here.
e2e-spec-tutorial: reset-db
	@echo "Running the real Wine Retail Business tutorial walkthrough in a real browser, built entirely from scratch (login through the first General Journal transaction)..."
	cd e2e && $(RUN_NPM_SCRIPT) browser-run -- test tutorial-walkthrough --reporter=list

# The full, real driven browser-test suite — every real .spec.ts file
# in e2e/tests. Takes several minutes. Use e2e-spec-tutorial above
# for a quick, targeted check instead.
e2e-spec-all: reset-db
	@echo "Running the full, real driven browser-test suite..."
	cd e2e && $(RUN_NPM_SCRIPT) browser-run -- test --reporter=list

# A real, generic, reusable target for running one, specific, named
# browser test against whatever is already running - does NOT
# reset the database, per the many real cases (a screenshot for
# approval, a targeted regression check) where the current, live data
# is exactly what's needed. Usage: make e2e-spec-one TEST=<name>
e2e-spec-one:
	@if [ -z "$(TEST)" ]; then echo "Usage: make e2e-spec-one TEST=<spec-file-name>"; exit 1; fi
	cd e2e && $(RUN_NPM_SCRIPT) browser-run -- test $(TEST) --reporter=list --workers=1

# A real, direct, explicit way to know whether the real backend/
# frontend dev servers are already up and genuinely healthy - not
# just "a process happens to exist," but a real pid file recording
# which process this Makefile itself started, AND a real, live
# curl health check confirming it actually, currently answers. A
# stale pid file (the server crashed, the machine rebooted, the pid
# got reused by something else entirely) is correctly treated as "not
# running" either way. Real, direct answer to "is the backend up and
# healthy" without guessing from `ps` output or trusting a pid alone.
PID_DIR ?= /tmp/sql-ledger-ts-pids
BACKEND_PID := $(PID_DIR)/backend.pid
FRONTEND_PID := $(PID_DIR)/frontend.pid

define BACKEND_HEALTHY
[ -f $(BACKEND_PID) ] && kill -0 $$(cat $(BACKEND_PID)) 2>/dev/null && curl -sf http://localhost:3001/api/health > /dev/null 2>&1
endef
define FRONTEND_HEALTHY
[ -f $(FRONTEND_PID) ] && kill -0 $$(cat $(FRONTEND_PID)) 2>/dev/null && curl -sf http://localhost:5173 > /dev/null 2>&1
endef

servers-status:
	@mkdir -p $(PID_DIR)
	@if $(BACKEND_HEALTHY); then echo "backend: healthy (pid $$(cat $(BACKEND_PID)))"; else echo "backend: not running/healthy"; fi
	@if $(FRONTEND_HEALTHY); then echo "frontend: healthy (pid $$(cat $(FRONTEND_PID)))"; else echo "frontend: not running/healthy"; fi

# Starts only whichever real server (if either) isn't already up and
# healthy - a perfectly good, already-running server is never
# unnecessarily stopped and restarted, the exact real cost this
# target exists to avoid across dozens of, e.g., capture-manual-
# screenshots calls in a row. Real pid files recorded so a later call
# (by this target, by stop-servers, or by a person checking
# servers-status directly) finds the exact, same, real process again.
ensure-servers:
	@mkdir -p $(PID_DIR)
	@if $(BACKEND_HEALTHY); then \
	  echo "backend already healthy, reusing (pid $$(cat $(BACKEND_PID)))"; \
	else \
	  echo "starting backend..."; \
	  ( cd backend && setsid nohup $(RUN_NPM_SCRIPT) dev > /tmp/sql-ledger-ts-backend.log 2>&1 < /dev/null & echo $$! > $(BACKEND_PID) ); \
	  for i in $$(seq 1 30); do curl -sf http://localhost:3001/api/health > /dev/null 2>&1 && break; sleep 1; done; \
	fi
	@if $(FRONTEND_HEALTHY); then \
	  echo "frontend already healthy, reusing (pid $$(cat $(FRONTEND_PID)))"; \
	else \
	  echo "starting frontend..."; \
	  ( cd frontend && setsid nohup $(RUN_NPM_SCRIPT) dev > /tmp/sql-ledger-ts-frontend.log 2>&1 < /dev/null & echo $$! > $(FRONTEND_PID) ); \
	  for i in $$(seq 1 30); do curl -sf http://localhost:5173 > /dev/null 2>&1 && break; sleep 1; done; \
	fi

# Historically a distinct, SEED_DEMO_BUSINESSES=false detached-server
# variant of ensure-servers, for driving the real UI path against a
# database with only the one, real, dummy "admin" business. Now that
# boot itself never seeds any demo business at all (that whole flag
# and code path were removed per direct instruction), there is no
# longer any real difference between the two — kept as a documented
# alias so existing targets (test-e2e-tutorial-browser, step-runner's
# own `--path ui`, etc.) that depend on it by name keep working.
ensure-servers-no-demo: ensure-servers
	@true

stop-servers:
	@if [ -f $(BACKEND_PID) ]; then \
	  PID=$$(cat $(BACKEND_PID)); \
	  kill -- -$$PID 2>/dev/null || kill $$PID 2>/dev/null || true; \
	  rm -f $(BACKEND_PID); echo "backend stopped"; \
	fi
	@if [ -f $(FRONTEND_PID) ]; then \
	  PID=$$(cat $(FRONTEND_PID)); \
	  kill -- -$$PID 2>/dev/null || kill $$PID 2>/dev/null || true; \
	  rm -f $(FRONTEND_PID); echo "frontend stopped"; \
	fi
	@sh scripts/safe-pkill.sh "tsx watch src/server.ts"
	@sh scripts/safe-pkill.sh "vite dev"

# A real, fast, minimal smoke layer - every real route visited once,
# checking only that it loads without a real, unhandled error. See
# docs/min-e2e-coverage-plan.md for the full, real rationale. Distinct
# from e2e-spec-all (the full, detailed, existing suite) and
# e2e-spec-tutorial (the from-scratch business walkthrough).
e2e-spec-smoke:
	cd e2e && $(RUN_NPM_SCRIPT) browser-run -- test min-e2e-route-smoke --reporter=list --workers=1

# The full, real demo dataset: one detailed month (as above) plus a
# real, 12-month Budget and 11 more real, summary-level Actual months
# either side of it, so a full year's real Budget vs. Actual
# comparison exists. Kept as its own, separate target — not part of
# test-e2e above — since it changes real, exact figures test-e2e's own
# verify-simulation.ts checks against; run this when you want the
# fuller dataset to explore, not as part of routine verification.
demo-full-year: reset-db
	@echo "Running the real Wine Retail Business simulation..."
	cd backend && $(RUN_SCRIPT) scripts/simulate-wine-retail-month.ts
	@echo ""
	@echo "Adding a real Budget and 11 more real Actual months..."
	cd backend && $(RUN_SCRIPT) scripts/add-wine-retail-budget-and-year.ts
	@echo ""
	@echo "Setting real, varied payment terms and credit limits..."
	cd backend && $(RUN_SCRIPT) scripts/set-wine-retail-credit-terms.ts
	@echo ""

	@echo "Checking database consistency (balanced entries, no orphans, referential integrity)..."
	cd backend && $(RUN_SCRIPT) scripts/verify-db-consistency.ts

check-db-consistency:
	cd backend && $(RUN_SCRIPT) scripts/verify-db-consistency.ts

# A real, permanent, repeatable check - per direct, absolute
# instruction, replaces any one-off manual grep sweep of the Makefile
# for stray, unconverted "node" invocations that would silently
# defeat the real RUNTIME switch - a script invocation that hardcodes
# "node" runs correctly under RUNTIME=node, but wrongly ignores
# RUNTIME=bun or RUNTIME=deno; it should say $(RUN_SCRIPT) (or one of
# the other real, derived RUNTIME variables above) instead, exactly
# like every other real script invocation in this file.
check-node-refs:
	@echo "Real 'node' references in this Makefile (review each - a legitimate one, like 'node dist/server.js' in a comment, is fine; a script invocation that should say \$$(RUN_SCRIPT) is not):"
	@grep -n "node" Makefile || echo "(none found)"

# A real, single, repeatable command combining what had been several,
# separate, manual steps: reset the database, let it reinitialize
# fresh, then run the full test suite - the real, standard "start from
# nothing, prove it all still works" sequence.
verify-fresh: reset-db
	cd backend && $(RUN_SCRIPT) scripts/sanity-check-db-loads.ts
	$(MAKE) test
	@# Every independent gate runs and reports; one failing gate must never
	@# hide the others (make normally stops at the first failure, which
	@# silently masked two of these for a long time).
	@fail=0; for g in check-docs-coverage check-test-docs check-function-inventory check-cycles check-schema-table-count check-unused check-no-python check-journal-staging-only; do \
	  $(MAKE) $$g || { echo "GATE FAILED: $$g"; fail=1; }; \
	done; exit $$fail

check-schema-table-count:
	$(RUN_SCRIPT) scripts/check-schema-table-count.ts

# A real, mechanical, structural check - per
# /mnt/skills/user/documentation-coverage-enforcement/SKILL.md. Fails
# loudly if any real, exported backend function, Makefile target, or
# frontend route is never mentioned anywhere in the assembled manual.
check-docs-coverage: docs/documentation-baseline-report.md
	$(RUN_SCRIPT) scripts/build-programmer-manual.ts
	$(RUN_SCRIPT) scripts/check-docs-coverage.ts

check-journal-staging-only:
	$(RUN_SCRIPT) scripts/check-journal-staging-only.ts

# A real, direct, static call-graph analysis - per direct request, to
# replace ad-hoc grepping with one, real, comprehensive tool. Every
# real exported backend function, and how many real times it's
# actually invoked across the whole codebase.
call-graph:
	$(RUN_SCRIPT) scripts/call-graph.ts

# A real, direct, static trace of what each real frontend screen
# calls, and roughly when (on load vs on interaction) - tracing the
# real Svelte 5 source, not compiled JS. See
# scripts/svelte-call-trace.ts for the real, stated limits.
svelte-call-trace:
	$(RUN_SCRIPT) scripts/svelte-call-trace.ts

# A real, generated, comprehensive source reference - functions,
# types, and exported variables, arranged by file (common, then
# backend, then frontend), with a real include graph, call graph
# summary, and a full, alphabetical index. See
# scripts/source-reference.ts for the real, stated scope.
source-reference:
	$(RUN_SCRIPT) scripts/source-reference.ts > docs/source-reference.md

documentation-baseline-report:
	$(RUN_SCRIPT) scripts/documentation-baseline-report.ts > docs/documentation-baseline-report.md

# A real file-target rule, per direct request: the Programmer's Manual
# includes this real, generated report directly (not just a pointer to
# it), so it must be genuinely regenerated whenever its own, real
# inputs change - the baseline list itself, the script that reads it,
# or any real backend source file it scans - never left stale.
docs/documentation-baseline-report.md: docs/documentation-coverage-baseline.md scripts/documentation-baseline-report.ts $(shell find backend/src -name '*.ts')
	$(RUN_SCRIPT) scripts/documentation-baseline-report.ts > docs/documentation-baseline-report.md

# A real, generated architectural diagram set - per direct request,
# "a picture is worth a thousand words." Renders every real .mmd
# source under docs/diagrams/ to a real .svg. Real, portable fix: no
# hardcoded, machine-specific Chrome path - finds whatever real,
# already-cached chrome-headless-shell exists under this machine's own
# $HOME (needed in a sandbox with no internet access to let mmdc
# download its own), and falls through cleanly to mmdc's own, real,
# bundled Chrome when none is found (the normal, real case on a
# real developer's own machine).
manual-diagrams:
	@CHROME_PATH=$$(find /home/*/.cache/puppeteer /root/.cache/puppeteer "$$HOME/.cache/puppeteer" -type f -name 'chrome-headless-shell' 2>/dev/null | head -1); \
	cd docs/diagrams && for f in *.mmd; do \
	  if [ -n "$$CHROME_PATH" ]; then \
	    echo "{\"executablePath\": \"$$CHROME_PATH\", \"args\": [\"--no-sandbox\"]}" > .puppeteer-config.generated.json; \
	    mmdc -i "$$f" -o "$${f%.mmd}.svg" -b white -p .puppeteer-config.generated.json; \
	  else \
	    mmdc -i "$$f" -o "$${f%.mmd}.svg" -b white; \
	  fi; \
	done; \
	rm -f .puppeteer-config.generated.json

list-menu-labels:
	cd backend && $(RUN_SCRIPT) scripts/list-menu-labels.ts

add-menu-translations:
	$(RUN_SCRIPT) shared-fixtures/add-menu-translations.ts

add-journal-translations:
	$(RUN_SCRIPT) shared-fixtures/add-journal-translations.ts

add-journal-remaining-translations:
	$(RUN_SCRIPT) shared-fixtures/add-journal-remaining-translations.ts

add-header-translations:
	$(RUN_SCRIPT) shared-fixtures/add-header-translations.ts

add-brand-translation:
	$(RUN_SCRIPT) shared-fixtures/add-brand-translation.ts

check-frontend:
	cd frontend && $(RUN_NPM_SCRIPT) check

check-backend-types:
	cd backend && $(RUN_BINARY) tsc --noEmit

# Fails on any unused import, function or local variable in src/, test/
# or the step-runner. Deliberately separate from check-backend-types,
# which is already red from older, unrelated errors - a gate that is
# never green cannot protect anything. Scope and limits: see
# docs/programmer-tooling.md.
check-unused:
	@cd backend && out=$$($(RUN_BINARY) tsc --project tsconfig.unused.json 2>&1 | grep "TS6133" || true); \
	if [ -n "$$out" ]; then echo "$$out"; echo "Unused declarations found - remove them."; exit 1; \
	else echo "No unused imports, functions or locals in src/, test/, the step-runner or the root scripts."; fi

# Regenerates docs/screens-inventory.md from the frontend routes.
screens-inventory:
	$(RUN_SCRIPT) scripts/generate-screens-inventory.ts

# Regenerates docs/role-routes-matrix.md directly from every real
# requireRole(...)/requireGlobalRole(...) call in backend/src/routes -
# the real, enforced "screens v roles" question's own, honest answer
# (see the generator's own header comment for why a true per-screen
# matrix is not built here). Run after adding or changing a route's
# own role guard.
role-routes-matrix:
	$(RUN_SCRIPT) scripts/generate-role-routes-matrix.ts

# Fails if the project contains any .py file or any build file invoking
# python. This project ships no Python - see scripts/check-no-python.ts.
check-no-python:
	$(RUN_SCRIPT) scripts/check-no-python.ts

# Impact analysis of hardcoded classification terms (hot/cold, storage,
# division, category): where the code gives one business's suggested
# hierarchy special treatment. Writes docs/classification-neutrality-analysis.md.
analyze-classification:
	$(RUN_SCRIPT) scripts/analyze-classification-neutrality.ts

# Reports code comments per file and how many already point at the
# Programmer's Manual (docs/coding-standards.md, "Where explanation lives").
# Removes a file's whole-line comments after verifying the code itself is
# unchanged, and adds the pointer header. The chapter (DOC) must already
# exist and be part of the manual: content lands there first. DRY=1 previews.
# See docs/coding-standards.md, "How a file is migrated".
strip-comments:
	@if [ -z "$(FILE)" ] || [ -z "$(DOC)" ]; then echo "Usage: make strip-comments FILE=<path.ts> DOC=<docs/chapter.md> [DRY=1]"; exit 1; fi
	$(RUN_SCRIPT) scripts/strip-code-comments.ts $(FILE) $(DOC) $(if $(DRY),--dry-run)

# Finds declarations, SQL objects, screens and manual headings whose NAME
# matches a regex (case-insensitive), with file:line. A permanent replacement
# for ad-hoc greps. Usage: make find-symbols PATTERN='order|supplier'
find-symbols:
	@if [ -z "$(PATTERN)" ]; then echo "Usage: make find-symbols PATTERN=<regex>"; exit 1; fi
	$(RUN_SCRIPT) scripts/find-symbols.ts '$(PATTERN)'

# Measures which words the code uses for each concept and which verb prefixes
# are in use versus defined. Writes docs/naming-vocabulary-analysis.md
# (generated; not part of the manual). See docs/naming-vocabulary.md.
analyze-vocabulary:
	$(RUN_SCRIPT) scripts/analyze-vocabulary.ts

# Counts the lines and files that reference a set of names (NAMES=a,b) or every
# identifier matching a regex (PATTERN=...), by area: the blast radius of a
# rename. Write $$ for a literal $ in a make argument.
find-uses:
	@if [ -z "$(NAMES)" ] && [ -z "$(PATTERN)" ]; then echo "Usage: make find-uses NAMES=a,b   or   make find-uses PATTERN=<regex>"; exit 1; fi
	$(RUN_SCRIPT) scripts/find-uses.ts $(if $(NAMES),--names '$(NAMES)') $(if $(PATTERN),--pattern '$(PATTERN)')

# Regenerates docs/function-inventory.md: every function, its exact prototype
# (from the TypeScript type checker) and where it is called from. Never
# hand-edited. See docs/function-inventory.md, "How it is generated".
function-inventory:
	$(RUN_SCRIPT) scripts/generate-function-inventory.ts

# Fails if docs/function-inventory.md is out of date. Part of verify-fresh.
check-function-inventory:
	$(RUN_SCRIPT) scripts/generate-function-inventory.ts --check

# Explains why the inventory says what it does about one function: every
# reference the compiler found. Usage: make explain-function NAME=transferStock
explain-function:
	@if [ -z "$(NAME)" ]; then echo "Usage: make explain-function NAME=<function name>"; exit 1; fi
	$(RUN_SCRIPT) scripts/generate-function-inventory.ts --explain $(NAME)

# STANDARD TOOLS, used instead of hand-rolled ones. Override the command with
# e.g. KNIP='npx --yes -p knip@5.30.6 -p typescript@5.6.3 knip' (the newest knip
# needs more memory than some sandboxes allow).
KNIP ?= npx --yes knip
DEPCRUISE ?= npx --yes dependency-cruiser

# knip: exports nothing imports, and files nothing reaches. A report, not a
# gate: it exits non-zero while there is anything to find. Backend only for now.
knip:
	$(KNIP) --no-progress --workspace backend --include exports,files --reporter symbols

# dependency-cruiser: fails on an import cycle that is NOT in the known
# violations baseline. `make cycles-baseline` re-records that baseline.
check-cycles:
	$(DEPCRUISE) --config .dependency-cruiser.json --ignore-known --output-type err backend/src

cycles-baseline:
	$(DEPCRUISE) --config .dependency-cruiser.json --output-type baseline backend/src > .dependency-cruiser-known-violations.json

# The import graph as a Mermaid diagram (no hand-rolled include graph).
dependency-graph:
	$(DEPCRUISE) --config .dependency-cruiser.json --output-type mermaid backend/src

# One-shot: comments out named top-level functions that have no references,
# leaving a marker that points at docs/unused-functions.md. No standard tool
# does this (knip --fix only removes the export keyword). DRY=1 previews.
comment-out-functions:
	@if [ -z "$(FILE)" ] || [ -z "$(NAMES)" ]; then echo "Usage: make comment-out-functions FILE=<path.ts> NAMES=a,b,c [DRY=1]"; exit 1; fi
	$(RUN_SCRIPT) scripts/comment-out-functions.ts --file $(FILE) --names '$(NAMES)' $(if $(DRY),--dry-run)

# The simulation's expected numbers are stale (20 checks fail, and did at
# checkpoint 408 too), so it cannot gate as it stands. But its output is
# deterministic, so it works as a regression signal: the PASS/FAIL lines,
# with expected and actual numbers, must stay IDENTICAL to a recorded golden
# file. Use it before and after a rename. See docs/bulk-rename-plan.md.
SIM_GOLDEN = backend/test/golden/simulation-results.txt

sim-golden:
	mkdir -p backend/test/golden
	-$(MAKE) test-e2e 2>&1 | grep -E '^(PASS|FAIL)' > $(SIM_GOLDEN)
	@echo "Recorded $$(wc -l < $(SIM_GOLDEN)) result lines in $(SIM_GOLDEN)"

check-sim-unchanged:
	-$(MAKE) test-e2e 2>&1 | grep -E '^(PASS|FAIL)' > /tmp/sim-now.txt
	diff -u $(SIM_GOLDEN) /tmp/sim-now.txt
	@echo "Simulation output is unchanged from the golden file."

# Applies a rename map (lines "old new") by whole-word replacement over the
# tracked text files. Refuses if a new name already exists. DRY=1 previews.
# See docs/bulk-rename-plan.md, "How a rename is applied". Maps live in renames/.
rename-identifiers:
	@if [ -z "$(MAP)" ]; then echo "Usage: make rename-identifiers MAP=renames/<file>.txt [DRY=1] [IDENTIFIERS_ONLY=1] [UNDER=backend/,scripts/]"; exit 1; fi
	$(RUN_SCRIPT) scripts/apply-renames.ts --map $(MAP) $(if $(DRY),--dry-run) $(if $(IDENTIFIERS_ONLY),--identifiers-only) $(if $(UNDER),--under $(UNDER))

measure-comments:
	$(RUN_SCRIPT) scripts/measure-code-comments.ts

# Lists one file's comment lines (optionally FROM=n TO=m), so a migration can
# see exactly what must move into the manual before it is replaced.
show-comments:
	@if [ -z "$(FILE)" ]; then echo "Usage: make show-comments FILE=<path> [FROM=<line> TO=<line>]"; exit 1; fi
	$(RUN_SCRIPT) scripts/measure-code-comments.ts --show $(FILE) $(if $(FROM),--from $(FROM)) $(if $(TO),--to $(TO))

# Every test's exact title must appear in the Programmer's Manual, so a
# failing test leads straight to the explanation of the code it exercises.
# Fails only for a NEW undocumented test (docs/test-documentation-baseline.txt
# holds the known gap). See docs/coding-standards.md, "Where explanation lives".
check-test-docs:
	$(RUN_SCRIPT) scripts/build-programmer-manual.ts
	$(RUN_SCRIPT) scripts/check-test-docs.ts

# Regenerates the baseline of undocumented tests, after documenting some.
test-docs-baseline:
	$(RUN_SCRIPT) scripts/build-programmer-manual.ts
	$(RUN_SCRIPT) scripts/check-test-docs.ts --write-baseline

# Runs only the backend tests whose title contains TEST. The tests share one
# database, so a test may depend on rows an earlier test created: if one fails
# alone, run the whole file before concluding the code is broken.
test-one:
	@if [ -z "$(TEST)" ]; then echo "Usage: make test-one TEST=<part of a test title>"; exit 1; fi
	cd backend && $(RUN_TEST) --test-name-pattern="$(TEST)" test/*.test.ts

check-e2e-types:
	cd e2e && $(RUN_BINARY) tsc --noEmit

# Real, confirmed second bug, found directly while this exact branch
# finally started running on every real invocation (it never had before -
# a real backend simply was never already running when reset-db ran, until
# ensure-servers-no-demo started leaving one up between runs): a plain
# `pkill -9 -f "tsx watch src/server.ts"` matches against every real
# process's own, full command line - including the real shell CURRENTLY
# RUNNING this very recipe line, since make passes the whole recipe
# (pattern string included) to one real `sh -c` invocation, whose own
# command line genuinely contains that exact text. Confirmed directly:
# `bash -c 'echo tsx watch src/server.ts; pgrep -f "tsx watch
# src/server.ts"'` matches and would kill its own, real, running shell.
# Fixed generically, once, in scripts/safe-pkill.sh (walks each real
# candidate's own ancestor/descendant chain, never kills this recipe's
# own real shell or anything above or below it) - used here and by
# ensure-servers-no-demo/stop-servers below, replacing the three further,
# real, same-shaped, latent instances of this exact bug found alongside
# it.
reset-db:
	@if [ -f $(BACKEND_PID) ] && kill -0 $$(cat $(BACKEND_PID)) 2>/dev/null; then \
		echo "A real backend is still running and holds entities.sqlite open - stopping it first, so deleting the file below can't leave it serving a stale, now-deleted inode (the real, confirmed cause of repeated 'business already exists on a supposedly fresh db' failures)."; \
		PID=$$(cat $(BACKEND_PID)); kill -- -$$PID 2>/dev/null || kill $$PID 2>/dev/null || true; rm -f $(BACKEND_PID); \
		sh scripts/safe-pkill.sh "tsx watch src/server.ts"; \
		sleep 1; \
	fi
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
	docs/user-manual-appendix-step-runner.md \
	docs/user-manual-glossary.md \
	docs/user-manual-contributors-suggestions-notes.md

# Every real screenshot file every real chapter/appendix actually
# references - a real, explicit, individual dependency list, per
# direct correction, replacing an earlier, blanket "capture every
# screenshot" step that ran regardless of which chapters actually
# needed one. Touching this list only when a real, new screenshot
# reference is added to a chapter keeps it honest.
# Per direct instruction: the real, plain-ASCII data files these
# fixture *.ts "programs" genuinely load at runtime (fs.readFileSync,
# never a compile step) - the exact, same, real relationship a .c
# file has to the .o a suffix rule builds it into, just running the
# other direction (a real .ts program reading real data, not being
# generated from it). Anything whose own, real output depends on the
# seeded demo database - a screenshot showing real wine-retail data,
# most directly - should list these as real, direct prerequisites too,
# so a real, direct change to the underlying ASCII data is never
# silently missed by Make's own staleness check.
SEED_DATA_FILES := \
	shared-fixtures/wine-retail.csv \
	shared-fixtures/categories.csv \
	shared-fixtures/locations.csv \
	shared-fixtures/pricing.csv \
	shared-fixtures/products.csv \
	shared-fixtures/stock-levels.csv \
	shared-fixtures/upcs.csv \
	shared-fixtures/translations.csv \
	shared-fixtures/wine-retail.ts \
	shared-fixtures/wine-retail-demo-data.ts \
	shared-fixtures/csv.ts

USER_MANUAL_SCREENSHOTS := \
	docs/manual-images/ap_payment.png \
	docs/manual-images/ap_purchase.png \
	docs/manual-images/ar_receipt.png \
	docs/manual-images/ar_sale.png \
	docs/manual-images/cash_purchase.png \
	docs/manual-images/cash_sale.png \
	docs/manual-images/general_journal.png \
	docs/manual-images/hr_wages.png \
	docs/manual-images/m_balance_sheet.png \
	docs/manual-images/m_business_setup.png \
	docs/manual-images/m_choose_business.png \
	docs/manual-images/m_configuration_landing.png \
	docs/manual-images/m_contact_persons.png \
	docs/manual-images/m_home.png \
	docs/manual-images/m_locations.png \
	docs/manual-images/m_login.png \
	docs/manual-images/m_multi_location_schedule.png \
	docs/manual-images/m_new_business.png \
	docs/manual-images/m_parts_cropped.png \
	docs/manual-images/m_po_supplier_matching.png \
	docs/manual-images/pos_terminal.png \
	docs/manual-images/projects.png \
	docs/manual-images/purchase_order.png \
	docs/manual-images/sales_order.png \
	docs/manual-images/stock_dispatch.png \
	docs/manual-images/stock_receipt.png \
	docs/manual-images/stock_take.png \
	docs/manual-images/stock_transfer.png \
	docs/manual-images/storage_origin_verified.png \
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
	docs/manual-images/t17_trial_balance_after_first_transaction.png \
	docs/manual-images/write_offs.png

# A real screenshot not yet captured falls back to a real, correctly
# sized (1280x720), clearly labelled "Coming Soon" placeholder - kept
# so the manual always builds and lays out correctly, never blocked
# on a screenshot that doesn't exist yet. Make's own, real file-
# existence check means this recipe only ever runs for a file that
# genuinely doesn't exist - a real, once-captured screenshot is never
# overwritten by this rule.
docs/manual-images/%.png:
	cp docs/manual-images/coming-soon.png $@

manual: scripts/build-user-manual.ts $(USER_MANUAL_CHAPTERS) $(USER_MANUAL_SCREENSHOTS)
	$(RUN_SCRIPT) scripts/build-user-manual.ts
	cd docs && pandoc user-manual.md -o ../sql-ledger-ts_User_Manual.pdf \
	  --pdf-engine=xelatex -V documentclass=book -V geometry:margin=1in \
	  -H manual-header-includes.tex -f markdown+raw_tex --resource-path=.
	@echo "Built sql-ledger-ts_User_Manual.pdf"

# Real, individual, per-screenshot targets - each depends on the
# actual +page.svelte source file(s) it captures, plus the capture
# script itself, so touching one Svelte file only invalidates the
# screenshots that genuinely depend on it, not all of them.
docs/manual-images/setup_chart_of_accounts.png: e2e/tests/capture-manual-screenshots.spec.ts frontend/src/routes/setup/chart-of-accounts/+page.svelte $(SEED_DATA_FILES) | ensure-servers
	cd e2e && MANUAL_SCREEN=setup_chart_of_accounts $(RUN_NPM_SCRIPT) browser-run -- test capture-manual-screenshots --reporter=list

docs/manual-images/setup_periods.png: e2e/tests/capture-manual-screenshots.spec.ts frontend/src/routes/setup/periods/+page.svelte $(SEED_DATA_FILES) | ensure-servers
	cd e2e && MANUAL_SCREEN=setup_periods $(RUN_NPM_SCRIPT) browser-run -- test capture-manual-screenshots --reporter=list

docs/manual-images/setup_translations.png: e2e/tests/capture-manual-screenshots.spec.ts frontend/src/routes/setup/translations/+page.svelte $(SEED_DATA_FILES) | ensure-servers
	cd e2e && MANUAL_SCREEN=setup_translations $(RUN_NPM_SCRIPT) browser-run -- test capture-manual-screenshots --reporter=list

docs/manual-images/setup_users.png: e2e/tests/capture-manual-screenshots.spec.ts frontend/src/routes/setup/users/+page.svelte $(SEED_DATA_FILES) | ensure-servers
	cd e2e && MANUAL_SCREEN=setup_users $(RUN_NPM_SCRIPT) browser-run -- test capture-manual-screenshots --reporter=list

docs/manual-images/setup_vocabulary.png: e2e/tests/capture-manual-screenshots.spec.ts frontend/src/routes/setup/vocabulary/+page.svelte $(SEED_DATA_FILES) | ensure-servers
	cd e2e && MANUAL_SCREEN=setup_vocabulary $(RUN_NPM_SCRIPT) browser-run -- test capture-manual-screenshots --reporter=list

docs/manual-images/setup_yearend.png: e2e/tests/capture-manual-screenshots.spec.ts frontend/src/routes/setup/yearend/+page.svelte $(SEED_DATA_FILES) | ensure-servers
	cd e2e && MANUAL_SCREEN=setup_yearend $(RUN_NPM_SCRIPT) browser-run -- test capture-manual-screenshots --reporter=list

docs/manual-images/stock_listing.png: e2e/tests/capture-manual-screenshots.spec.ts frontend/src/routes/stock/listing/+page.svelte $(SEED_DATA_FILES) | ensure-servers
	cd e2e && MANUAL_SCREEN=stock_listing $(RUN_NPM_SCRIPT) browser-run -- test capture-manual-screenshots --reporter=list

docs/manual-images/stock_restock.png: e2e/tests/capture-manual-screenshots.spec.ts frontend/src/routes/stock/restock/+page.svelte $(SEED_DATA_FILES) | ensure-servers
	cd e2e && MANUAL_SCREEN=stock_restock $(RUN_NPM_SCRIPT) browser-run -- test capture-manual-screenshots --reporter=list

docs/manual-images/reports_new_pl.png: e2e/tests/capture-manual-screenshots.spec.ts frontend/src/routes/reports/new-pl/+page.svelte $(SEED_DATA_FILES) | ensure-servers
	cd e2e && MANUAL_SCREEN=reports_new_pl $(RUN_NPM_SCRIPT) browser-run -- test capture-manual-screenshots --reporter=list

docs/manual-images/reports_new_stock_on_hand.png: e2e/tests/capture-manual-screenshots.spec.ts frontend/src/routes/reports/new-stock-on-hand/+page.svelte $(SEED_DATA_FILES) | ensure-servers
	cd e2e && MANUAL_SCREEN=reports_new_stock_on_hand $(RUN_NPM_SCRIPT) browser-run -- test capture-manual-screenshots --reporter=list

docs/manual-images/reports_old_pl.png: e2e/tests/capture-manual-screenshots.spec.ts frontend/src/routes/reports/old-pl/+page.svelte $(SEED_DATA_FILES) | ensure-servers
	cd e2e && MANUAL_SCREEN=reports_old_pl $(RUN_NPM_SCRIPT) browser-run -- test capture-manual-screenshots --reporter=list

docs/manual-images/reports_profit_and_loss.png: e2e/tests/capture-manual-screenshots.spec.ts frontend/src/routes/reports/profit-and-loss/+page.svelte $(SEED_DATA_FILES) | ensure-servers
	cd e2e && MANUAL_SCREEN=reports_profit_and_loss $(RUN_NPM_SCRIPT) browser-run -- test capture-manual-screenshots --reporter=list

docs/manual-images/reports_reminders.png: e2e/tests/capture-manual-screenshots.spec.ts frontend/src/routes/reports/reminders/+page.svelte $(SEED_DATA_FILES) | ensure-servers
	cd e2e && MANUAL_SCREEN=reports_reminders $(RUN_NPM_SCRIPT) browser-run -- test capture-manual-screenshots --reporter=list

docs/manual-images/reports_sales.png: e2e/tests/capture-manual-screenshots.spec.ts frontend/src/routes/reports/sales/+page.svelte $(SEED_DATA_FILES) | ensure-servers
	cd e2e && MANUAL_SCREEN=reports_sales $(RUN_NPM_SCRIPT) browser-run -- test capture-manual-screenshots --reporter=list

docs/manual-images/reports_statement.png: e2e/tests/capture-manual-screenshots.spec.ts frontend/src/routes/reports/statement/+page.svelte $(SEED_DATA_FILES) | ensure-servers
	cd e2e && MANUAL_SCREEN=reports_statement $(RUN_NPM_SCRIPT) browser-run -- test capture-manual-screenshots --reporter=list

docs/manual-images/reports_stock_movement.png: e2e/tests/capture-manual-screenshots.spec.ts frontend/src/routes/reports/stock-movement/+page.svelte $(SEED_DATA_FILES) | ensure-servers
	cd e2e && MANUAL_SCREEN=reports_stock_movement $(RUN_NPM_SCRIPT) browser-run -- test capture-manual-screenshots --reporter=list

docs/manual-images/reports_trial_balance.png: e2e/tests/capture-manual-screenshots.spec.ts frontend/src/routes/reports/trial-balance/+page.svelte $(SEED_DATA_FILES) | ensure-servers
	cd e2e && MANUAL_SCREEN=reports_trial_balance $(RUN_NPM_SCRIPT) browser-run -- test capture-manual-screenshots --reporter=list

docs/manual-images/setup_bank_accounts.png: e2e/tests/capture-manual-screenshots.spec.ts frontend/src/routes/setup/bank-accounts/+page.svelte $(SEED_DATA_FILES) | ensure-servers
	cd e2e && MANUAL_SCREEN=setup_bank_accounts $(RUN_NPM_SCRIPT) browser-run -- test capture-manual-screenshots --reporter=list

docs/manual-images/account_password.png: e2e/tests/capture-manual-screenshots.spec.ts frontend/src/routes/account/password/+page.svelte $(SEED_DATA_FILES) | ensure-servers
	cd e2e && MANUAL_SCREEN=account_password $(RUN_NPM_SCRIPT) browser-run -- test capture-manual-screenshots --reporter=list

docs/manual-images/customer_terminal.png: e2e/tests/capture-manual-screenshots.spec.ts frontend/src/routes/customer-terminal/+page.svelte $(SEED_DATA_FILES) | ensure-servers
	cd e2e && MANUAL_SCREEN=customer_terminal $(RUN_NPM_SCRIPT) browser-run -- test capture-manual-screenshots --reporter=list

docs/manual-images/editor.png: e2e/tests/capture-manual-screenshots.spec.ts frontend/src/routes/editor/+page.svelte $(SEED_DATA_FILES) | ensure-servers
	cd e2e && MANUAL_SCREEN=editor $(RUN_NPM_SCRIPT) browser-run -- test capture-manual-screenshots --reporter=list

docs/manual-images/invoices.png: e2e/tests/capture-manual-screenshots.spec.ts frontend/src/routes/invoices/+page.svelte $(SEED_DATA_FILES) | ensure-servers
	cd e2e && MANUAL_SCREEN=invoices $(RUN_NPM_SCRIPT) browser-run -- test capture-manual-screenshots --reporter=list

docs/manual-images/journal.png: e2e/tests/capture-manual-screenshots.spec.ts frontend/src/routes/journal/+page.svelte $(SEED_DATA_FILES) | ensure-servers
	cd e2e && MANUAL_SCREEN=journal $(RUN_NPM_SCRIPT) browser-run -- test capture-manual-screenshots --reporter=list

docs/manual-images/reports_aged.png: e2e/tests/capture-manual-screenshots.spec.ts frontend/src/routes/reports/aged/+page.svelte $(SEED_DATA_FILES) | ensure-servers
	cd e2e && MANUAL_SCREEN=reports_aged $(RUN_NPM_SCRIPT) browser-run -- test capture-manual-screenshots --reporter=list

docs/manual-images/reports_below_reorder.png: e2e/tests/capture-manual-screenshots.spec.ts frontend/src/routes/reports/below-reorder/+page.svelte $(SEED_DATA_FILES) | ensure-servers
	cd e2e && MANUAL_SCREEN=reports_below_reorder $(RUN_NPM_SCRIPT) browser-run -- test capture-manual-screenshots --reporter=list

docs/manual-images/reports_cash_flow_forecast.png: e2e/tests/capture-manual-screenshots.spec.ts frontend/src/routes/reports/cash-flow-forecast/+page.svelte $(SEED_DATA_FILES) | ensure-servers
	cd e2e && MANUAL_SCREEN=reports_cash_flow_forecast $(RUN_NPM_SCRIPT) browser-run -- test capture-manual-screenshots --reporter=list

docs/manual-images/reports_compare.png: e2e/tests/capture-manual-screenshots.spec.ts frontend/src/routes/reports/compare/+page.svelte $(SEED_DATA_FILES) | ensure-servers
	cd e2e && MANUAL_SCREEN=reports_compare $(RUN_NPM_SCRIPT) browser-run -- test capture-manual-screenshots --reporter=list

docs/manual-images/reports_new_new_pl.png: e2e/tests/capture-manual-screenshots.spec.ts frontend/src/routes/reports/new-new-pl/+page.svelte $(SEED_DATA_FILES) | ensure-servers
	cd e2e && MANUAL_SCREEN=reports_new_new_pl $(RUN_NPM_SCRIPT) browser-run -- test capture-manual-screenshots --reporter=list

docs/manual-images/ar_sale.png: e2e/tests/capture-manual-screenshots.spec.ts frontend/src/routes/arap/ar-sale/+page.svelte $(SEED_DATA_FILES) | ensure-servers
	cd e2e && MANUAL_SCREEN=ar_sale $(RUN_NPM_SCRIPT) browser-run -- test capture-manual-screenshots --reporter=list

docs/manual-images/ar_receipt.png: e2e/tests/capture-manual-screenshots.spec.ts frontend/src/routes/arap/ar-receipt/+page.svelte frontend/src/lib/components/PaymentReceipt.svelte $(SEED_DATA_FILES) | ensure-servers
	cd e2e && MANUAL_SCREEN=ar_receipt $(RUN_NPM_SCRIPT) browser-run -- test capture-manual-screenshots --reporter=list

docs/manual-images/ap_purchase.png: e2e/tests/capture-manual-screenshots.spec.ts frontend/src/routes/arap/ap-purchase/+page.svelte $(SEED_DATA_FILES) | ensure-servers
	cd e2e && MANUAL_SCREEN=ap_purchase $(RUN_NPM_SCRIPT) browser-run -- test capture-manual-screenshots --reporter=list

docs/manual-images/ap_payment.png: e2e/tests/capture-manual-screenshots.spec.ts frontend/src/routes/arap/ap-payment/+page.svelte frontend/src/lib/components/PaymentReceipt.svelte $(SEED_DATA_FILES) | ensure-servers
	cd e2e && MANUAL_SCREEN=ap_payment $(RUN_NPM_SCRIPT) browser-run -- test capture-manual-screenshots --reporter=list

docs/manual-images/cash_sale.png: e2e/tests/capture-manual-screenshots.spec.ts frontend/src/routes/arap/cash-sale/+page.svelte frontend/src/lib/components/CashTransaction.svelte $(SEED_DATA_FILES) | ensure-servers
	cd e2e && MANUAL_SCREEN=cash_sale $(RUN_NPM_SCRIPT) browser-run -- test capture-manual-screenshots --reporter=list

docs/manual-images/cash_purchase.png: e2e/tests/capture-manual-screenshots.spec.ts frontend/src/routes/arap/cash-purchase/+page.svelte frontend/src/lib/components/CashTransaction.svelte $(SEED_DATA_FILES) | ensure-servers
	cd e2e && MANUAL_SCREEN=cash_purchase $(RUN_NPM_SCRIPT) browser-run -- test capture-manual-screenshots --reporter=list

docs/manual-images/projects.png: e2e/tests/capture-manual-screenshots.spec.ts frontend/src/routes/projects/+page.svelte $(SEED_DATA_FILES) | ensure-servers
	cd e2e && MANUAL_SCREEN=projects $(RUN_NPM_SCRIPT) browser-run -- test capture-manual-screenshots --reporter=list

docs/manual-images/hr_wages.png: e2e/tests/capture-manual-screenshots.spec.ts frontend/src/routes/hr/+page.svelte $(SEED_DATA_FILES) | ensure-servers
	cd e2e && MANUAL_SCREEN=hr_wages $(RUN_NPM_SCRIPT) browser-run -- test capture-manual-screenshots --reporter=list

docs/manual-images/write_offs.png: e2e/tests/capture-manual-screenshots.spec.ts frontend/src/routes/stock/write-offs/+page.svelte $(SEED_DATA_FILES) | ensure-servers
	cd e2e && MANUAL_SCREEN=write_offs $(RUN_NPM_SCRIPT) browser-run -- test capture-manual-screenshots --reporter=list

docs/manual-images/stock_take.png: e2e/tests/capture-manual-screenshots.spec.ts frontend/src/routes/stock/stock-take/+page.svelte $(SEED_DATA_FILES) | ensure-servers
	cd e2e && MANUAL_SCREEN=stock_take $(RUN_NPM_SCRIPT) browser-run -- test capture-manual-screenshots --reporter=list

docs/manual-images/stock_transfer.png: e2e/tests/capture-manual-screenshots.spec.ts frontend/src/routes/stock/transfer/+page.svelte $(SEED_DATA_FILES) | ensure-servers
	cd e2e && MANUAL_SCREEN=stock_transfer $(RUN_NPM_SCRIPT) browser-run -- test capture-manual-screenshots --reporter=list

docs/manual-images/stock_dispatch.png: e2e/tests/capture-manual-screenshots.spec.ts frontend/src/routes/stock/stock-dispatch/+page.svelte $(SEED_DATA_FILES) | ensure-servers
	cd e2e && MANUAL_SCREEN=stock_dispatch $(RUN_NPM_SCRIPT) browser-run -- test capture-manual-screenshots --reporter=list

docs/manual-images/stock_receipt.png: e2e/tests/capture-manual-screenshots.spec.ts frontend/src/routes/stock/stock-receipt/+page.svelte $(SEED_DATA_FILES) | ensure-servers
	cd e2e && MANUAL_SCREEN=stock_receipt $(RUN_NPM_SCRIPT) browser-run -- test capture-manual-screenshots --reporter=list

docs/manual-images/sales_order.png: e2e/tests/capture-manual-screenshots.spec.ts frontend/src/routes/stock/so/+page.svelte $(SEED_DATA_FILES) | ensure-servers
	cd e2e && MANUAL_SCREEN=sales_order $(RUN_NPM_SCRIPT) browser-run -- test capture-manual-screenshots --reporter=list

docs/manual-images/general_journal.png: e2e/tests/capture-manual-screenshots.spec.ts frontend/src/routes/post/+page.svelte $(SEED_DATA_FILES) | ensure-servers
	cd e2e && MANUAL_SCREEN=general_journal $(RUN_NPM_SCRIPT) browser-run -- test capture-manual-screenshots --reporter=list

docs/manual-images/pos_terminal.png: e2e/tests/capture-manual-screenshots.spec.ts frontend/src/routes/pos/+page.svelte $(SEED_DATA_FILES) | ensure-servers
	cd e2e && MANUAL_SCREEN=pos_terminal $(RUN_NPM_SCRIPT) browser-run -- test capture-manual-screenshots --reporter=list

docs/manual-images/purchase_order.png: e2e/tests/capture-manual-screenshots.spec.ts frontend/src/routes/stock/po/+page.svelte $(SEED_DATA_FILES) | ensure-servers
	cd e2e && MANUAL_SCREEN=purchase_order $(RUN_NPM_SCRIPT) browser-run -- test capture-manual-screenshots --reporter=list

docs/manual-images/m_multi_location_schedule.png: e2e/tests/capture-manual-screenshots.spec.ts frontend/src/routes/setup/business-setup/+page.svelte $(SEED_DATA_FILES) | ensure-servers
	cd e2e && MANUAL_SCREEN=m_multi_location_schedule $(RUN_NPM_SCRIPT) browser-run -- test capture-manual-screenshots --reporter=list

docs/manual-images/m_contact_persons.png: e2e/tests/capture-manual-screenshots.spec.ts frontend/src/routes/contacts/+page.svelte $(SEED_DATA_FILES) | ensure-servers
	cd e2e && MANUAL_SCREEN=m_contact_persons $(RUN_NPM_SCRIPT) browser-run -- test capture-manual-screenshots --reporter=list

docs/manual-images/m_balance_sheet.png: e2e/tests/capture-manual-screenshots.spec.ts frontend/src/routes/reports/balance-sheet/+page.svelte $(SEED_DATA_FILES) | ensure-servers
	cd e2e && MANUAL_SCREEN=m_balance_sheet $(RUN_NPM_SCRIPT) browser-run -- test capture-manual-screenshots --reporter=list

docs/manual-images/m_items_new_category_full.png: e2e/tests/capture-manual-screenshots.spec.ts frontend/src/routes/items/+page.svelte $(SEED_DATA_FILES) | ensure-servers
	cd e2e && MANUAL_SCREEN=m_items_new_category_full $(RUN_NPM_SCRIPT) browser-run -- test capture-manual-screenshots --reporter=list

docs/manual-images/m_parts_cropped.png: docs/manual-images/m_items_new_category_full.png scripts/crop-parts-screenshot.ts
	$(RUN_SCRIPT) scripts/crop-parts-screenshot.ts

docs/manual-images/m_locations.png: e2e/tests/capture-manual-screenshots.spec.ts frontend/src/routes/locations/+page.svelte $(SEED_DATA_FILES) | ensure-servers
	cd e2e && MANUAL_SCREEN=m_locations $(RUN_NPM_SCRIPT) browser-run -- test capture-manual-screenshots --reporter=list

docs/manual-images/m_business_setup.png: e2e/tests/capture-manual-screenshots.spec.ts frontend/src/routes/setup/business-setup/+page.svelte $(SEED_DATA_FILES) | ensure-servers
	cd e2e && MANUAL_SCREEN=m_business_setup $(RUN_NPM_SCRIPT) browser-run -- test capture-manual-screenshots --reporter=list

docs/manual-images/m_new_business.png: e2e/tests/capture-manual-screenshots.spec.ts frontend/src/routes/setup/new-business/+page.svelte $(SEED_DATA_FILES) | ensure-servers
	cd e2e && MANUAL_SCREEN=m_new_business $(RUN_NPM_SCRIPT) browser-run -- test capture-manual-screenshots --reporter=list

docs/manual-images/m_configuration_landing.png: e2e/tests/capture-manual-screenshots.spec.ts frontend/src/routes/setup/+page.svelte $(SEED_DATA_FILES) | ensure-servers
	cd e2e && MANUAL_SCREEN=m_configuration_landing $(RUN_NPM_SCRIPT) browser-run -- test capture-manual-screenshots --reporter=list

docs/manual-images/m_login.png: e2e/tests/capture-manual-screenshots.spec.ts frontend/src/routes/login/+page.svelte $(SEED_DATA_FILES) | ensure-servers
	cd e2e && MANUAL_SCREEN=m_login $(RUN_NPM_SCRIPT) browser-run -- test capture-manual-screenshots --reporter=list

docs/manual-images/m_home.png: e2e/tests/capture-manual-screenshots.spec.ts frontend/src/routes/+page.svelte $(SEED_DATA_FILES) | ensure-servers
	cd e2e && MANUAL_SCREEN=m_home $(RUN_NPM_SCRIPT) browser-run -- test capture-manual-screenshots --reporter=list

docs/manual-images/m_choose_business.png: e2e/tests/capture-manual-screenshots.spec.ts frontend/src/routes/session/+page.svelte $(SEED_DATA_FILES) | ensure-servers
	cd e2e && MANUAL_SCREEN=m_choose_business $(RUN_NPM_SCRIPT) browser-run -- test capture-manual-screenshots --reporter=list

# Real, live screenshot capture for the manual, in each real,
# supported language — a real, shared browser-driving script
# Per direct correction: no blanket "capture every screenshot"
# target - each real screenshot has its own, individual, real rule
# above, depending only on the specific frontend route file(s) it
# actually captures, so `make manual` only ever regenerates the
# screenshots whose own real source changed, never all of them.

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
HISTORICAL_MANUAL_CHAPTERS := \
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
	docs/journal-api-reference.md \
	docs/skill-step-runner-design.md \
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
	docs/documentation-baseline-report.md \
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
	docs/svelte-call-trace.md \
	docs/source-reference-tool.md \
	docs/naming-conventions-and-entity-glossary.md \
	docs/skill-branded-types-not-primitives.md \
	docs/border-multicurrency-pos-plan.md \
	docs/typed-node-create-design.md \
	docs/general-typed-hierarchy-resolution-plan.md \
	docs/cartesian-account-linking-plan.md \
	docs/inventory-lifecycle-blow-by-blow.md \
	docs/file-inventory-appendix.md \
	docs/session-business-context.md \
	docs/ledger-scoped-accounts-and-rollover.md \
	docs/profit-centers-design.md \
	docs/tutorial-e2e-hardening-2026-10.md \
	docs/access-control-design.md \
	docs/user-business-role-matrix-design.md \
	docs/business-admin-role-and-enforcement-design.md \
	docs/active-ledger-design.md \
	docs/role-routes-matrix.md

# docs/screens-staging-triggers-functions.md references 17 specific
# screenshots directly - a real, explicit Make dependency, so this
# chapter is genuinely stale if any of them are missing or updated.
# (Only the Historical Design & Decision Log still compiles this
# chapter - the lean Programmer's Manual no longer includes it.)
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

# Regenerated to match the real screenshot names this chapter actually
# embeds (shared-fixtures/tutorial-steps.control.csv's own screenshot
# column) - the previous t01..t17 list named files this chapter had
# already stopped referencing, so `make manual` could miss a real,
# needed rebuild whenever only a screenshot changed. Re-derive with:
# grep -oE 'manual-images-tutorial/[a-zA-Z0-9_.-]+\.png' docs/user-manual-ch3-tutorial.md | sort -u
docs/user-manual-ch3-tutorial.md: \
	docs/manual-images-tutorial/bank_account_nominated.png \
	docs/manual-images-tutorial/bank_currency_structure_built.png \
	docs/manual-images-tutorial/cash_purchase_done.png \
	docs/manual-images-tutorial/cash_purchase_ice_done.png \
	docs/manual-images-tutorial/cash_sale_ice_done.png \
	docs/manual-images-tutorial/category_beer_created.png \
	docs/manual-images-tutorial/employee_created.png \
	docs/manual-images-tutorial/ice_balance_sheet_after_close.png \
	docs/manual-images-tutorial/ice_phase_books_closed.png \
	docs/manual-images-tutorial/ice_profit_and_loss_after_close.png \
	docs/manual-images-tutorial/ice_trial_balance_after_close.png \
	docs/manual-images-tutorial/item_amber_ale_created.png \
	docs/manual-images-tutorial/item_cost_set.png \
	docs/manual-images-tutorial/item_highland_single_malt_created.png \
	docs/manual-images-tutorial/item_ice_created.png \
	docs/manual-images-tutorial/journal_entry_posted.png \
	docs/manual-images-tutorial/journal_line_1_staged.png \
	docs/manual-images-tutorial/journal_line_2_staged.png \
	docs/manual-images-tutorial/login_landing.png \
	docs/manual-images-tutorial/new_business_created.png \
	docs/manual-images-tutorial/pl_by_category_detailed.png \
	docs/manual-images-tutorial/pl_by_division_consolidated.png \
	docs/manual-images-tutorial/pl_by_item_single_row.png \
	docs/manual-images-tutorial/provider_created.png \
	docs/manual-images-tutorial/purchase_order_placed.png \
	docs/manual-images-tutorial/rent_expense_posted.png \
	docs/manual-images-tutorial/retail_created.png \
	docs/manual-images-tutorial/rollover_to_new_period_done.png \
	docs/manual-images-tutorial/second_capital_investment_posted.png \
	docs/manual-images-tutorial/session_switched.png \
	docs/manual-images-tutorial/session_switched_to_new_ledger.png \
	docs/manual-images-tutorial/structure_popup_category_added.png \
	docs/manual-images-tutorial/structure_popup_division_added.png \
	docs/manual-images-tutorial/structure_popup_location_added.png \
	docs/manual-images-tutorial/structure_popup_move_ho.png \
	docs/manual-images-tutorial/structure_popup_move_msc.png \
	docs/manual-images-tutorial/transfer_done.png

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

historical-manual: scripts/build-historical-manual.ts scripts/manual-builder.ts docs/historical-manual-frontmatter.md $(HISTORICAL_MANUAL_CHAPTERS)
	$(RUN_SCRIPT) scripts/build-historical-manual.ts
	cd docs/old && pandoc historical-manual.md -o ../../sql-ledger-ts_Historical_Design_Log.pdf \
	  --pdf-engine=xelatex -V documentclass=book -V geometry:margin=1in \
	  -H ../historical-manual-header-includes.tex -f markdown+raw_tex --resource-path=..
	@echo "Built sql-ledger-ts_Historical_Design_Log.pdf"

programmer-manual: scripts/build-programmer-manual.ts docs/programmer-manual-frontmatter.md $(PROGRAMMER_MANUAL_CHAPTERS)
	$(RUN_SCRIPT) scripts/build-programmer-manual.ts
	cd docs && pandoc programmer-manual.md -o ../sql-ledger-ts_Programmer_Manual.pdf \
	  --pdf-engine=xelatex -V documentclass=book -V geometry:margin=1in \
	  -H programmer-manual-header-includes.tex -f markdown+raw_tex --resource-path=.
	@echo "Built sql-ledger-ts_Programmer_Manual.pdf"

# Just the User Manual's own Chapter 3 (docs/user-manual-ch3-tutorial.md),
# built standalone - the exact, same, real chapter `make manual` folds into
# the full book, here on its own. Depends on test-e2e-tutorial-browser,
# which is itself the one, real, data-driven test-runner
# (backend/scripts/step-runner.ts) actually driving a live browser through
# the real UI against the real, augmented tutorial datafile
# (shared-fixtures/tutorial-steps.csv, paired with its own
# tutorial-steps.control.csv) - the one, real source of every screenshot
# this chapter references, captured fresh on every real run, never a
# separate, hand-maintained script of any kind.
tutorial-section-user-manual: test-e2e-tutorial-browser
	cd docs && pandoc user-manual-ch3-tutorial.md -o ../sql-ledger-ts_Tutorial_Section.pdf \
	  --pdf-engine=xelatex -V documentclass=book -V geometry:margin=1in \
	  -H manual-header-includes.tex -f markdown+raw_tex --resource-path=.
	@echo "Built sql-ledger-ts_Tutorial_Section.pdf"

# The one, real command that proves the Tutorial still passes, on
# both its real paths, AND leaves every real manual it feeds already
# brought back up to date from that exact, same, fresh run - per
# direct instruction: the manuals and the tests are never allowed to
# drift apart, so the one target that runs the real Tutorial is also
# the one that regenerates everything downstream of it, not a
# separate, easy-to-forget, manual step afterward. Real, direct
# composition of three, already-existing, real targets -
# test-e2e-tutorial (the fast, no-browser API path), tutorial-section-
# user-manual (test-e2e-tutorial-browser's own fresh screenshots,
# folded straight into a rebuilt Chapter 3 PDF), and check-docs-
# coverage (which itself regenerates docs/programmer-manual.md before
# checking it) - never a third, parallel implementation of any of the
# three.
test-e2e-tutorial-docs: test-e2e-tutorial tutorial-section-user-manual check-docs-coverage
	@echo "Tutorial verified end to end (API + driven-browser paths); Chapter 3 PDF and the Programmer's Manual both rebuilt from this exact run."

# Renders a real, complete, vector (SVG) illustration of the entire,
# live entity tree -- every real (id, name, parent_id) triple, plus
# every real, labelled relationship link, overlaid as dashed edges.
# Requires `dot` (graphviz) on PATH; run against whatever database is
# currently loaded, so a genuinely minimal, freshly-reset database
# produces a genuinely minimal tree.
entity-tree-svg:
	cd backend && $(RUN_SCRIPT) scripts/generate-entity-tree-svg.ts ../entity_tree.svg
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
	     "*/e2e/test-results/*" "*/test-results/*" \
	     "*/docs/manual-images*" "*.pdf"
	@echo "Checkpoint $(CHECKPOINT): committed, bundled, and zipped."

# A light, real "push and zip" - distinct from `checkpoint` above,
# which commits-and-numbers a full checkpoint. This one assumes the
# work is already committed and just needs to go to origin, plus a
# clean, real zip that matches exactly what's now on GitHub - via
# `git archive`, which only ever includes tracked, committed content,
# so there's no need to hand-maintain an exclude list the way the
# raw-directory zip above does.
release:
	@if [ -n "$$(git status --porcelain)" ]; then echo "Uncommitted changes present - commit first, then run make release."; exit 1; fi
	git push origin main
	mkdir -p dist
	git archive --format=zip -o dist/sql-ledger-ts-$$(git rev-parse --short HEAD).zip HEAD
	@echo "Pushed and archived to dist/sql-ledger-ts-$$(git rev-parse --short HEAD).zip"

