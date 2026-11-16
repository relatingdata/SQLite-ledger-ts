<script lang="ts">
  // The Pivot trait: cells of row value x column value, each showing the
  // pivot's measures, with row, column and grand totals. Totals sum the
  // cells' figures and then work out the measures, so a ratio (a margin
  // percentage) is right in a total too. With a highlight measure, each
  // cell is shaded from red (the worst in its row, or column) to green
  // (the best): under-performing and excellent places stand out.
  import { auth, translations } from '$lib/state.svelte';
  import { formatAmount } from '$lib/format';
  import type { PivotCell, Measure } from '$lib/screen-runtime';

  let {
    cells,
    measures,
    derive,
    rowAxis,
    colAxis,
    rowFilter = '',
    colFilter = '',
    highlight: initialHighlight,
    across = 'row',
    emptyText = 'No activity for this combination.',
  }: {
    cells: PivotCell[];
    measures: Measure[];
    derive: (base: Record<string, number>) => Record<string, number | null>;
    rowAxis: string;
    colAxis: string;
    rowFilter?: string;
    colFilter?: string;
    highlight?: string;
    across?: 'row' | 'column';
    emptyText?: string;
  } = $props();

  const t = (word: string) => translations.current[word] ?? word;
  // Clicking a measure's heading shades by it instead (again: by none).
  let chosen: string | null | undefined = $state(undefined);
  const highlight = $derived(chosen === undefined ? initialHighlight : (chosen ?? undefined));
  const choose = (name: string) => (chosen = highlight === name ? null : name);
  const shown = $derived(cells.filter((c) => (!rowFilter || c.row === rowFilter) && (!colFilter || c.col === colFilter)));
  const rowKeys = $derived([...new Set(shown.map((c) => c.row))].sort());
  const colKeys = $derived([...new Set(shown.map((c) => c.col))].sort());

  function sum(of: PivotCell[]): Record<string, number> {
    const total: Record<string, number> = {};
    for (const c of of) for (const [k, v] of Object.entries(c.base)) total[k] = (total[k] ?? 0) + v;
    return total;
  }
  const cellMap = $derived(new Map(shown.map((c) => [`${c.row}\u0000${c.col}`, c])));
  const at = (row: string, col: string) => {
    const c = cellMap.get(`${row}\u0000${col}`);
    return c ? derive(c.base) : null;
  };
  const rowTotal = (row: string) => derive(sum(shown.filter((c) => c.row === row)));
  const colTotal = (col: string) => derive(sum(shown.filter((c) => c.col === col)));
  const grand = $derived(derive(sum(shown)));

  function show(value: number | null | undefined, format: Measure['format']): string {
    if (value == null) return '—';
    if (format === 'percent') return `${value.toFixed(1)}%`;
    if (format === 'quantity') return (Math.round(value * 100) / 100).toLocaleString();
    return formatAmount(Math.round(value), auth.current?.user.number_format ?? '1 000.00');
  }

  // Each row's (or column's) best and worst for the highlight measure.
  function range(values: (number | null)[]): [number, number] | null {
    const real = values.filter((v): v is number => v != null);
    return real.length < 2 ? null : [Math.min(...real), Math.max(...real)];
  }
  const ranges = $derived.by(() => {
    const out = new Map<string, [number, number] | null>();
    if (!highlight) return out;
    if (across === 'row') for (const r of rowKeys) out.set(r, range(colKeys.map((c) => at(r, c)?.[highlight] ?? null)));
    else for (const c of colKeys) out.set(c, range(rowKeys.map((r) => at(r, c)?.[highlight] ?? null)));
    return out;
  });
  function shade(row: string, col: string): string {
    if (!highlight) return '';
    const value = at(row, col)?.[highlight];
    const span = ranges.get(across === 'row' ? row : col);
    if (value == null || !span || span[1] === span[0]) return '';
    const hue = Math.round(((value - span[0]) / (span[1] - span[0])) * 120);
    return `background-color: hsl(${hue} 65% 88%)`;
  }
