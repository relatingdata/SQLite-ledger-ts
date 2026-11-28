<!--
  One section of a drillable report (the drill template,
  generator/src/app-svelte.lfe): a heading line with its name and figure
  that opens and closes, and when open its table and the sections under
  it, indented. A building block of the templates, like PageButtons: it
  draws whatever sections a report in $lib/screen-runtime returns
  (ReportSection), knowing nothing of any one report.

  The table's rows are ReportRows under the section's columns (none
  given: an account, its debit and its credit). The first column is a
  tree: a parent line opens and closes the lines under it. A row marked
  section-head, rule-row, heavy-rule-row or empty is one cell across the
  table. The heading carries both axis-head and group-head.
-->
<script lang="ts">
  import { translations } from '$lib/state.svelte';
  import type { ReportSection } from '$lib/screen-runtime';
  import DrillSection from '$lib/DrillSection.svelte';

  let { section, depth = 0 }: { section: ReportSection; depth?: number } = $props();

  const t = (word: string) => translations.current[word] ?? word;
  // svelte-ignore state_referenced_locally
  let open = $state(section.open ?? false);
  let expanded = $state(new Set<string>());
  const toggle = (key: string) => {
    const next = new Set(expanded);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    expanded = next;
  };
  const columns = $derived(section.columns ?? [{ name: 'name', label: '' }, { name: 'debit', label: t('Debit'), numeric: true }, { name: 'credit', label: t('Credit'), numeric: true }]);
  // A total line is drawn bold.
  const strong = (row: { mark?: string }) => !!row.mark && (row.mark.startsWith('total') || row.mark.startsWith('grand'));
  const across = new Set(['section-head', 'rule-row', 'heavy-rule-row', 'empty']);
  const shown = $derived(section.rows.filter((r) => r.ancestors.every((a) => expanded.has(a))));
</script>

<div class="axis-section" style="margin-left: {depth * 1.2}rem">
  <button type="button" class="axis-head group-head" class:open onclick={() => (open = !open)}>
    <span class="disclosure">{open ? '▾' : '▸'}</span>
    <span class="axis-name">{section.name}</span>
    <span class="axis-figures"><span class:negative={section.negative}>{section.figure}</span></span>
    {#each section.figures ?? [] as figure}<span class="axis-figures">{figure}</span>{/each}
  </button>
  {#if open}
    <div class="axis-body">
      {#if section.rows.length > 0}
        <table>
          <colgroup>{#each columns as c, i}<col class={i > 0 && c.numeric ? 'amount-col' : ''} />{/each}</colgroup>
          <thead><tr class="col-heads">{#each columns as c}<th class={c.numeric ? 'num' : ''}>{c.label}</th>{/each}</tr></thead>
          <tbody>
            {#each shown as row (row.key)}
              {#if across.has(row.mark ?? '')}
                <tr class={row.mark}><td colspan={columns.length}>{row.cells[columns[0].name] ?? ''}</td></tr>
              {:else}
                <tr class={row.mark ?? ''} class:clickable={row.parent} onclick={() => row.parent && toggle(row.key)}>
                  {#each columns as c, i}
                    {#if i === 0}
                      <td style="padding-left: {row.depth * 1.4}rem">
                        {#if row.parent}<span class="disclosure">{expanded.has(row.key) ? '▾' : '▸'}</span>{/if}{#if strong(row)}<strong>{row.cells[c.name] ?? ''}</strong>{:else}{row.cells[c.name] ?? ''}{/if}
                      </td>
                    {:else}
                      <td class={c.numeric ? 'num mono' : ''} class:contra={row.contra?.includes(c.name)}>{#if strong(row)}<strong>{row.cells[c.name] ?? ''}</strong>{:else}{row.cells[c.name] ?? ''}{/if}</td>
                    {/if}
                  {/each}
                </tr>
              {/if}
            {/each}
          </tbody>
        </table>
        {#if section.note}<p class="truncation-note">{section.note}</p>{/if}
      {/if}
      {#each section.children as child (child.key)}
        <DrillSection section={child} depth={depth + 1} />
      {/each}
    </div>
  {/if}
</div>

<style>
  .axis-section { border-bottom: 1px solid var(--rule); }
  .axis-head {
    width: 100%; display: flex; align-items: center; gap: 0.5rem; background: none; border: none;
    cursor: pointer; padding: 0.6rem 0.2rem; text-align: left; font-size: var(--font-size-medium); font-family: inherit;
  }
  .axis-head:hover { background: var(--paper-dim, #f2ede1); }
  .disclosure { display: inline-block; width: 1rem; color: var(--ink-soft); }
  .axis-name { flex: 1; font-weight: 600; }
  .axis-figures { font-variant-numeric: tabular-nums; font-weight: 600; margin-left: 1rem; }
  .truncation-note { color: var(--ink-soft); font-size: var(--font-size-small); }
  .negative { color: var(--debit); }
  .axis-body { padding: 0 0.2rem 0.8rem 1.6rem; }
  .amount-col { width: 110px; }
  .col-heads th { text-align: left; border-bottom: 1px solid var(--rule-strong); padding-bottom: 0.3rem; font-weight: 600; }
  .col-heads th.num { text-align: right; }
  td { padding: 0.22rem 0.4rem; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .section-head td { font-weight: 700; padding-top: 0.6rem; white-space: normal; }
  .heavy-rule-row td { border-top: 2px solid var(--ink); padding: 0; height: 0; }
  .rule-row td { border-top: 1px solid var(--rule); padding: 0; height: 0.5rem; }
  .grand-total-row { font-size: var(--font-size-large); }
  .grand-total-row.negative td { color: var(--debit); }
  .contra { color: var(--debit, #b1442e); }
  .empty td { text-align: center; color: var(--ink-soft); font-style: italic; }
  .clickable { cursor: pointer; }
  .clickable:hover td { background: var(--paper-dim, #f2ede1); }
</style>
