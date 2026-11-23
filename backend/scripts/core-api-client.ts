// The step runner's side of the core middleware's frontend API
// (src/core/api.ts): it builds each step into one request of the
// protocol, sends it, and reads the reply - exactly what a frontend does.
//
// With STEP_RUNNER_API_URL set the request goes over HTTP to a running
// backend (POST <url>/api/core/call). Otherwise the same request text is
// handed to the same handler in this process, with no server needed.

import { splitCsvLine, csvField, unescapeAscii, readCsv } from '../../shared-fixtures/csv.js';
import { callCore } from '../src/core/api.js';
import type { Step, Screen } from './step-runner.js';

export interface ApiReply {
  ok: boolean;
  status: number;
  /** The values of a single-result reply. */
  row: string[];
  /** The rows of a list reply, keyed by its header. */
  table: Record<string, string>[];
  error?: string;
}

export class CoreApiClient {
  token: string | undefined;

  constructor(private readonly baseUrl: string | undefined = process.env.STEP_RUNNER_API_URL) {}

  get transport(): string {
    return this.baseUrl ? `HTTP ${this.baseUrl}/api/core/call` : 'in-process';
  }

  async call(name: string, values: string[] = []): Promise<ApiReply> {
    const body = [name, ...values].map(csvField).join(',');
    let status: number;
    let text: string;
    if (this.baseUrl) {
      const response = await fetch(`${this.baseUrl}/api/core/call`, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain', ...(this.token ? { Authorization: `Bearer ${this.token}` } : {}) },
        body,
      });
      status = response.status;
      text = await response.text();
    } else {
      const reply = callCore(body, this.token);
      status = reply.status;
      text = reply.body;
    }
    const newline = text.indexOf('\n');
    const first = newline === -1 ? text : text.slice(0, newline);
    const fields = splitCsvLine(first).map(unescapeAscii);
    if (fields[0] !== 'ok') return { ok: false, status, row: [], table: [], error: fields.slice(1).join(',') || `HTTP ${status}` };
    return { ok: true, status, row: fields.slice(1), table: newline === -1 ? [] : readCsv(text.slice(newline + 1)) };
  }

  /** A call whose failure is the step's failure. */
  async must(name: string, values: string[] = []): Promise<ApiReply> {
    const reply = await this.call(name, values);
    if (!reply.ok) throw new Error(reply.error);
    return reply;
  }
}

type Args = Record<string, string>;
type Verify = (a: Args, api: CoreApiClient) => Promise<boolean>;

// Figures recorded by one step for a later step to compare against.
const recordedTrialBalanceTotals = new Map<string, number>();
const recordedNetIncome = new Map<string, number>();
const tbKey = (a: Args) => `${a.businessName}::${a.ledger}::${a.asOfDate ?? ''}`;
const plKey = (a: Args) => `${a.businessName}::${a.ledger}::${a.fromDate ?? ''}::${a.toDate ?? ''}`;

async function trialBalance(a: Args, api: CoreApiClient): Promise<{ debit: number; credit: number }> {
  const [debit, credit] = (await api.must('getTrialBalance', [a.businessName, a.ledger, a.asOfDate ?? ''])).row.map(Number);
  return { debit, credit };
}

async function profitAndLoss(a: Args, api: CoreApiClient): Promise<{ income: number; expense: number; net: number }> {
  const [income, expense, net] = (await api.must('getProfitAndLoss', [a.businessName, a.ledger, a.fromDate ?? '', a.toDate ?? ''])).row.map(Number);
  return { income, expense, net };
}

/** The outer groups of a breakdown, each with the keys of its inner groups. */
async function byAxis(a: Args, api: CoreApiClient, outer: string, inner: string): Promise<{ key: string; net: number; children: string[] }[]> {
  const rows = (await api.must('getProfitAndLossByAxis', [a.businessName, a.ledger, a.fromDate ?? '', a.toDate ?? '', outer, inner])).table;
  return rows
    .filter((r) => r.inner === '')
    .map((r) => ({ key: r.outer, net: Number(r.net_income_minor), children: rows.filter((c) => c.outer === r.outer && c.inner !== '').map((c) => c.inner) }));
}

async function exists(api: CoreApiClient, kind: string, name: string, business = '', ledger = ''): Promise<boolean> {
  return (await api.must('exists', [kind, name, business, ledger])).row[0] === 'true';
}

async function stock(a: Args, api: CoreApiClient): Promise<Record<string, string>[]> {
  return (await api.must('getInventoryListing', [a.businessName ?? '', a.ledger ?? ''])).table;
}

async function project(a: Args, api: CoreApiClient): Promise<{ risk: string; margin: number }> {
  const row = (await api.must('getProject', [a.projectName])).row;
  return { risk: row[0], margin: Number(row[3]) };
}

const list = (text: string | undefined) => (text ?? '').split(',').map((r) => r.trim()).filter(Boolean);

