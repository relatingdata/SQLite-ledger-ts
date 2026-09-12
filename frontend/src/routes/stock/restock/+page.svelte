<script lang="ts">
  import { auth } from '$lib/state.svelte';
  import { translations } from '$lib/state.svelte';
  import { session } from '$lib/state.svelte';
  import { onMount } from 'svelte';
  import {
    listLocations,
    getBelowReorderStock,
    getRestockPickingList,
    confirmRestockPickedLine,
    dispatchRestockRun,
    asBusinessName,
    ApiError,
    type LocationRecord,
    type BelowReorderRow,
    type PickingListLine,
    type RestockLineInput,
  } from '$lib/api';

  let locations: LocationRecord[] = $state([]);
  let belowReorder: BelowReorderRow[] = $state([]);
  let loading = $state(true);
  let error = $state('');
  let message = $state('');

  let warehouseName = $state('');
  let outletName = $state('');
  let lines: RestockLineInput[] = $state([]);
  let runReference = $state('');

  let pickingList: PickingListLine[] = $state([]);
  let generating = $state(false);
  let confirming: string | null = $state(null); // the item currently being ticked, for a real, per-row busy state
  let dispatching = $state(false);

  onMount(async () => {
    try {
      const [locs, reorder] = await Promise.all([listLocations(asBusinessName(session.current?.businessName ?? '')), getBelowReorderStock()]);
      locations = locs;
      belowReorder = reorder;
    } catch (e) {
      error = e instanceof ApiError ? e.message : 'Failed to load.';
    } finally {
      loading = false;
    }
  });

  let warehouses = $derived(locations.filter((l) => l.location_type === 'Warehouse'));
  let outlets = $derived.by(() => locations.filter((l) => l.location_type === 'Retail' && (!warehouseName || l.city === locations.find((w) => w.name === warehouseName)?.city)));

  // The real, suggested restocking list — every real product genuinely
  // below its own reorder level at the selected outlet, topped up to
  // its own real max level. A real starting point matching what a
  // real store manager would actually notice (this product's shelf is
  // looking thin), not a blank form to fill in from memory.
  let suggestions = $derived(outletName ? belowReorder.filter((r) => r.location === outletName) : []);

  function loadSuggestions() {
    // Computed directly here, not read from the reactive `suggestions`
    // variable — a real, genuine timing bug found live: this function
    // runs on the same tick as the outlet selection change, before
    // Svelte has recomputed `suggestions` for the newly-selected
    // outlet, so reading it here would use the stale, previous value.
    const freshSuggestions = outletName ? belowReorder.filter((r) => r.location === outletName) : [];
    lines = freshSuggestions.map((s) => ({ item: s.item, quantity: Math.max(1, (s.max_level ?? s.reorder_level * 2) - s.quantity_on_hand) }));
    pickingList = [];
    runReference = '';
  }

  function addLine() {
    lines = [...lines, { item: '', quantity: 1 }];
  }
  function removeLine(i: number) {
    lines = lines.filter((_, idx) => idx !== i);
  }

  async function generatePickingList() {
    if (!warehouseName || !outletName || lines.length === 0) return;
    generating = true;
    error = '';
    try {
      runReference = `RESTOCK-${Date.now()}`;
      pickingList = await getRestockPickingList(runReference, warehouseName, lines.filter((l) => l.item && l.quantity > 0));
    } catch (e) {
      error = e instanceof ApiError ? e.message : 'Could not generate the real picking list.';
    } finally {
      generating = false;
    }
  }

  async function togglePicked(line: PickingListLine) {
    if (line.picked || !session.current) return;
    confirming = line.item;
    error = '';
    try {
      await confirmRestockPickedLine(runReference, line.item, session.current.businessName, session.current.ledgerName);
      pickingList = pickingList.map((l) => (l.item === line.item ? { ...l, picked: true } : l));
    } catch (e) {
      error = e instanceof ApiError ? e.message : 'Could not confirm this line.';
    } finally {
      confirming = null;
    }
  }

  let allPicked = $derived(pickingList.length > 0 && pickingList.every((l) => l.picked));

  async function submitDispatch() {
    if (!session.current || !allPicked) return;
    dispatching = true;
    error = '';
    try {
      await dispatchRestockRun(runReference, session.current.businessName, session.current.ledgerName, warehouseName, outletName, lines.filter((l) => l.item && l.quantity > 0), undefined);
      message = `Restocking run ${runReference} dispatched — real stock has moved from ${warehouseName} to ${outletName}.`;
      pickingList = [];
      lines = [];
      runReference = '';
      belowReorder = await getBelowReorderStock();
    } catch (e) {
      error = e instanceof ApiError ? e.message : 'Could not dispatch this restocking run.';
    } finally {
      dispatching = false;
    }
  }
