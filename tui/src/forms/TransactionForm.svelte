<!--
  The TUI's form for the transaction template: what the web's
  transaction template (generator/src/app-svelte.lfe) writes as a page,
  drawn from the spec the TUI template (app-sveltui.lfe) writes for the
  same screen. Its behaviour is the web's: choice sources, filters,
  reactions, totals and the screen's action come from
  frontend/src/lib/screen-runtime.ts.

  The form is a column of stops, in the description's order: the fields
  before the line columns, the columns of one line, the fields after
  them, then the screen's action and Add another line. Enter moves to
  the next stop (on a list: chooses the highlighted entry and moves on),
  Up to the previous one; Escape goes back. A typed field left blank
  keeps its default. Lists are drawn as one block of text, never as rows
  added later (docs/tui-design.md, "Running on Svelte 5.56").
-->
<script lang="ts" module>
  export interface FieldSpec {
    name: string;
    label: string;
    control: string;
    placement: 'before' | 'after';
    choices?: string;
    filter?: string;
    empty?: string;
    default?: string;
    reacts?: string;
    unless?: string;
    reset?: string;
    placeholder?: string;
    options?: [string, string][];
  }
  export interface ColumnSpec {
    name: string;
    label: string;
    control: string;
    default?: string;
    placeholder?: string;
  }
  export interface TransactionSpec {
    title: string;
    intro?: string;
    party?: string;
    partyLabel?: string;
    side?: string;
    action: string;
    failText?: string;
    submitLabel?: string;
    totalLabel?: string;
    totals?: string;
    fields: FieldSpec[];
    columns: ColumnSpec[];
  }
</script>

