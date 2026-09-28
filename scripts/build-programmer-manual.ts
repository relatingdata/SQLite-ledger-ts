// Assembles the Programmer's Manual (docs/programmer-manual.md) from this
// project's own chapter documents - one direct concatenation, in the same
// spirit as the User Manual's single-Markdown-source, pandoc-built pipeline.
//
// Run via `make programmer-manual`. Replaces build-programmer-manual.py
// (this project ships no Python).
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const DOCS = fileURLToPath(new URL('../docs/', import.meta.url));
const OUT = join(DOCS, 'programmer-manual.md');

// Logical grouping - not alphabetical, not chronological, but by what a new
// programmer would want to read in order: architecture first, then technical
// infrastructure, then design work (shipped and planned), then testing.
const PARTS: [string, string[]][] = [
  ['Part I --- Architecture', [
    'coding-standards.md',
    'naming-vocabulary.md',
    'item-terminology-and-storage-design-notes.md',
    'entity-model.md',
    'journal-api-reference.md',
    'stock-api-reference.md',
    'skill-step-runner-design.md',
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
  ]],
  ['Appendix --- Release Notes', ['RELEASE-NOTES.md']],
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

// Plain-text stand-ins for glyphs the default LaTeX fonts do not support
// (confirmed by a real failed build), so the intended meaning survives.
const REPLACEMENTS: [string, string][] = [
  ['✅', '[done]'],
  ['❌', '[not done]'],
  ['🔜', '[soon]'],
  ['🔧', '[in progress]'],
  ['─', '-'],
  ['│', '|'],
  ['├', '|'],
  ['└', '`'],
  ['┘', "'"],
  ['┌', '.'],
  ['≤', '<='],
  ['◄', '<'],
  ['┐', '.'],
  ['┤', '|'],
];

function fixGlyphs(text: string): string {
  for (const [bad, good] of REPLACEMENTS) text = text.split(bad).join(good);
  return text;
}

// Bump every heading down one level so each document's own "# Title" becomes
// a chapter nested under its "Part" (book-class convention, as in the User
// Manual where "#" is chapter-level).
function bumpHeadings(text: string): string {
  return text.split('\n').map((line) => (line.startsWith('#') ? '#' + line : line)).join('\n');
}

// Reads a file the way Python's text mode did: universal newlines.
function readText(path: string): string {
  return readFileSync(path, 'utf-8').replace(/\r\n?/g, '\n');
}

// Same count as Python's len(str.splitlines()).
function lineCount(text: string): number {
  if (text === '') return 0;
  const pieces = text.split(/\r\n|[\n\r\v\f\x1c\x1d\x1e\x85\u2028\u2029]/);
  if (pieces[pieces.length - 1] === '') pieces.pop();
  return pieces.length;
}

const pieces: string[] = [readText(join(DOCS, 'programmer-manual-frontmatter.md'))];
for (const [partTitle, files] of PARTS) {
  pieces.push(`\n\\clearpage\n\n# ${partTitle}\n\n`);
  for (const fname of files) {
    const path = join(DOCS, fname);
    if (!existsSync(path)) {
      console.log(`WARNING: missing ${fname}`);
      continue;
    }
    pieces.push('\n\\clearpage\n\n');
    pieces.push(fixGlyphs(bumpHeadings(readText(path))));
    pieces.push('\n');
  }
}

const full = pieces.join('');
writeFileSync(OUT, full, 'utf-8');
console.log(`Wrote ${OUT} (${lineCount(full)} lines)`);
