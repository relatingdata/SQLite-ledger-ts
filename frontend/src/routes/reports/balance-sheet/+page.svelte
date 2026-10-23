<script lang="ts">
  import { auth } from '$lib/state.svelte';
  import { formatAmount, todayIsoDate } from '$lib/format';
  import { onMount } from 'svelte';
  import { session } from '$lib/state.svelte';
  import { getBalanceSheet, ApiError, type BalanceSheet, type CategoryTreeNode } from '$lib/api';
  import { translations } from '$lib/state.svelte';

  let bs: BalanceSheet | null = $state(null);
  let loading = $state(true);
  let error = $state('');
  let asOfDate = $state(todayIsoDate());

  // Split on {NAME} and render as template content, never {@html} — see docs/pm-frontend-reference.md.
  let introTemplate = $derived(translations.current['For {NAME} only.'] ?? 'For {NAME} only.');
  let introItems = $derived(introTemplate.split('{NAME}'));

  let latestRequestId = 0;
  async function load() {
    const requestId = ++latestRequestId;
    loading = true;
    try {
      const result = await (session.current ? getBalanceSheet(session.current.businessName, session.current.ledgerName, asOfDate || undefined) : Promise.reject(new Error('No ledger selected.')));
      if (requestId !== latestRequestId) return;
      bs = result;
    } catch (e) {
      if (requestId !== latestRequestId) return;
      error = e instanceof ApiError ? e.message : 'Failed to load.';
    } finally {
      if (requestId === latestRequestId) loading = false;
    }
  }

  onMount(load);

  const fmt = (c: number) => formatAmount(c, auth.current?.user.number_format ?? '1 000.00');
  // Contra amounts parenthesized/red wherever they fall — see docs/pm-frontend-reference.md.
  const cell = (minorUnits: number, isContra: boolean) => (minorUnits === 0 ? '' : isContra ? `(${fmt(minorUnits)})` : fmt(minorUnits));

  // Section totals land in the correct debit/credit column even on a deficit — see docs/pm-frontend-reference.md.
  function totalCell(amountMinor: number, normalSide: 'debit' | 'credit') {
    const isNormal = amountMinor >= 0;
    const magnitude = Math.abs(amountMinor);
    const debit = (normalSide === 'debit') === isNormal ? magnitude : 0;
    const credit = (normalSide === 'debit') === isNormal ? 0 : magnitude;
    return { debit: cell(debit, !isNormal), credit: cell(credit, !isNormal), debitContra: !isNormal && debit > 0, creditContra: !isNormal && credit > 0 };
  }

  // Categories start collapsed, each section its own expand state — see docs/pm-frontend-reference.md.
  let expandedAssets = $state(new Set<string>());
  let expandedLiabilities = $state(new Set<string>());
  let expandedEquity = $state(new Set<string>());
  function toggle(set: Set<string>, name: string): Set<string> {
    const next = new Set(set);
    if (next.has(name)) next.delete(name);
    else next.add(name);
    return next;
  }

  interface FlatRow {
    node: CategoryTreeNode;
    depth: number;
    hasChildren: boolean;
  }
  function flatten(nodes: CategoryTreeNode[], expandedSet: Set<string>, depth = 0): FlatRow[] {
    const rows: FlatRow[] = [];
    for (const node of nodes) {
      const hasChildren = !node.is_leaf && node.children.length > 0;
      rows.push({ node, depth, hasChildren });
      if (hasChildren && expandedSet.has(node.name)) rows.push(...flatten(node.children, expandedSet, depth + 1));
    }
    return rows;
  }

  let assetRows = $derived.by(() => bs ? flatten(bs.assets_tree, expandedAssets) : []);
  let liabilityRows = $derived.by(() => bs ? flatten(bs.liabilities_tree, expandedLiabilities) : []);
  let equityRows = $derived.by(() => bs ? flatten(bs.equity_tree, expandedEquity) : []);
</script>

<svelte:head><title>{translations.current['Balance Sheet'] ?? 'Balance Sheet'}</title></svelte:head>

