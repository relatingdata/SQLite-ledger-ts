<script lang="ts">
  // The Axes trait: what a two-axis report breaks its rows and its columns
  // down by. Either drag a field from the tray into Rows or Columns (mode
  // 'drag'; clicking a field places or returns it too), or pick from two
  // lists (mode 'select'). An empty zone is Consolidated. Two fields of the
  // same group (Category and Item; Location and a hierarchy over it) never
  // cross: the one dropped bounces back. Either axis can be narrowed to a
  // single value, and the swap button turns rows into columns.
  import { flip } from 'svelte/animate';
  import { dndzone, type DndEvent } from 'svelte-dnd-action';
  import { translations } from '$lib/state.svelte';
  import { sameGroup, type Axes } from '$lib/screen-runtime';

  let {
    axes,
    mode = 'drag',
    rowAxis = $bindable('Consolidated'),
    colAxis = $bindable('Consolidated'),
    rowFilter = $bindable(''),
    colFilter = $bindable(''),
  }: {
    axes: Axes;
    mode?: 'drag' | 'select';
    rowAxis?: string;
    colAxis?: string;
    rowFilter?: string;
    colFilter?: string;
  } = $props();

  const t = (word: string) => translations.current[word] ?? word;
  type Chip = { id: string };
  const flipDurationMs = 200;
  const all = $derived(axes.groups.flat());
  const placed = (axis: string): Chip[] => (axis === 'Consolidated' ? [] : [{ id: axis }]);

  let tray: Chip[] = $state([]);
  let rows: Chip[] = $state([]);
  let cols: Chip[] = $state([]);
  let rejected: 'row' | 'col' | null = $state(null);

  // The zones follow the axes whenever they change from outside (or after a drop).
  $effect(() => {
    rows = placed(rowAxis);
    cols = placed(colAxis);
    tray = all.filter((a) => a !== rowAxis && a !== colAxis).map((id) => ({ id }));
  });

  function set(zone: 'row' | 'col', axis: string) {
    const other = zone === 'row' ? colAxis : rowAxis;
    if (sameGroup(axes, axis, other)) {
      rejected = zone;
      setTimeout(() => (rejected = rejected === zone ? null : rejected), 500);
      axis = zone === 'row' ? rowAxis : colAxis;
    }
    if (zone === 'row') {
      if (axis !== rowAxis) rowFilter = '';
      rowAxis = axis;
    } else {
      if (axis !== colAxis) colFilter = '';
      colAxis = axis;
    }
  }

  const consider = (zone: 'tray' | 'row' | 'col', e: CustomEvent<DndEvent<Chip>>) => {
    if (zone === 'tray') tray = e.detail.items;
    else if (zone === 'row') rows = e.detail.items;
    else cols = e.detail.items;
  };
  function finalize(zone: 'tray' | 'row' | 'col', e: CustomEvent<DndEvent<Chip>>) {
    const items = e.detail.items;
    if (zone === 'tray') {
      tray = items;
      if (items.some((c) => c.id === rowAxis)) set('row', 'Consolidated');
      if (items.some((c) => c.id === colAxis)) set('col', 'Consolidated');
      return;
    }
    // One field per zone: the newest stays, any other goes back to the tray.
    const newest = items.find((c) => c.id !== (zone === 'row' ? rowAxis : colAxis)) ?? items[0];
    set(zone, newest ? newest.id : 'Consolidated');
    rows = placed(rowAxis);
    cols = placed(colAxis);
    tray = all.filter((a) => a !== rowAxis && a !== colAxis).map((id) => ({ id }));
  }
  function place(axis: string) {
    if (rowAxis === 'Consolidated' && !sameGroup(axes, axis, colAxis)) set('row', axis);
    else if (colAxis === 'Consolidated' && !sameGroup(axes, axis, rowAxis)) set('col', axis);
    else set('row', axis);
  }
  function swap() {
    [rowAxis, colAxis] = [colAxis, rowAxis];
    [rowFilter, colFilter] = [colFilter, rowFilter];
  }
  const allowed = (other: string) => ['Consolidated', ...all.filter((a) => !sameGroup(axes, a, other))];
</script>