</script>

<div class="summary">
  {#each measures.filter((m) => m.summary) as m}
    <div><span class="summary-label">{t('Total')} {t(m.label)}</span><span class="summary-value">{show(grand[m.name], m.format)}</span></div>
  {/each}
</div>

{#if rowKeys.length === 0}
  <p class="empty">{t(emptyText)}</p>
{:else}
  <div class="pivot-wrap">
    <table class="pivot">
      <thead>
        <tr>
          <th class="corner">{t(rowAxis)} \ {t(colAxis)}</th>
          {#each colKeys as col}<th class="col-head" colspan={measures.length}>{col}</th>{/each}
          <th class="col-head total" colspan={measures.length}>{t('Total')}</th>
        </tr>
        <tr class="measures">
          <th></th>
          {#each [...colKeys, ''] as col}
            {#each measures as m}<th class="num pick" class:total={col === ''} class:hl={m.name === highlight} onclick={() => choose(m.name)} title={t('Shade by this')}>{t(m.label)}</th>{/each}
          {/each}
        </tr>
      </thead>
      <tbody>
        {#each rowKeys as row}
          {@const total = rowTotal(row)}
          <tr>
            <th class="row-head">{row}</th>
            {#each colKeys as col}
              {@const cell = at(row, col)}
              {#each measures as m}
                <td class="num mono" style={m.name === highlight ? shade(row, col) : ''}>{cell ? show(cell[m.name], m.format) : ''}</td>
              {/each}
            {/each}
            {#each measures as m}<td class="num mono total"><strong>{show(total[m.name], m.format)}</strong></td>{/each}
          </tr>
        {/each}
      </tbody>
      <tfoot>
        <tr>
          <th class="row-head">{t('Total')}</th>
          {#each colKeys as col}
            {@const total = colTotal(col)}
            {#each measures as m}<td class="num mono"><strong>{show(total[m.name], m.format)}</strong></td>{/each}
          {/each}
          {#each measures as m}<td class="num mono total"><strong>{show(grand[m.name], m.format)}</strong></td>{/each}
        </tr>
      </tfoot>
    </table>
  </div>
{/if}

<style>
  .summary {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: 1.5rem;
    margin-bottom: 1rem;
  }
  .summary > div {
    display: flex;
    flex-direction: column;
    align-items: center;
  }
  .summary-label {
    font-size: var(--font-size-small);
    color: var(--ink-soft);
  }
  .summary-value {
    font-size: var(--font-size-medium);
    font-weight: 600;
    font-variant-numeric: tabular-nums;
  }
  .pivot-wrap {
    overflow-x: auto;
    max-width: 100%;
  }
  .pivot {
    border-collapse: collapse;
    font-size: var(--font-size-small);
  }
  .pivot th,
  .pivot td {
    padding: 0.3rem 0.5rem;
    border-bottom: 1px solid var(--rule);
    white-space: nowrap;
  }
  .corner,
  .row-head {
    text-align: start;
    position: sticky;
    inset-inline-start: 0;
    background: var(--paper, white);
  }
  .col-head {
    text-align: center;
    border-inline-start: 2px solid var(--rule-strong);
  }
  .num {
    text-align: end;
  }
  .mono {
    font-variant-numeric: tabular-nums;
  }
  .total {
    background: var(--paper-dim, #f6f2e8);
  }
  .measures th {
    font-weight: 500;
    color: var(--ink-soft);
  }
  .measures th.pick {
    cursor: pointer;
  }
  .measures th.hl {
    color: var(--ink);
    text-decoration: underline dotted;
  }
  tfoot td,
  tfoot th {
    border-top: 2px solid var(--rule-strong);
  }
  .empty {
    text-align: center;
    color: var(--ink-soft);
  }
</style>