<fieldset class="page-title">
  <legend>{translations.current['Balance Sheet'] ?? 'Balance Sheet'}</legend>
  <p class="intro">{introItems[0]}<strong>{session.current?.ledgerName ?? '…'}</strong>{introItems[1] ?? ''}</p>

  <div class="as-of">
    <fieldset>
      <legend>{translations.current['As of date'] ?? 'As of date'}</legend>
      <input type="date" bind:value={asOfDate} onchange={load} />
    </fieldset>
    {#if asOfDate}<button class="link" onclick={() => { asOfDate = ''; load(); }}>{translations.current['Clear (show all time)'] ?? 'Clear (show all time)'}</button>{/if}
  </div>

{#if loading}
  <p>Loading…</p>
{:else if error}
  <p class="error">{error}</p>
{:else if bs}
  <div class="columns">
    <fieldset class="card-legend section">
      <legend>{translations.current['Assets'] ?? 'Assets'}</legend>
      <table>
        <thead>
          <tr>
            <th></th>
            <th class="num">{translations.current['Debit'] ?? 'Debit'}</th>
            <th class="num">{translations.current['Credit'] ?? 'Credit'}</th>
          </tr>
        </thead>
        <tbody>
          {#if assetRows.length === 0}
            <tr><td colspan="3" class="empty">{translations.current['None'] ?? 'None'}</td></tr>
          {/if}
          {#each assetRows as row}
            <tr class:clickable={row.hasChildren} onclick={() => row.hasChildren && (expandedAssets = toggle(expandedAssets, row.node.name))}>
              <td style="padding-left: {row.depth * 1.2}rem">
                {#if row.hasChildren}<span class="disclosure">{expandedAssets.has(row.node.name) ? '▾' : '▸'}</span>{/if}{translations.current[row.node.name] ?? row.node.name}
              </td>
              <td class="num mono" class:contra={row.node.is_contra && row.node.debit_minor > 0}>{cell(row.node.debit_minor, row.node.is_contra)}</td>
              <td class="num mono" class:contra={row.node.is_contra && row.node.credit_minor > 0}>{cell(row.node.credit_minor, row.node.is_contra)}</td>
            </tr>
          {/each}
        </tbody>
        <tfoot>
          <tr>
            <td><strong>{translations.current['Total Assets'] ?? 'Total Assets'}</strong></td>
            <td class="num mono" class:contra={totalCell(bs.total_assets_minor, 'debit').debitContra}><strong>{totalCell(bs.total_assets_minor, 'debit').debit}</strong></td>
            <td class="num mono" class:contra={totalCell(bs.total_assets_minor, 'debit').creditContra}><strong>{totalCell(bs.total_assets_minor, 'debit').credit}</strong></td>
          </tr>
        </tfoot>
      </table>
    </fieldset>

    <div class="stacked outer-box">
      <fieldset class="card-legend section">
        <legend>{translations.current['Liabilities'] ?? 'Liabilities'}</legend>
        <table>
          <thead>
            <tr>
              <th></th>
              <th class="num">{translations.current['Debit'] ?? 'Debit'}</th>
              <th class="num">{translations.current['Credit'] ?? 'Credit'}</th>
            </tr>
          </thead>
          <tbody>
            {#if liabilityRows.length === 0}
              <tr><td colspan="3" class="empty">{translations.current['None'] ?? 'None'}</td></tr>
            {/if}
            {#each liabilityRows as row}
              <tr class:clickable={row.hasChildren} onclick={() => row.hasChildren && (expandedLiabilities = toggle(expandedLiabilities, row.node.name))}>
                <td style="padding-left: {row.depth * 1.2}rem">
                  {#if row.hasChildren}<span class="disclosure">{expandedLiabilities.has(row.node.name) ? '▾' : '▸'}</span>{/if}{translations.current[row.node.name] ?? row.node.name}
                </td>
                <td class="num mono" class:contra={row.node.is_contra && row.node.debit_minor > 0}>{cell(row.node.debit_minor, row.node.is_contra)}</td>
                <td class="num mono" class:contra={row.node.is_contra && row.node.credit_minor > 0}>{cell(row.node.credit_minor, row.node.is_contra)}</td>
              </tr>
            {/each}
          </tbody>
          <tfoot>
            <tr>
              <td><strong>{translations.current['Total Liabilities'] ?? 'Total Liabilities'}</strong></td>
              <td class="num mono" class:contra={totalCell(bs.total_liabilities_minor, 'credit').debitContra}><strong>{totalCell(bs.total_liabilities_minor, 'credit').debit}</strong></td>
              <td class="num mono" class:contra={totalCell(bs.total_liabilities_minor, 'credit').creditContra}><strong>{totalCell(bs.total_liabilities_minor, 'credit').credit}</strong></td>
            </tr>
          </tfoot>
        </table>
      </fieldset>

      <fieldset class="card-legend section">
        <legend>{translations.current['Equity'] ?? 'Equity'}</legend>
        <table>
          <thead>
            <tr>
              <th></th>
              <th class="num">{translations.current['Debit'] ?? 'Debit'}</th>
              <th class="num">{translations.current['Credit'] ?? 'Credit'}</th>
            </tr>
          </thead>
          <tbody>
            {#if equityRows.length === 0}
              <tr><td colspan="3" class="empty">{translations.current['None'] ?? 'None'}</td></tr>
            {/if}
            {#each equityRows as row}
              <tr class:clickable={row.hasChildren} onclick={() => row.hasChildren && (expandedEquity = toggle(expandedEquity, row.node.name))}>
                <td style="padding-left: {row.depth * 1.2}rem">
                  {#if row.hasChildren}<span class="disclosure">{expandedEquity.has(row.node.name) ? '▾' : '▸'}</span>{/if}{translations.current[row.node.name] ?? row.node.name}
                </td>
                <td class="num mono" class:contra={row.node.is_contra && row.node.debit_minor > 0}>{cell(row.node.debit_minor, row.node.is_contra)}</td>
                <td class="num mono" class:contra={row.node.is_contra && row.node.credit_minor > 0}>{cell(row.node.credit_minor, row.node.is_contra)}</td>
              </tr>
            {/each}
          </tbody>
          <tfoot>
            <tr>
              <td><strong>{translations.current['Total Equity'] ?? 'Total Equity'}</strong></td>
              <td class="num mono" class:contra={totalCell(bs.total_equity_minor, 'credit').debitContra}><strong>{totalCell(bs.total_equity_minor, 'credit').debit}</strong></td>
              <td class="num mono" class:contra={totalCell(bs.total_equity_minor, 'credit').creditContra}><strong>{totalCell(bs.total_equity_minor, 'credit').credit}</strong></td>
            </tr>
          </tfoot>
        </table>
      </fieldset>

      <p class="grand-total">
        <strong>{translations.current['Total Liabilities + Equity'] ?? 'Total Liabilities + Equity'}</strong>
        <span class="num mono">{fmt(bs.total_liabilities_minor + bs.total_equity_minor)}</span>
      </p>
    </div>
  </div>

  <p class="status" class:balanced={bs.balanced}>
    {bs.balanced
      ? `✓ ${translations.current['Assets'] ?? 'Assets'} = ${translations.current['Liabilities'] ?? 'Liabilities'} + ${translations.current['Equity'] ?? 'Equity'}`
      : `${translations.current['Assets'] ?? 'Assets'} \u2260 ${translations.current['Liabilities'] ?? 'Liabilities'} + ${translations.current['Equity'] ?? 'Equity'}`}
  </p>
{/if}
</fieldset>

<style>

  .columns {
    display: grid;
    grid-template-columns: 1fr 1fr;
    align-items: end;
    gap: 1.2rem;
  }

  @media (max-width: 800px) {
    .columns {
      grid-template-columns: 1fr;
    }
  }

  .section {
    padding: 1rem 1.2rem 1.2rem;
  }

  .stacked {
    display: flex;
    flex-direction: column;
    gap: 1.2rem;
  }

  .outer-box {
    border: 1px solid var(--rule);
    border-radius: 6px;
    background: var(--paper);
    padding: 1.4rem 0 1rem;
  }

  tfoot td {
    border-bottom: none;
    border-top: 2px solid var(--rule-strong);
  }

  .contra {
    color: var(--debit, #b1442e);
  }

  .empty {
    text-align: center;
    color: var(--ink-soft);
    font-style: italic;
  }

  .clickable {
    cursor: pointer;
  }

  .clickable:hover td {
    background: var(--paper-dim, #f2ede1);
  }

  .disclosure {
    display: inline-block;
    width: 1rem;
    color: var(--ink-soft);
  }

  .status {
    margin-top: 1rem;
    text-align: center;
    font-weight: 600;
    color: var(--debit);
  }

  .status.balanced {
    color: var(--credit);
  }

  .grand-total {
    display: flex;
    justify-content: space-between;
    padding: 0.6rem calc(1.2rem + 0.7em) 0;
    margin: 0;
    font-size: var(--font-size-medium);
  }

  .grand-total .num {
    font-weight: 700;
  }
  .as-of {
    display: flex;
    align-items: flex-end;
    gap: 0.8rem;
    margin-bottom: 1rem;
  }

  .link {
    background: none;
    border: none;
    color: var(--brass-dark);
    text-decoration: underline;
    cursor: pointer;
    font-size: var(--font-size-base);
    padding: 0.4rem 0;
  }
</style>