<script lang="ts">
  import { Box, Text } from 'sveltui';
  import { keyboard } from 'sveltui';
  import { onDestroy } from 'svelte';
  import { translations, auth } from '$lib/state.svelte';
  import { ApiError } from '$lib/api';
  import { formatAmount, todayIsoDate } from '$lib/format';
  import { parseMinorUnits } from '$lib/money';
  import { sources, filters, reactions, totals, actions, Invalid, type Choice, type Patch, type Line } from '$lib/screen-runtime';
  import Panel from '../components/Panel.svelte';
  import TextInput from '../components/TextInput.svelte';
  import { brass, ink, inkSoft } from '../theme.ts';

  let { spec, businessName, ledgerName, onBack }: { spec: TransactionSpec; businessName: string; ledgerName: string; onBack: () => void } = $props();

  const t = (word: string) => translations.current[word] ?? word;
  const fmt = (minor: number) => formatAmount(minor, auth.current?.user.number_format ?? '1 000.00');
  const typedControls = new Set(['text', 'date', 'percent', 'number', 'quantity', 'amount', 'textarea', 'money']);
  const isTyped = (control: string) => typedControls.has(control);
  const context = () => ({ business: businessName, ledger: ledgerName, party: spec.party ?? '', side: spec.side });

  // --- values --------------------------------------------------------------
  // A typed field holds what was typed; blank keeps its default.
  const defaultOf = (f: FieldSpec): string => {
    if (f.control === 'date') return f.default === undefined || f.default === '' ? '' : todayIsoDate();
    if (f.default === undefined || f.default === 'first') return '';
    return f.default;
  };
  let typed: Record<string, string> = $state(Object.fromEntries(spec.fields.filter((f) => isTyped(f.control)).map((f) => [f.name, ''])));
  let chosen: Record<string, string> = $state(Object.fromEntries(spec.fields.filter((f) => !isTyped(f.control)).map((f) => [f.name, defaultOf(f)])));
  const values = $derived(
    Object.fromEntries(spec.fields.map((f) => [f.name, isTyped(f.control) ? typed[f.name] || defaultOf(f) : chosen[f.name] ?? ''])) as Record<string, string>
  );

  // --- choices ---------------------------------------------------------------
  let loaded: Record<string, Choice[]> = $state({});
  let narrowed: Record<string, Choice[] | undefined> = $state({});
  let info = $state('');
  let error = $state('');
  let message = $state('');
  let busy = $state(false);

  const baseChoices = (f: FieldSpec): Choice[] => {
    if (f.options) return f.options.map(([value, label]) => ({ value, label }));
    if (f.control === 'checkbox') return [{ value: '', label: 'No' }, { value: 'yes', label: 'Yes' }];
    return loaded[f.name] ?? [];
  };
  const choicesOf = (f: FieldSpec): Choice[] => {
    const all = narrowed[f.name] ?? (f.filter ? filters[f.filter](baseChoices(f), values) : baseChoices(f));
    return f.empty !== undefined && f.empty !== '' ? [{ value: '', label: f.empty }, ...all] : all;
  };

  for (const f of spec.fields.filter((f) => f.choices)) {
    sources[f.choices!](businessName, ledgerName)
      .then((rows) => {
        loaded[f.name] = rows;
        if (f.default === 'first' && !chosen[f.name] && rows.length > 0) chosen[f.name] = rows[0].value;
      })
      .catch((e) => (error = e instanceof ApiError ? e.message : 'Failed to load.'));
  }

  // A field that Reacts runs its reaction whenever its value changes.
  const apply = (patch: Patch) => {
    for (const [name, value] of Object.entries(patch.values ?? {})) {
      if (name in typed) typed[name] = value;
      else chosen[name] = value;
    }
    for (const [name, list] of Object.entries(patch.choices ?? {})) narrowed[name] = list;
    if (patch.info !== undefined) info = patch.info;
  };
  for (const f of spec.fields.filter((f) => f.reacts)) {
    let last = '';
    $effect(() => {
      const now = values[f.name] ?? '';
      if (now === last) return;
      last = now;
      reactions[f.reacts!](context(), { ...values }).then(apply).catch(() => {});
    });
  }

  // --- lines ----------------------------------------------------------------
  const blankLine = () => Object.fromEntries(spec.columns.map((c) => [c.name, ''])) as Record<string, string>;
  let line: Record<string, string> = $state(blankLine());
  let lines: Line[] = $state([]);
  const toLine = (l: Record<string, string>): Line =>
    Object.fromEntries(
      spec.columns.map((c) => {
        const text = l[c.name] || c.default || '';
        return [c.name, c.control === 'text' ? text : c.control === 'money' ? parseMinorUnits(text) : Number(text || 0)];
      })
    ) as unknown as Line;
  const current = $derived(spec.columns.length > 0 && (line.itemName ?? '').trim() ? [toLine(line)] : []);
  const allLines = $derived([...lines, ...current]);
  const sums = $derived(spec.totals ? totals[spec.totals](allLines, values) : null);

  // --- stops ------------------------------------------------------------------
  type Stop = { kind: 'field'; field: FieldSpec } | { kind: 'column'; column: ColumnSpec } | { kind: 'actions' };
  const actionItems = [
    { value: 'submit', label: t(spec.submitLabel ?? 'Save') },
    ...(spec.columns.length > 0 ? [{ value: 'add', label: t('Add another line') }] : []),
  ];
  const stops = $derived<Stop[]>([
    ...spec.fields.filter((f) => f.placement === 'before' && !(f.unless && values[f.unless])).map((field) => ({ kind: 'field' as const, field })),
    ...spec.columns.map((column) => ({ kind: 'column' as const, column })),
    ...spec.fields.filter((f) => f.placement === 'after' && !(f.unless && values[f.unless])).map((field) => ({ kind: 'field' as const, field })),
    { kind: 'actions' as const },
  ]);
  let at = $state(0);
  let highlighted = $state(0);
  const stop = $derived(stops[Math.min(at, stops.length - 1)]);
  const listOf = (s: Stop): Choice[] => (s.kind === 'actions' ? actionItems : s.kind === 'field' && !isTyped(s.field.control) ? choicesOf(s.field) : []);
  const isFieldStop = (f: FieldSpec) => stop.kind === 'field' && stop.field === f;
  const isColumnStop = (c: ColumnSpec) => stop.kind === 'column' && stop.column === c;

  function moveTo(next: number) {
    at = Math.max(0, Math.min(next, stops.length - 1));
    const s = stops[at];
    const list = listOf(s);
    const value = s.kind === 'field' ? values[s.field.name] : undefined;
    highlighted = Math.max(0, list.findIndex((c) => c.value === value));
  }

  async function act(what: string) {
    if (what === 'add') {
      if (current.length > 0) lines = [...lines, ...current];
      line = blankLine();
      moveTo(stops.findIndex((s) => s.kind === 'column'));
      return;
    }
    if (busy) return;
    busy = true;
    error = '';
    message = '';
    try {
      message = await actions[spec.action](context(), { ...values }, allLines);
      for (const f of spec.fields.filter((f) => f.reset)) {
        if (f.name in typed) typed[f.name] = '';
        else chosen[f.name] = defaultOf(f);
      }
      lines = [];
      line = blankLine();
      moveTo(0);
    } catch (e) {
      error = e instanceof ApiError || e instanceof Invalid ? e.message : t(spec.failText ?? 'Could not save.');
    } finally {
      busy = false;
    }
  }

  const unsubscribe = keyboard.on((event) => {
    if (event.key === 'Escape') { onBack(); return true; }
    const list = listOf(stop);
    const onList = stop.kind === 'actions' || (stop.kind === 'field' && !isTyped(stop.field.control));
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
      if (stop.kind === 'actions') void act(choice?.value ?? 'submit');
      else if (stop.kind === 'field') {
        chosen[stop.field.name] = choice?.value ?? '';
        moveTo(at + 1);
      }
      return true;
    }
    return false;
  });
  onDestroy(unsubscribe);

  // --- drawing ------------------------------------------------------------------
  const listText = (list: Choice[], focused: boolean, value?: string) =>
    focused
      ? list.map((c, i) => `${i === highlighted ? '❯ ' : '  '}${t(c.label)}`).join('\n') || t('Loading') + '…'
      : t(list.find((c) => c.value === value)?.label ?? value ?? '');
  // The actions are always listed, marked once Enter reaches them.
  const actionsText = $derived(actionItems.map((c, i) => `${stop.kind === 'actions' && i === highlighted ? '❯ ' : '  '}${c.label}`).join('\n'));
  const hint = (f: FieldSpec | ColumnSpec) => {
    const d = 'placement' in f ? defaultOf(f) : f.default;
    return d ? `${t('blank keeps')} ${d}` : (f.placeholder ? t(f.placeholder) : '');
  };
  const linesText = $derived(
    lines.length === 0
      ? ''
      : lines.map((l) => `  ${String(l.itemName).padEnd(26)}${l.quantity} × ${fmt(l.unitPriceMinor)}${l.taxMinor ? ` (${t('Tax')}: ${fmt(l.taxMinor)})` : ''}`).join('\n')
  );
  const totalText = $derived(sums && sums.totalMinor > 0 ? `${t(spec.totalLabel ?? 'Total')}: ${fmt(sums.totalMinor)}${sums.taxMinor > 0 ? ` (${t('Tax')}: ${fmt(sums.taxMinor)})` : ''}` : '');
  const contextLine = `${businessName} — ${ledgerName}${spec.partyLabel ? ` — ${t(spec.partyLabel)}: ${t(spec.party ?? '')}` : ''}`;
