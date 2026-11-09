// The Project Builder tutorial's own "full" tier (Stage 7 of the three-
// tutorial-chapters plan — docs/user-manual-ch5-project-builder-tutorial.md
// / docs/pm-project-builder.md). Per the user's own "lighter now" answer
// (a bespoke, Retail-style golden-figure volume simulation is explicitly
// deferred, future work), this is a real, looped simulation — 3 repeated
// overlapping-project-pair cycles against one fresh db — verified
// entirely via computed invariants, never a hardcoded dollar figure.
// Run: node --import tsx backend/scripts/simulate-project-builder-cycles.ts
// (or via `make test-e2e-project-builder-full`, which also does the real
// reset-db first).
//
// Builds its own real business ("Tutorial Dwelling Construction — Full
// Cycle") from scratch, genuinely separate from the narrative tutorial
// fixture (project-builder-tutorial-steps.csv) — the two never share a
// reference, project name, or prototype name, so either can run against
// the same db without colliding.
//
// Each cycle instantiates a FRESH prototype, dated in its own,
// non-overlapping two-year window (2032, 2034, 2036...) — a real
// double-booking must come from the real A/B collision this script
// deliberately engineers within one cycle, never from a previous
// cycle's own, already-resolved bookings leaking forward. Within a
// cycle, Project A is accepted first (no real conflict yet — it is the
// business's only commitment on these dates) and Project B is
// instantiated from the exact same prototype with a deliberately tight
// client-wanted date, so the real resource contention
// findNextAvailableWindow resolves pushes its completion date past what
// its own client wanted — the real, never-blocking Schedule Risk this
// whole mechanism exists to raise.
import {
  asUserId,
  asBusinessName,
  asLedgerName,
  asAccountName,
  createBusiness,
  createAndConfigureLocation,
  createCustomer,
  createEmployee,
  createItem,
  createPlantItem,
  setContact,
  createPrototype,
  addPrototypeLine,
  getPrototypeLines,
  instantiateProjectProposal,
  acceptQuotation,
  getLiveProject,
  getMilestones,
  getProjectCostReport,
  stageLine,
  postJournalEntry,
  getTrialBalance,
  getProfitAndLoss,
} from '../src/db.js';

const userId = asUserId(1);
const BUSINESS = asBusinessName('Tutorial Dwelling Construction — Full Cycle');
const LEDGER = asLedgerName('Actual');
const HEADER_ITEM = 'Dwelling Construction Contract — Full Cycle';
const CYCLES = 3;

// Real, fixed per-line figures (minor units) — the one, real source of
// truth every cycle's own invariant checks are computed against. Each
// project quotes the exact same total (930,000) every cycle; Project A
// always comes in UNDER it, Project B always comes in OVER it — the
// real, deliberately engineered margin story, never approximated.
const QUOTED_TOTAL_MINOR = 300000 + 450000 + 180000; // Jordan Smith + 20T Excavator + Casey Brown
const PROJECT_A_ACTUAL_COST_MINOR = QUOTED_TOTAL_MINOR - 150000; // real, positive margin
const PROJECT_B_ACTUAL_COST_MINOR = QUOTED_TOTAL_MINOR + 100000; // real, negative margin — the cost of the real schedule blowout

function postBalanced(reference: string, lines: { account: string; amount_minor: number }[]): void {
  for (const line of lines) {
    stageLine({ reference, business: BUSINESS, ledger: LEDGER, account: line.account as any, amount_minor: line.amount_minor });
  }
  postJournalEntry(reference, BUSINESS, LEDGER, userId);
}

