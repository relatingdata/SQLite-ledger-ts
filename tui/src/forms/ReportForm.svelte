<!--
  The TUI's form for the report template: what the web's report
  template (generator/src/app-svelte.lfe) writes as a page, drawn from
  the spec the TUI template (app-sveltui.lfe) writes for the same
  screen. The report itself comes from the web's
  frontend/src/lib/screen-runtime.ts (`reports`), reloaded whenever a
  parameter changes.

  The parameters are stops, in the description's order (Control=ledger
  chooses the ledger); Enter moves to the next (on a list: chooses the
  highlighted entry), Up to the previous; Escape goes back. A typed
  parameter left blank keeps its default. The report is drawn as text,
  every line of a tree shown, its columns stacked one above the other.
-->
<script lang="ts" module>
  import type { FieldSpec } from './TransactionForm.svelte';
  export interface EntrySpec {
    name: string;
    label: string;
    control: string;
    table?: string;
  }
  export interface ReportSpec {
    title: string;
    intro?: string;
    introName?: string;
    report: string;
    emptyText?: string;
    fields: FieldSpec[];
    entries: EntrySpec[];
  }
</script>

<script lang="ts">
  import { Box, Text } from 'sveltui';
  import { keyboard } from 'sveltui';
  import { onDestroy } from 'svelte';
  import { translations } from '$lib/state.svelte';
  import { ApiError, getLedgers, asBusinessName } from '$lib/api';
  import { todayIsoDate } from '$lib/format';
  import { reports, sources, filters, type Choice, type Report, type ReportGroup } from '$lib/screen-runtime';
  import Panel from '../components/Panel.svelte';
  import TextInput from '../components/TextInput.svelte';
  import { brass, ink, inkSoft } from '../theme.ts';

  let { spec, businessName, ledgerName, onBack }: { spec: ReportSpec; businessName: string; ledgerName: string; onBack: () => void } = $props();

  const t = (word: string) => translations.current[word] ?? word;
  const typedControls = new Set(['text', 'date', 'percent', 'number', 'quantity', 'amount']);
  const isTyped = (control: string) => typedControls.has(control);

  const defaultOf = (f: FieldSpec): string => {
    if (f.control === 'date') return f.default === 'today' ? todayIsoDate() : '';
    if (f.default === undefined || f.default === 'first') return '';
    return f.default;
  };
  let ledger = $state(ledgerName);
  let ledgers: Choice[] = $state([{ value: ledgerName, label: ledgerName }]);
  let typed: Record<string, string> = $state(Object.fromEntries(spec.fields.filter((f) => isTyped(f.control)).map((f) => [f.name, ''])));
  let chosen: Record<string, string> = $state(Object.fromEntries(spec.fields.filter((f) => !isTyped(f.control) && f.control !== 'ledger').map((f) => [f.name, defaultOf(f)])));
  let loaded: Record<string, Choice[]> = $state({});
  const values = $derived(
    Object.fromEntries(
      spec.fields.filter((f) => f.control !== 'ledger').map((f) => [f.name, isTyped(f.control) ? typed[f.name] || defaultOf(f) : chosen[f.name] ?? ''])
    ) as Record<string, string>
  );

  getLedgers(asBusinessName(businessName))
    .then((rows) => (ledgers = rows.map((l) => ({ value: l.name, label: l.name }))))
    .catch(() => {});
  for (const f of spec.fields.filter((f) => f.choices)) {
    sources[f.choices!](businessName)
      .then((rows) => {
        loaded[f.name] = rows;
        if (f.default === 'first' && !chosen[f.name] && rows.length > 0) chosen[f.name] = rows[0].value;
      })
      .catch(() => {});
  }
  const choicesOf = (f: FieldSpec): Choice[] => {
    if (f.control === 'ledger') return ledgers;
    const all = f.options ? f.options.map(([value, label]) => ({ value, label })) : loaded[f.name] ?? [];
    const shown = f.filter ? filters[f.filter](all, values) : all;
    return f.empty !== undefined && f.empty !== '' ? [{ value: '', label: f.empty }, ...shown] : shown;
  };
  const valueOf = (f: FieldSpec) => (f.control === 'ledger' ? ledger : values[f.name]);

  // --- the report -----------------------------------------------------------
  let report: Report | null = $state(null);
  let loading = $state(true);
  let error = $state('');
  let latest = 0;
  $effect(() => {
    const parameters = { ...values };
    const forLedger = ledger;
    const request = ++latest;
    loading = true;
    reports[spec.report]({ business: businessName, ledger: forLedger, party: '' }, parameters)
      .then((result) => { if (request === latest) { report = result; error = ''; } })
      .catch((e) => { if (request === latest) error = e instanceof ApiError ? e.message : 'Failed to load.'; })
      .finally(() => { if (request === latest) loading = false; });
  });

  const tableOf = (group: ReportGroup) => spec.entries.filter((e) => (e.table ?? '') === (group.table ?? ''));
  function groupText(group: ReportGroup): string {
    const entries = tableOf(group);
    const cellOf = (row: { depth: number; cells: Record<string, string> }, e: EntrySpec) =>
      e.control === 'tree' ? `${'  '.repeat(row.depth)}${row.cells[e.name] ?? ''}` : row.cells[e.name] ?? '';
    const head = entries.map((e) => t(group.labels?.[e.name] ?? e.label));
    const body = group.rows.map((r) => entries.map((e) => cellOf(r, e)));
    const foot = group.footer ? entries.map((e) => group.footer![e.name] ?? '') : null;
    const all = [head, ...body, ...(foot ? [foot] : [])];
    const widths = entries.map((_, i) => Math.max(...all.map((r) => r[i].length)));
    const line = (r: string[]) => r.map((c, i) => (entries[i].control === 'amount' ? c.padStart(widths[i]) : c.padEnd(widths[i]))).join('  ').trimEnd();
    return [
      ...(group.title ? [`${group.title}${group.warn ? ` ⚠ ${group.warn}` : ''}`] : []),
      ...(group.meta ?? []).map((m) => `${m.label}: ${m.value}`),
      ...(head.some((h) => h) ? [line(head)] : []),
      ...(body.length > 0 ? body.map(line) : [t(spec.emptyText ?? 'None')]),
      ...(foot ? [line(foot)] : []),
    ].join('\n');
  }
  const reportText = $derived(
    error
      ? ''
      : !report
        ? t('Loading') + '…'
        : report.columns.every((c) => c.groups.length === 0)
          ? t(spec.emptyText ?? 'None')
          : report.columns
              .map((c) => [...c.groups.map(groupText), ...(c.summary ? [`${c.summary.label}  ${c.summary.value}`] : [])].join('\n\n'))
              .join('\n\n')
  );
  const statusText = $derived([report?.status?.text, report?.note].filter(Boolean).join('\n'));
  const introText = $derived(
    (report?.intro ?? t(spec.intro ?? '')).replace('{NAME}', spec.introName === 'ledger' ? ledger : businessName)
  );

  // --- stops ------------------------------------------------------------------
  let at = $state(0);
  let highlighted = $state(0);
  const stop = $derived(spec.fields[Math.min(at, spec.fields.length - 1)]);
  function moveTo(next: number) {
    at = Math.max(0, Math.min(next, spec.fields.length - 1));
    const f = spec.fields[at];
    if (!f) return; // a report with no parameters
    highlighted = Math.max(0, choicesOf(f).findIndex((c) => c.value === valueOf(f)));
  }
  moveTo(0);

  const unsubscribe = keyboard.on((event) => {
    if (event.key === 'Escape') { onBack(); return true; }
    if (!stop) return false;
    const onList = !isTyped(stop.control);
    const list = onList ? choicesOf(stop) : [];
    if (event.key === 'ArrowUp') {
      if (onList && highlighted > 0) highlighted--;
      else moveTo(at - 1);
      return true;
    }
    if (event.key === 'ArrowDown') {
      if (onList && highlighted < list.length - 1) highlighted++;
      else if (!onList) moveTo(at + 1);
      return true;
    }
    if (onList && event.key === 'Enter') {
      const choice = list[highlighted];
      if (choice) {
        if (stop.control === 'ledger') ledger = choice.value;
        else chosen[stop.name] = choice.value;
      }
      moveTo(at + 1);
      return true;
    }
    return false;
  });
  onDestroy(unsubscribe);

  const listText = (f: FieldSpec) =>
    stop === f
      ? choicesOf(f).map((c, i) => `${i === highlighted ? '❯ ' : '  '}${t(c.label)}`).join('\n')
      : t(choicesOf(f).find((c) => c.value === valueOf(f))?.label ?? valueOf(f) ?? '');
  const hint = (f: FieldSpec) => (defaultOf(f) ? `${t('blank keeps')} ${defaultOf(f)}` : f.control === 'date' ? t('blank: all time') : '');
</script>

<Panel title={report?.title ?? t(spec.title)} focused>
  <Text text={introText} color={inkSoft} />
  {#each spec.fields as f (f.name)}
    <Box flexDirection="row">
      <Box width={20}><Text text={t(f.label)} color={stop === f ? brass : inkSoft} /></Box>
      {#if isTyped(f.control)}
        <Box width={24}><TextInput bind:value={typed[f.name]} focused={stop === f} onSubmit={() => moveTo(at + 1)} /></Box>
        <Text text={hint(f)} color={inkSoft} dim />
      {:else}
        <Text text={listText(f)} color={ink} />
      {/if}
    </Box>
  {/each}
  <Text text={reportText} color={ink} />
  <Text text={error || statusText || (loading && report ? t('Loading') + '…' : '')} color={error ? 'red' : brass} bold />
  <Text text="Enter next / choose · ↑ previous · a blank field keeps its default · Escape back to menu" color={inkSoft} dim />
</Panel>