{#snippet narrow(axis: string, which: 'row' | 'col')}
  {#if axis !== 'Consolidated' && (axes.values[axis]?.length ?? 0) > 0}
    {#if which === 'row'}
      <select class="narrow" bind:value={rowFilter}>
        <option value="">{t('Every')} {t(axis)}</option>
        {#each axes.values[axis] as value}<option {value}>{value}</option>{/each}
      </select>
    {:else}
      <select class="narrow" bind:value={colFilter}>
        <option value="">{t('Every')} {t(axis)}</option>
        {#each axes.values[axis] as value}<option {value}>{value}</option>{/each}
      </select>
    {/if}
  {/if}
{/snippet}

<div class="axis-chooser">
  {#if mode === 'drag'}
    <div class="block">
      <p class="label">{t('Available fields')}</p>
      <div class="tray" use:dndzone={{ items: tray, flipDurationMs, dropTargetStyle: {} }} onconsider={(e) => consider('tray', e)} onfinalize={(e) => finalize('tray', e)}>
        {#each tray as chip (chip.id)}
          <button type="button" class="chip" animate:flip={{ duration: flipDurationMs }} onclick={() => place(chip.id)}>{t(chip.id)}</button>
        {/each}
      </div>
    </div>
    {#each [['row', 'Rows'], ['col', 'Columns']] as [zone, title] (zone)}
      <div class="block">
        <p class="label">{t(title)}</p>
        <div
          class="zone"
          class:rejected={rejected === zone}
          use:dndzone={{ items: zone === 'row' ? rows : cols, flipDurationMs, dropTargetStyle: {} }}
          onconsider={(e) => consider(zone as 'row' | 'col', e)}
          onfinalize={(e) => finalize(zone as 'row' | 'col', e)}
        >
          {#each zone === 'row' ? rows : cols as chip (chip.id)}
            <button type="button" class="chip placed" animate:flip={{ duration: flipDurationMs }} onclick={() => set(zone as 'row' | 'col', 'Consolidated')}>{t(chip.id)}</button>
          {/each}
          {#if (zone === 'row' ? rows : cols).length === 0}<span class="empty">{t('Consolidated')}</span>{/if}
        </div>
        {@render narrow(zone === 'row' ? rowAxis : colAxis, zone as 'row' | 'col')}
      </div>
      {#if zone === 'row'}
        <button type="button" class="swap" onclick={swap} title={t('Swap rows and columns')}>&#x21C4;</button>
      {/if}
    {/each}
  {:else}
    <fieldset>
      <legend>{t('Rows')}</legend>
      <select value={rowAxis} onchange={(e) => set('row', e.currentTarget.value)}>
        {#each allowed(colAxis) as axis}<option value={axis}>{t(axis)}</option>{/each}
      </select>
      {@render narrow(rowAxis, 'row')}
    </fieldset>
    <button type="button" class="swap" onclick={swap} title={t('Swap rows and columns')}>&#x21C4;</button>
    <fieldset>
      <legend>{t('Columns')}</legend>
      <select value={colAxis} onchange={(e) => set('col', e.currentTarget.value)}>
        {#each allowed(rowAxis) as axis}<option value={axis}>{t(axis)}</option>{/each}
      </select>
      {@render narrow(colAxis, 'col')}
    </fieldset>
  {/if}
</div>

<style>
  .axis-chooser {
    display: flex;
    flex-wrap: wrap;
    align-items: flex-start;
    justify-content: center;
    gap: 1rem;
    margin-bottom: 1rem;
  }
  .block {
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
    min-width: 10rem;
  }
  .label {
    margin: 0;
    font-size: var(--font-size-small);
    color: var(--ink-soft);
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }
  .tray,
  .zone {
    display: flex;
    flex-wrap: wrap;
    gap: 0.4rem;
    min-height: 2.6rem;
    padding: 0.4rem;
    border: 1px dashed var(--rule-strong);
    border-radius: 6px;
    align-items: center;
  }
  .tray {
    max-width: 28rem;
  }
  .zone {
    background: var(--paper-dim, #f6f2e8);
    transition: background 0.2s;
  }
  .zone.rejected {
    background: color-mix(in srgb, var(--debit) 25%, transparent);
  }
  .chip {
    padding: 0.25rem 0.7rem;
    border: 1px solid var(--rule-strong);
    border-radius: 999px;
    background: white;
    cursor: grab;
    font: inherit;
  }
  .chip.placed {
    background: var(--brass);
    border-color: var(--brass);
    color: white;
  }
  .empty {
    color: var(--ink-soft);
    font-style: italic;
  }
  .swap {
    align-self: center;
    border: none;
    background: none;
    font-size: 1.4rem;
    cursor: pointer;
    color: var(--ink-soft);
  }
  .narrow {
    font-size: var(--font-size-small);
  }
</style>