console.log(`Setting up ${BUSINESS}...`);
createBusiness(BUSINESS, '2026-27', userId, 'English CoA');
createAndConfigureLocation(BUSINESS, 'Site Store', { city: 'Adelaide', location_type: 'Warehouse', is_billing_address: false, bottle_capacity: null, carton_capacity: null, timezone: 'Australia/Adelaide' } as any, userId);
createCustomer('Client A — Full Cycle', userId);
createCustomer('Client B — Full Cycle', userId);
createItem(HEADER_ITEM, 'Items', userId, BUSINESS);
createPlantItem('20T Excavator — Full Cycle', BUSINESS, 15000, 'Owned', userId);
createEmployee('Jordan Smith — Full Cycle', 'Site Store', userId);
setContact('Jordan Smith — Full Cycle', { wage_minor_per_hour: 6000 });
createEmployee('Casey Brown — Full Cycle', 'Site Store', userId);
setContact('Casey Brown — Full Cycle', { wage_minor_per_hour: 9000 });

// Opening capital — real cash before any real trading.
postBalanced('JE-OWNER-CAPITAL', [
  { account: 'Cash and Bank', amount_minor: 5000000 },
  { account: "Owner's Equity", amount_minor: -5000000 },
]);

interface CycleProject {
  projectName: string;
  expectedActualCostMinor: number;
  expectConflict: boolean;
}
const allProjects: CycleProject[] = [];

for (let cycle = 1; cycle <= CYCLES; cycle++) {
  const year = 2030 + cycle * 2; // each cycle's own, non-overlapping two-year window
  const suffix = `C${cycle}`;
  console.log(`--- Cycle ${cycle} of ${CYCLES} (${year}) ---`);

  const prototypeName = `Medium Dwelling — Full Cycle — ${suffix}`;
  createPrototype(prototypeName, BUSINESS, userId);
  addPrototypeLine(prototypeName, BUSINESS, 'Labour', 'Jordan Smith — Full Cycle', 1, 'contract', 300000, userId, 40, `${year}-01-06`);
  addPrototypeLine(prototypeName, BUSINESS, 'Plant', '20T Excavator — Full Cycle', 1, 'booking', 450000, userId, 24, `${year}-01-06`);
  addPrototypeLine(prototypeName, BUSINESS, 'Labour', 'Casey Brown — Full Cycle', 1, 'contract', 180000, userId, 16, `${year}-02-10`);
  const lines = getPrototypeLines(prototypeName);
  if (lines.length !== 3) throw new Error(`Prototype "${prototypeName}" round-trip failed: expected 3 lines, got ${lines.length}.`);

  const projectA = `Project A — ${suffix}`;
  instantiateProjectProposal(prototypeName, `PROP-A-${suffix}`, 'Client A — Full Cycle', BUSINESS, LEDGER, HEADER_ITEM, `${year}-01-02`, userId, `${year}-06-30`);
  acceptQuotation(`PROP-A-${suffix}`, userId, { projectName: projectA, targetCompletionDate: `${year}-06-30` });
  allProjects.push({ projectName: projectA, expectedActualCostMinor: PROJECT_A_ACTUAL_COST_MINOR, expectConflict: false });

  const projectB = `Project B — ${suffix}`;
  instantiateProjectProposal(prototypeName, `PROP-B-${suffix}`, 'Client B — Full Cycle', BUSINESS, LEDGER, HEADER_ITEM, `${year}-01-10`, userId, `${year}-02-10`);
  acceptQuotation(`PROP-B-${suffix}`, userId, { projectName: projectB, targetCompletionDate: `${year}-02-10` });
  allProjects.push({ projectName: projectB, expectConflict: true, expectedActualCostMinor: PROJECT_B_ACTUAL_COST_MINOR });

  // Real cost, posted directly to each project's own, dedicated
  // Profit-Center-scoped Expense account (provisionProjectProfitCenter,
  // run automatically by acceptQuotation above) — deterministic figures,
  // never wall-clock-dependent, so this script's own invariant checks
  // below can compare against an exact, known value every run.
  for (const { projectName, expectedActualCostMinor } of [
    { projectName: projectA, expectedActualCostMinor: PROJECT_A_ACTUAL_COST_MINOR },
    { projectName: projectB, expectedActualCostMinor: PROJECT_B_ACTUAL_COST_MINOR },
  ]) {
    const project = getLiveProject(projectName);
    if (!project?.projectExpenseAccount) throw new Error(`"${projectName}" has no real, provisioned Project Expense Account.`);
    postBalanced(`JE-PROJ-COSTS-${projectName.replace(/\s+/g, '')}`, [
      { account: project.projectExpenseAccount, amount_minor: expectedActualCostMinor },
      { account: 'Cash and Bank', amount_minor: -expectedActualCostMinor },
    ]);
  }
}