</script>

<svelte:head><title>{translations.current['Restock Retail Outlets'] ?? 'Restock Retail Outlets'}</title></svelte:head>

<fieldset class="page-title">
  <legend>{translations.current['Restock Retail Outlets'] ?? 'Restock Retail Outlets'}</legend>
  <p class="intro">
    {translations.current['Move real stock from a warehouse to a retail outlet — the same real picking, shelf order, and tick-off confirmation as a customer order, but a real internal transfer, no invoice or revenue involved.'] ?? 'Move real stock from a warehouse to a retail outlet — the same real picking, shelf order, and tick-off confirmation as a customer order, but a real internal transfer, no invoice or revenue involved.'}
  </p>
</fieldset>

{#if loading}
  <p class="center-text">Loading…</p>
{:else}
  <div class="card form-card">
    <div class="row-2">
      <fieldset>
        <legend>{translations.current['Warehouse'] ?? 'Warehouse'}</legend>
        <select bind:value={warehouseName} onchange={() => { outletName = ''; lines = []; pickingList = []; }}>
          <option value="">Select warehouse…</option>
          {#each warehouses as w}<option value={translations.current[w.name] ?? w.name}>{translations.current[w.name] ?? w.name}</option>{/each}
        </select>
      </fieldset>
      <fieldset>
        <legend>{translations.current['Retail outlet'] ?? 'Retail outlet'}</legend>
        <select bind:value={outletName} onchange={loadSuggestions} disabled={!warehouseName}>
          <option value="">Select outlet…</option>
          {#each outlets as o}<option value={translations.current[o.name] ?? o.name}>{translations.current[o.name] ?? o.name}</option>{/each}
        </select>
      </fieldset>
    </div>

    {#if outletName}
      {#if suggestions.length > 0}
        <p class="hint">
          {suggestions.length} real product{suggestions.length > 1 ? 's are' : ' is'} genuinely below its own reorder level at
          {outletName} — pre-filled below, topped up to its own real max level. Adjust or remove any line, or add more.
        </p>
      {:else}
        <p class="hint">Nothing at {outletName} is currently below its own reorder level — add lines manually if you still want to restock ahead of demand.</p>
      {/if}

      <table class="lines-table">
        <thead>
          <tr><th>{translations.current['Item'] ?? 'Item'}</th><th class="num">{translations.current['Quantity'] ?? 'Quantity'}</th><th></th></tr>
        </thead>
        <tbody>
          {#each lines as line, i}
            <tr>
              <td><input bind:value={line.item} placeholder="e.g. Golden Lager 330ml" /></td>
              <td class="num"><input type="number" min="1" bind:value={line.quantity} class="qty-input" /></td>
              <td><button type="button" class="btn secondary small" onclick={() => removeLine(i)}>✕</button></td>
            </tr>
          {/each}
        </tbody>
      </table>
      <button type="button" class="btn secondary" onclick={addLine}>+ {translations.current['Add line'] ?? 'Add line'}</button>
      <button class="btn" onclick={generatePickingList} disabled={generating || lines.length === 0}>
        {generating ? 'Generating…' : (translations.current['Generate picking list'] ?? 'Generate picking list')}
      </button>
    {/if}
  </div>

  {#if pickingList.length > 0}
    <div class="card picking-card">
      <h3>{translations.current['Picking List'] ?? 'Picking List'} — {warehouseName}</h3>
      <p class="hint">Real shelf order — walk the floor top to bottom. Tick each line once the real bottles are physically in hand.</p>
      <table class="picking-table">
        <thead>
          <tr>
            <th></th>
            <th>{translations.current['Item'] ?? 'Item'}</th>
            <th class="num">{translations.current['Quantity'] ?? 'Quantity'}</th>
            <th class="shelf-col">{translations.current['Shelf'] ?? 'Shelf'}</th>
          </tr>
        </thead>
        <tbody>
          {#each pickingList as line}
            <tr class:picked={line.picked}>
              <td>
                <button type="button" class="tick" class:ticked={line.picked} onclick={() => togglePicked(line)} disabled={line.picked || confirming === line.item}>
                  {#if confirming === line.item}…{:else if line.picked}✓{/if}
                </button>
              </td>
              <td>{line.item}</td>
              <td class="num mono">{line.quantity}</td>
              <td class="shelf-col mono">
                {#if line.rack || line.level || line.shelfSide}
                  {line.rack ?? ''}{line.level != null ? `-${line.level}` : ''} {line.shelfSide ?? ''}
                {:else}
                  <span class="no-shelf">—</span>
                {/if}
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
      <button class="btn dispatch-btn" onclick={submitDispatch} disabled={!allPicked || dispatching}>
        {dispatching ? 'Dispatching…' : (translations.current['Dispatch — move real stock now'] ?? 'Dispatch — move real stock now')}
      </button>
      {#if !allPicked}
        <p class="hint">{pickingList.filter((l) => !l.picked).length} line{pickingList.filter((l) => !l.picked).length > 1 ? 's' : ''} still need{pickingList.filter((l) => !l.picked).length === 1 ? 's' : ''} to be ticked off before this run can dispatch.</p>
      {/if}
    </div>
  {/if}

  {#if error}<p class="error center-text">{error}</p>{/if}
  {#if message}<p class="success center-text">{message}</p>{/if}
{/if}

<style>
  .intro {
    max-width: 70ch;
  }
  .center-text {
    text-align: center;
  }
  .form-card,
  .picking-card {
    max-width: 640px;
    margin: 0 auto 1.2rem;
    padding: 1.2rem 1.3rem;
    border: 1px solid var(--rule-strong, #ccc);
    border-radius: 8px;
    background: var(--paper);
  }
  .row-2 {
    display: flex;
    gap: 1rem;
  }
  .row-2 fieldset {
    flex: 1;
  }
  .hint {
    font-size: var(--font-size-small);
    color: var(--ink-soft);
    margin: 0.6rem 0;
  }
  .lines-table th,
  .lines-table td,
  .picking-table th,
  .picking-table td {
    padding: 0.35rem 0.5rem;
    border-bottom: 1px solid var(--rule);
    text-align: left;
  }
  .num {
    text-align: right;
  }
  .qty-input {
    width: 5rem;
    text-align: right;
  }
  .btn.small {
    padding: 0.2rem 0.5rem;
    font-size: var(--font-size-small);
  }
  .shelf-col {
    text-align: right;
    color: var(--ink-soft);
    /* Per direct request: shelf detail sits on the far right, so this
       whole column can be neatly torn off before a picking list ever
       leaves the building. */
  }
  .no-shelf {
    color: var(--ink-soft);
  }
  tr.picked {
    color: var(--ink-soft);
    text-decoration: line-through;
  }
  .tick {
    width: 1.6rem;
    height: 1.6rem;
    border-radius: 50%;
    border: 1px solid var(--rule-strong, #ccc);
    background: var(--paper);
    cursor: pointer;
    font-size: var(--font-size-base);
  }
  .tick.ticked {
    background: var(--brass-dark, #7a5c2e);
    color: white;
    border-color: var(--brass-dark, #7a5c2e);
  }
  .dispatch-btn {
    margin-top: 0.6rem;
  }
  .error {
    color: var(--debit, #a33a2e);
  }
  .success {
    color: #2a5c2a;
  }
</style>