</script>

{#snippet fieldRow(f: FieldSpec)}
  <Box flexDirection="row">
    <Box width={26}><Text text={t(f.label)} color={isFieldStop(f) ? brass : inkSoft} /></Box>
    {#if isTyped(f.control)}
      <Box width={30}><TextInput bind:value={typed[f.name]} focused={isFieldStop(f)} onSubmit={() => moveTo(at + 1)} /></Box>
      <Text text={hint(f)} color={inkSoft} dim />
    {:else}
      <Text text={listText(choicesOf(f), isFieldStop(f), values[f.name])} color={ink} />
    {/if}
  </Box>
{/snippet}

<Panel title={t(spec.title)} focused>
  <Text text={t(spec.intro ?? '')} color={inkSoft} />
  <Text text={contextLine} color={ink} bold />
  {#each spec.fields.filter((f) => f.placement === 'before') as f (f.name)}
    {@render fieldRow(f)}
  {/each}
  <Text text={info} color={inkSoft} dim />
  {#if spec.columns.length > 0}
    <Text text={linesText} color={ink} />
    {#each spec.columns as c (c.name)}
      <Box flexDirection="row">
        <Box width={26}><Text text={t(c.label)} color={isColumnStop(c) ? brass : inkSoft} /></Box>
        <Box width={30}><TextInput bind:value={line[c.name]} focused={isColumnStop(c)} onSubmit={() => moveTo(at + 1)} /></Box>
        <Text text={hint(c)} color={inkSoft} dim />
      </Box>
    {/each}
  {/if}
  {#each spec.fields.filter((f) => f.placement === 'after') as f (f.name)}
    {@render fieldRow(f)}
  {/each}
  <Text text={totalText} color={ink} bold />
  <Text text={actionsText} color={brass} />
  <Text text={error || message || (busy ? t('Saving') + '…' : '')} color={error ? 'red' : brass} />
  <Text text="Enter next / choose · ↑ previous · a blank field keeps its default · Escape back to menu" color={inkSoft} dim />
</Panel>