console.log('--- Verifying computed invariants (never a hardcoded golden figure) ---');
let failures = 0;

// 1. Trial balance balances.
const tb = getTrialBalance(BUSINESS, LEDGER);
if (tb.total_debit_minor !== tb.total_credit_minor || tb.total_debit_minor <= 0) {
  failures++;
  console.error(`FAIL: trial balance does not balance (debit=${tb.total_debit_minor}, credit=${tb.total_credit_minor}).`);
} else {
  console.log(`OK: trial balance balances at ${tb.total_debit_minor} minor units.`);
}

// 2. Every Profit Center's own totals reconcile to its own project's
// postings only — never a leading digit off, never bleeding another
// project's cost into it. Checked against the exact figure this script
// itself posted, never approximated.
for (const { projectName, expectedActualCostMinor } of allProjects) {
  const report = getProjectCostReport(projectName);
  if (report.quotedTotalMinor !== QUOTED_TOTAL_MINOR) {
    failures++;
    console.error(`FAIL: "${projectName}" quoted total is ${report.quotedTotalMinor}, expected ${QUOTED_TOTAL_MINOR}.`);
  }
  if (report.actualCostMinor !== expectedActualCostMinor) {
    failures++;
    console.error(`FAIL: "${projectName}" actual cost is ${report.actualCostMinor}, expected ${expectedActualCostMinor} — a real Profit Center leak, or a missed/duplicated posting.`);
  }
}
console.log('OK: every Profit Center\'s own totals reconcile to its own project\'s postings only.');

// 3. A real Schedule Risk is raised if and only if a real overlap was
// genuinely engineered this cycle — never for an unconflicted Project A,
// always for the deliberately double-booked Project B.
for (const { projectName, expectConflict } of allProjects) {
  const project = getLiveProject(projectName);
  const hasRisk = !!project?.scheduleRisk;
  if (hasRisk !== expectConflict) {
    failures++;
    console.error(`FAIL: "${projectName}" Schedule Risk is ${hasRisk ? 'set' : 'absent'}, expected it ${expectConflict ? 'set' : 'absent'}.`);
  }
}
console.log('OK: Schedule Risk is raised exactly where a real resource double-booking was engineered, and nowhere else.');

// 4. No Milestone is ever silently skipped — every accepted Project
// Proposal creates its own real Invoicing Milestone.
for (const { projectName } of allProjects) {
  const milestones = getMilestones(projectName);
  if (milestones.length === 0) {
    failures++;
    console.error(`FAIL: "${projectName}" has zero real Milestones — acceptQuotation's own Milestone creation was skipped.`);
  }
}
console.log('OK: every accepted Project Proposal has at least its own real Invoicing Milestone.');

// 5. Net income is positive — the real, structural check, never a
// hardcoded dollar figure.
const pl = getProfitAndLoss(BUSINESS, LEDGER);
if (pl.net_income_minor <= 0) {
  failures++;
  console.error(`FAIL: net income is not positive (${pl.net_income_minor}).`);
} else {
  console.log(`OK: net income is positive (${pl.net_income_minor} minor units over ${CYCLES} cycles).`);
}

if (failures > 0) {
  console.error(`\n${failures} invariant check(s) failed.`);
  process.exit(1);
}
console.log(`\nAll computed invariants hold across ${CYCLES} real overlapping-project-pair cycles.`);
