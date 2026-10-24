// Assembles the Historical Design & Decision Log (docs/historical-manual.md)
// - the full, un-trimmed record this project's design, planning, and
// investigation documents ever produced, preserved exactly as written.
// This is the Programmer's Manual's own predecessor: every chapter that
// used to be compiled into the Programmer's Manual itself, before that
// manual was cut down to just the current system (see
// docs/historical-manual-frontmatter.md for why the split exists, and
// docs/programmer-manual.md for the lean, current-state manual this
// document is no longer part of).
//
// Run via `make historical-manual`.
import { buildManual, type Parts } from './manual-builder.ts';

// Exactly the chapter set the Programmer's Manual used to compile, in the
// same logical order it always had - nothing here is an active instruction
// to follow today; see docs/programmer-manual.md for that. Release Notes are
// deliberately excluded - per direct instruction, release notes are their
// own, separate publication (docs/RELEASE-NOTES.md), never folded into
// either manual.
const PARTS: Parts = [
  ['Part I --- Architecture', [
    'coding-standards.md',
    'naming-vocabulary.md',
    'item-terminology-and-storage-design-notes.md',
    'entity-model.md',
    'journal-api-reference.md',
    'stock-api-reference.md',
    'skill-step-runner-design.md',
    'realistic-tutorial-e2e-plan.md',
    'web-ui-interface-plan.md',
    'entity-chains.md',
    'money-model.md',
    'multi-dimensional-reporting.md',
    'contact-types-and-translations.md',
    'session-business-context.md',
    'skill-transactional-integrity.md',
  ]],
  ['Part II --- Technical Infrastructure', [
    'orm-and-commit-path.md',
    'multi-runtime-support.md',
    'css-styling-and-data-entry.md',
    'screens-staging-triggers-functions.md',
    'screens-inventory.md',
    'function-inventory.md',
    'vocabulary-vs-sample-data.md',
    'scoped-uniqueness-and-location-accounting.md',
    'entity-identity-resolution.md',
    'svelte-usage.md',
    'svelte-5-runes-migration-plan.md',
    'one-file-per-page-consolidation-plan.md',
    'wine-bar-assemblies-plan.md',
    'programmer-tooling.md',
    'skill-version-check.md',
  ]],
  ['Part III --- Real, Concrete Design Work', [
    'multicurrency-design.md',
    'storage-space-as-currency-design.md',
    'foreign-currency-receipts-and-payments.md',
    'menu-as-entity-tree-plan.md',
    'translator-form-and-guard-rails-plan.md',
    'account-display-naming-design.md',
    'skill-no-name-encoded-values.md',
    'entities-append-only-redesign.md',
    'entity-mutation-explicitness-and-transactions.md',
    'structured-data-prototype-instance-design.md',
    'ledger-scoped-accounts-and-rollover.md',
    'profit-centers-design.md',
    'access-control-design.md',
    'user-business-role-matrix-design.md',
    'business-admin-role-and-enforcement-design.md',
    'active-ledger-design.md',
  ]],
  ['Part IV --- Planning and Roadmap', [
    'expansion-walker-design.md',
    'pglite-migration-plan.md',
    'chart-of-accounts-hierarchy-editor-plan.md',
    'cold-shelf-storage-inventory-model-plan.md',
    'classification-neutrality-impact.md',
    'classification-neutrality-analysis.md',
    'business-generality-scenario.md',
    'assembly-production-design.md',
    'bulk-rename-plan.md',
    'currency-and-quantity-integrity-fix-plan.md',
    'multi-level-packaging-design.md',
    'unused-functions.md',
    'coa-class-instance-plan.md',
    'ui-completeness-plan.md',
    'sql-ledger-comparison.md',
    'akaunting-comparison.md',
    'business-evolution-plan.md',
    'cash-flow-and-growth-planning.md',
    'future-dated-projection-and-capacity-planning.md',
    'pl-pivot-builder-dnd-plan.md',
    'construction-project-management-plan.md',
    'stock-lifecycle-review-plan.md',
    'min-e2e-coverage-plan.md',
    'svelte-call-trace.md',
    'source-reference-tool.md',
    'naming-conventions-and-entity-glossary.md',
    'skill-branded-types-not-primitives.md',
    'border-multicurrency-pos-plan.md',
    'typed-node-create-design.md',
    'general-typed-hierarchy-resolution-plan.md',
    'cartesian-account-linking-plan.md',
    'inventory-lifecycle-blow-by-blow.md',
    'file-inventory-appendix.md',
    'user-manual-plan.md',
    'audit-appended-prepended-text.md',
  ]],
  ['Part V --- Testing and Simulation', [
    'testing.md',
    'simulation-prompt.md',
    'tutorial-e2e-debug-log.md',
    'tutorial-e2e-hardening-2026-10.md',
  ]],
  ['Appendix --- Lessons Learned', ['lessons-learned.md']],
  ['Part VI --- Claude Skills for This Project', [
    'skill-wine-retail-e2e-and-docs.md',
    'skill-sql-ledger-ui-conventions.md',
    'skill-git-history-safety.md',
    'skill-makefile-only-execution.md',
    'skill-backend-first-testing.md',
    'skill-manual-as-source-of-truth.md',
    'skill-specification-driven-design.md',
    'skill-test-driven-development.md',
    'skill-design-driven-development.md',
    'skill-continual-skill-improvement.md',
    'skill-explicit-skill-attribution.md',
    'skill-test-writing-standard.md',
    'skill-skill-review-after-failure.md',
    'skill-no-new-tables.md',
    'skill-documentation-coverage-enforcement.md',
    'skill-pattern-recognition-to-tooling.md',
    'documentation-coverage-baseline.md',
    'documentation-baseline-report.md',
  ]],
];

buildManual('old/historical-manual.md', 'historical-manual-frontmatter.md', PARTS);