/** What each check reads through the API, and what it requires of the reply. */
export const CORE_API_VERIFY: Record<string, Verify> = {
  business_exists: (a, api) => exists(api, 'Business', a.businessName),
  location_exists: (a, api) => exists(api, 'Location', a.locationName, a.businessName),
  cash_at_bank_exists: (a, api) => exists(api, 'Account', 'Cash at Bank', a.businessName),
  entity_named_exists: (a, api) => exists(api, 'Anything', a.name, a.businessName ?? ''),
  transfer_landed: async (a, api) => (await stock(a, api)).some((r) => r.location === a.toLocationName && r.item === a.itemName && Number(r.quantity_on_hand) > 0),
  stock_on_hand_nonnegative: async (a, api) => (await stock(a, api)).every((r) => Number(r.quantity_on_hand) >= 0),
  purchase_order_posted: async (a, api) => {
    const reply = await api.call('getEntry', [a.reference, a.businessName, a.ledger]);
    return reply.ok && reply.row[1] === 'placed';
  },
  item_source_registered: async (a, api) => (await api.call('getItemSource', [a.businessName, a.itemName, a.providerName])).ok,
  bom_components_recorded: async (a, api) => {
    const reply = await api.call('getRecipeLines', [a.assemblyItem, a.businessName ?? '', a.ledger ?? '']);
    return reply.ok && reply.table.length === Number(a.expectedCount);
  },
  prototype_line_updated: async (a, api) => {
    const lines = (await api.must('getRecipeLines', [a.prototypeName, '', ''])).table;
    return lines.some((l) => l.component === a.component && Number(l.price_minor) === Number(a.expectedPriceMinor));
  },
  schedule_risk_absent: async (a, api) => (await project(a, api)).risk === '',
  schedule_risk_flagged: async (a, api) => (await project(a, api)).risk !== '',
  project_margin_sign: async (a, api) => {
    const margin = (await project(a, api)).margin;
    return a.expectedSign === 'positive' ? margin > 0 : margin < 0;
  },
  trial_balance_balanced: async (a, api) => {
    const t = await trialBalance(a, api);
    return t.debit === t.credit && t.debit > 0;
  },
  balance_sheet_balanced: async (a, api) => {
    const row = (await api.must('getBalanceSheet', [a.businessName, a.ledger, a.asOfDate ?? ''])).row;
    return row[4] === 'true' && Number(row[0]) > 0;
  },
  record_trial_balance_total: async (a, api) => {
    recordedTrialBalanceTotals.set(tbKey(a), (await trialBalance(a, api)).debit);
    return true;
  },
  trial_balance_total_matches_recorded: async (a, api) => recordedTrialBalanceTotals.get(tbKey(a)) === (await trialBalance(a, api)).debit,
  profit_and_loss_positive: async (a, api) => (await profitAndLoss(a, api)).net > 0,
  profit_and_loss_zero: async (a, api) => {
    const p = await profitAndLoss(a, api);
    return p.net === 0 && p.income === 0;
  },
  record_profit_and_loss_net_income: async (a, api) => {
    recordedNetIncome.set(plKey(a), (await profitAndLoss(a, api)).net);
    return true;
  },
  profit_and_loss_net_income_matches_recorded: async (a, api) => recordedNetIncome.get(plKey(a)) === (await profitAndLoss(a, api)).net,
  profit_and_loss_by_item_single_row: async (a, api) => {
    const nodes = await byAxis(a, api, 'Item', 'Consolidated');
    const item = nodes.find((n) => n.key === a.itemName);
    const summed = nodes.reduce((sum, n) => sum + n.net, 0);
    return !!item && item.net > 0 && summed === (await profitAndLoss(a, api)).net;
  },
  profit_and_loss_group_has_item: async (a, api) => {
    // The value valueName of the inner hierarchy holds the item itemName.
    const group = (await byAxis(a, api, a.innerAxis, 'Item')).find((n) => n.key === a.valueName);
    return !!group && group.children.includes(a.itemName);
  },
  profit_and_loss_group_is_whole: async (a, api) => {
    const nodes = await byAxis(a, api, a.outerAxis, a.innerAxis);
    const total = (await profitAndLoss(a, api)).net;
    const group = nodes.find((n) => n.key === a.valueName);
    return !!group && group.net === total && nodes.reduce((sum, n) => sum + n.net, 0) === total;
  },
  user_has_exact_roles: async (a, api) => {
    const expected = list(a.roles).sort();
    const actual = (await api.must('getUserRoles', [a.username])).table.map((r) => r.role).sort();
    return expected.length === actual.length && expected.every((r, n) => r === actual[n]);
  },
  translation_matches: async (a, api) => (await api.must('getTranslation', [a.concept, a.language])).row[0] === a.translationText,
  location_in_hierarchy_group: async (a, api) => (await api.must('getGroup', [a.businessName, a.locationName, a.hierarchyName])).row[0] === a.valueName,
  in_hierarchy_value: async (a, api) => (await api.must('getGroup', [a.businessName, a.entityName, a.hierarchyName])).row[0] === a.valueName,
  hierarchy_prototype_exists: async (a, api) => (await api.must('listHierarchyPrototypes', [a.businessName])).table.some((r) => r.prototype === a.prototypeName),
};

/** The API function a session screen maps to. */
const SESSION_CALLS: Record<string, string> = { Login: 'login', 'Select Business': 'selectBusiness', 'Switch Session': 'switchSession' };

/** Runs one step through the frontend API: the screen's function is called
 * with the step's values in order, then the step's check, if it has one,
 * is made from what the API returns. */
export async function runStepViaFrontendApi(step: Step, screens: Map<string, Screen>, api: CoreApiClient): Promise<{ ok: boolean; error?: string }> {
  try {
    const screen = screens.get(step.screen_name);
    const args: Args = {};
    for (const field of screen?.fields ?? []) args[field.field_name] = step.values[field.position - 1] ?? '';

    const name = screen?.screen_kind === 'session' ? SESSION_CALLS[step.screen_name] : screen?.api_function;
    if (name) {
      const reply = await api.call(name, step.values);
      if (!reply.ok) return { ok: false, error: reply.error };
      if (name === 'login') api.token = reply.row[0];
    }
    if (step.verify) {
      const verify = CORE_API_VERIFY[step.verify];
      if (!verify) return { ok: false, error: `No check named "${step.verify}" for the frontend API.` };
      if (!(await verify(args, api))) return { ok: false, error: `Verify "${step.verify}" returned false.` };
    }
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}
