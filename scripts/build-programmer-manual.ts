// Assembles the Programmer's Manual (docs/programmer-manual.md) - the lean,
// current-system-only manual: what you'd need open to reimplement any API
// or UI functionality in this application, and the one true source of
// information on the implementation and testing of the system as it
// stands today. For the full, un-trimmed design/planning history this
// manual used to carry, see docs/historical-manual.md (built by
// build-historical-manual.ts).
//
// Run via `make programmer-manual`.
import { buildManual, type Parts } from './manual-builder.ts';

// Ordered the way a programmer reimplementing this system would actually
// want to read it: what it is and where the real spec lives, then the data
// model, then the domain concepts built on it, then the two API surfaces,
// then the frontend, then testing (split low-level vs. test-runner/e2e per
// direct instruction), then how to build/run it, then the naming glossary.
// Release Notes are deliberately excluded - they are their own, separate
// publication (docs/RELEASE-NOTES.md), never folded into either manual.
const PARTS: Parts = [
  ['Part 1 --- System Overview', [
    'pm-system-overview.md',
  ]],
  ['Part 2 --- The Entity Model', [
    'pm-entity-model.md',
  ]],
  ['Part 3 --- Core Domain Reference', [
    'pm-domain-reference.md',
  ]],
  ['Part 4 --- Backend API Reference', [
    'pm-journal-api.md',
    'pm-stock-api.md',
    'function-inventory.md',
  ]],
  ['Part 5 --- Frontend Reference', [
    'pm-frontend-reference.md',
  ]],
  ['Part 6 --- Testing: Unit, Sanity, and Compile-Level', [
    'pm-testing-unit.md',
  ]],
  ['Part 7 --- Testing: The Test-Runner, Tutorial, and Full-Volume Simulation', [
    'pm-testing-e2e.md',
  ]],
  ['Part 8 --- Build, Run & Tooling', [
    'pm-build-and-tooling.md',
  ]],
  ['Part 9 --- Naming Glossary', [
    'pm-naming-glossary.md',
  ]],
  ['Appendix --- Claude Skills Index', [
    'pm-skills-index.md',
  ]],
];

buildManual('programmer-manual.md', 'programmer-manual-frontmatter.md', PARTS);
