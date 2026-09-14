# Minimal, Comprehensive E2E Coverage: A Real Plan

Per direct request: at least one real e2e test exercising every real
data path on both frontend and backend, distinct from (not a
replacement for) the existing 52, more detailed, scenario-based
Playwright tests. Documented and planned here before any execution,
per direct instruction and the `design-driven-development` skill.

## 1. Confirm reality first

Directly counted, not assumed:

- **79 real frontend pages** (`+page.svelte` files).
- **52 real, existing Playwright tests**, together visiting 58 of
  those 79 routes via at least one direct `page.goto(...)` call.
- **23 real routes never directly visited by any existing test**:
  `/arap`, `/arap/quotations`, `/arap/rfq`, `/cash`,
  `/exchange-rates`, `/gl/fx-adjustment`, `/goods-services`, `/jobs`,
  `/journal/[id]/[date]`, `/logistics/assembly-bom`,
  `/order-entry/generate-invoices`, `/order-entry/generate-po`,
  `/reconciliation`, `/recurring`, `/reports`, `/setup/currencies`,
  `/setup/taxes`, `/shipping`, `/stock`, `/vouchers/general-ledger`,
  `/vouchers/payable`, `/vouchers/payment`.
- **22 real backend route files** under `backend/src/routes/`.
- Several of the 23 untested pages are real, confirmed stubs (per
  `docs/ui-completeness-plan.md`) - still worth visiting once, to
  confirm they render their real "not yet implemented" state rather
  than crashing, but genuinely lower-value to test deeply.

## 2. What "min-e2e" means here, concretely

**Not** a replacement for the existing 52 tests, which exercise real,
specific business scenarios in depth. **A separate, new, fast,
minimal smoke layer**: one real test suite that visits every one of
the 79 real routes at least once, logged in, with a real business
selected, asserting only that the page renders without a real
JavaScript error and without an unhandled server error (a genuine,
low bar, deliberately) - not that every field/button on that page
works correctly (the existing 52 tests, and any future, deeper ones,
own that job).

## 3. Real design decisions

1. **One real Playwright spec file**
   (`e2e/tests/min-e2e-route-smoke.spec.ts`), driven by a real,
   literal array of all 79 routes (not derived by scanning the
   filesystem at test-run time - a real, static, reviewable list, so
   a route disappearing or a genuinely new one appearing is a visible,
   real diff in this file, not a silent behavior change).
2. **Real, shared login/business-selection setup**, once, matching the
   established pattern already proven across this project's other
   tests - not a new pattern invented for this file.
3. **Per route**: `page.goto(route)`, wait briefly, assert
   `page.locator('body')` is visible and no real `pageerror` event
   fired during the visit. Routes with a real, required dynamic
   segment (`/journal/[id]/[date]`) get a real, valid, concrete
   example value substituted, not skipped.
4. **Backend route coverage**: per direct instruction, "every data
   path" includes the backend too. Rather than a second, separate
   backend-only sweep, this smoke test's own real value is that
   visiting each frontend page already exercises whichever real
   backend route(s) that page calls on load - a genuine, indirect,
   but real form of backend route coverage, confirmed by checking
   network responses for a real 200 (or an expected, real 401/403 for
   a route requiring a permission the test user doesn't have) rather
   than a 500.
5. **Kept fast, per `backend-first-testing`'s own spirit**: this file
   only checks "did it load," never a specific business assertion -
   that discipline is what keeps it a genuinely quick, run-often smoke
   layer rather than a second copy of the detailed suite.

## 4. Real Makefile target

`make playwright-smoke` - runs only this one spec file, fast, distinct
from `make playwright-all` (the full, existing 52-test suite) and
`make playwright-tutorial` (the from-scratch business walkthrough).

## 5. Code-comment discipline going forward

Per direct instruction: new code comments should be brief, pointing
to the relevant Programmer's/User Manual section for full detail,
rather than restating the full, real rationale inline every time -
reducing duplication between code and manual. This plan document
itself, and the manual chapter describing this smoke layer, are the
real, canonical explanation; the test file's own comments should point
here, briefly, not repeat this document's content.

## 6. Sequencing

1. This plan document (done).
2. The real Makefile target and spec file (next, real execution step).
3. A first, real run, fixing any genuine, individual route failures
   found - each one a real, direct, separate finding, not assumed
   away.
4. The separate, real manual-freshness review, requested to follow
   this "as soon as possible" - a distinct, later pass, not combined
   into this one.
