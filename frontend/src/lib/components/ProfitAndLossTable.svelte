<script lang="ts">
  import { auth } from '$lib/state.svelte';
  import { formatAmount } from '$lib/format';
  import { translations } from '$lib/state.svelte';
  import type { ProfitAndLoss, CategoryTreeNode } from '$lib/api';

  export let pl: ProfitAndLoss;

  const fmt = (c: number) => formatAmount(c, auth.current?.user.number_format ?? '1 000.00');
  const cell = (minorUnits: number, isContra: boolean) => (minorUnits === 0 ? '' : isContra ? `(${fmt(minorUnits)})` : fmt(minorUnits));

  let expanded = new Set<string>();
  function toggle(name: string) {
    expanded = new Set(expanded);
    if (expanded.has(name)) expanded.delete(name);
    else expanded.add(name);
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

  $: incomeRows = flatten(pl.income_tree, expanded);
  $: cogsRows = flatten(pl.cogs_tree, expanded);
  $: operatingRows = flatten(pl.operating_expenses_tree, expanded);
</script>

<table>
  <colgroup>
    <col />
    <col class="amount-col" />
    <col class="amount-col" />
  </colgroup>
  <thead>
    <tr class="col-heads">
      <th></th>
      <th class="num">{translations.current['Debit'] ?? 'Debit'}</th>
      <th class="num">{translations.current['Credit'] ?? 'Credit'}</th>
    </tr>
  </thead>
  <tbody>
    <tr class="section-head"><td colspan="3">{translations.current['Income from Retail Sales of Goods'] ?? 'Income from Retail Sales of Goods'}</td></tr>
    <tr class="heavy-rule-row"><td colspan="3"></td></tr>
    {#if incomeRows.length === 0}
      <tr><td colspan="3" class="empty">{translations.current['None'] ?? 'None'}</td></tr>
    {/if}
    {#each incomeRows as row}
      <tr class:clickable={row.hasChildren} onclick={() => row.hasChildren && toggle(row.node.name)}>
        <td style="padding-left: {row.depth * 1.4}rem">
          {#if row.hasChildren}<span class="disclosure">{expanded.has(row.node.name) ? '▾' : '▸'}</span>{/if}{translations.current[row.node.name] ?? row.node.name}
        </td>
        <td class="num mono" class:contra={row.node.is_contra && row.node.debit_minor > 0}>{cell(row.node.debit_minor, row.node.is_contra)}</td>
        <td class="num mono" class:contra={row.node.is_contra && row.node.credit_minor > 0}>{cell(row.node.credit_minor, row.node.is_contra)}</td>
      </tr>
    {/each}
    <tr class="heavy-rule-row"><td colspan="3"></td></tr>
    <tr class="total-row">
      <td><strong>{translations.current['Total'] ?? 'Total'}</strong></td>
      <td class="num mono"></td>
      <td class="num mono"><strong>{fmt(pl.total_income_minor)}</strong></td>
    </tr>
    <tr class="rule-row"><td colspan="3"></td></tr>

    <tr class="section-head"><td colspan="3">{translations.current['Less Costs of Goods Sold'] ?? 'Less Costs of Goods Sold'}</td></tr>
    <tr class="heavy-rule-row"><td colspan="3"></td></tr>
    {#if cogsRows.length === 0}
      <tr><td colspan="3" class="empty">{translations.current['None'] ?? 'None'}</td></tr>
    {/if}
    {#each cogsRows as row}
      <tr class:clickable={row.hasChildren} onclick={() => row.hasChildren && toggle(row.node.name)}>
        <td style="padding-left: {row.depth * 1.4}rem">
          {#if row.hasChildren}<span class="disclosure">{expanded.has(row.node.name) ? '▾' : '▸'}</span>{/if}{translations.current[row.node.name] ?? row.node.name}
        </td>
        <td class="num mono" class:contra={row.node.is_contra && row.node.debit_minor > 0}>{cell(row.node.debit_minor, row.node.is_contra)}</td>
        <td class="num mono" class:contra={row.node.is_contra && row.node.credit_minor > 0}>{cell(row.node.credit_minor, row.node.is_contra)}</td>
      </tr>
    {/each}
    <tr class="heavy-rule-row"><td colspan="3"></td></tr>
    <tr class="total-row">
      <td><strong>{translations.current['Total'] ?? 'Total'}</strong></td>
      <td class="num mono"><strong>{fmt(pl.cogs_expenses.reduce((s, l) => s + l.debit_minor - l.credit_minor, 0))}</strong></td>
      <td class="num mono"></td>
    </tr>
    <tr class="rule-row"><td colspan="3"></td></tr>

    <tr class="section-head"><td colspan="3">{translations.current['Less Other Direct Operating Expenses'] ?? 'Less Other Direct Operating Expenses'}</td></tr>
    <tr class="heavy-rule-row"><td colspan="3"></td></tr>
    {#if operatingRows.length === 0}
      <tr><td colspan="3" class="empty">{translations.current['None'] ?? 'None'}</td></tr>
    {/if}
    {#each operatingRows as row}
      <tr class:clickable={row.hasChildren} onclick={() => row.hasChildren && toggle(row.node.name)}>
        <td style="padding-left: {row.depth * 1.4}rem">
          {#if row.hasChildren}<span class="disclosure">{expanded.has(row.node.name) ? '▾' : '▸'}</span>{/if}{translations.current[row.node.name] ?? row.node.name}
        </td>
        <td class="num mono" class:contra={row.node.is_contra && row.node.debit_minor > 0}>{cell(row.node.debit_minor, row.node.is_contra)}</td>
        <td class="num mono" class:contra={row.node.is_contra && row.node.credit_minor > 0}>{cell(row.node.credit_minor, row.node.is_contra)}</td>
      </tr>
    {/each}
    <tr class="heavy-rule-row"><td colspan="3"></td></tr>
    <tr class="total-row">
      <td><strong>{translations.current['Total'] ?? 'Total'}</strong></td>
      <td class="num mono"><strong>{fmt(pl.operating_expenses.reduce((s, l) => s + l.debit_minor - l.credit_minor, 0))}</strong></td>
      <td class="num mono"></td>
    </tr>
    <tr class="heavy-rule-row"><td colspan="3"></td></tr>

    <tr class="grand-total-row" class:negative={pl.net_income_minor < 0}>
      <td><strong>{translations.current['Total Profit/(Loss)'] ?? 'Total Profit/(Loss)'}</strong></td>
      <td class="num mono"></td>
      <td class="num mono"><strong>{pl.net_income_minor < 0 ? `(${fmt(-pl.net_income_minor)})` : fmt(pl.net_income_minor)}</strong></td>
    </tr>
    <tr class="heavy-rule-row"><td colspan="3"></td></tr>
  </tbody>
</table>

<style>

  .amount-col {
    width: 110px;
  }

  .col-heads th {
    text-align: left;
    border-bottom: 1px solid var(--rule-strong);
    padding-bottom: 0.3rem;
    font-weight: 600;
  }

  .col-heads th.num {
    text-align: right;
  }

  td {
    padding: 0.22rem 0.4rem;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .section-head td {
    font-weight: 700;
    padding-top: 0.6rem;
    white-space: normal;
  }

  .heavy-rule-row td {
    border-top: 2px solid var(--ink);
    padding: 0;
    height: 0;
  }

  .rule-row td {
    border-top: 1px solid var(--rule);
    padding: 0;
    height: 0.5rem;
  }

  .total-row td,
  .grand-total-row td {
    padding-top: 0.15rem;
  }

  .grand-total-row {
    font-size: var(--font-size-large);
  }

  .grand-total-row.negative td {
    color: var(--debit);
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
</style>
