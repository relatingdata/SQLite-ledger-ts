<script lang="ts">
  import { onMount } from 'svelte';
  import { session } from '$lib/state.svelte';
  import { listLocations, createStockTake, getStockTake, recordStockTakeCount, completeStockTake, asBusinessName, asAccountName, asLocationName, asItemName, ApiError, type LocationRecord, type StockTake } from '$lib/api';
  import { translations } from '$lib/state.svelte';
  import Form from '$lib/components/Form.svelte';

  let locations: LocationRecord[] = $state([]);
  let loading = $state(true);
  let error = $state('');
  let message = $state('');

  let take: StockTake | null = $state(null);
  let counts: Record<string, string> = $state({});

  // New take form
  let newTakeValues: Record<string, string | number | string[]> = $state({ location: '', date: '' });

  // Complete form
  let varianceExpenseAccount = $state('');
  let inventoryAccount = $state('Inventory');
  let unitCosts: Record<string, string> = $state({});
  let completing = $state(false);

  async function loadAll() {
    loading = true;
    try {
      locations = await listLocations(asBusinessName(session.current?.businessName ?? ''));
    } catch (e) {
      error = e instanceof ApiError ? e.message : 'Failed to load.';
    } finally {
      loading = false;
    }
  }

  onMount(loadAll);

  async function startNew(v: Record<string, string | number | string[]>) {
    const newLocation = String(v.location ?? '');
    const newTakeDate = String(v.date ?? '');
    if (!newLocation || !newTakeDate) return;
    try {
      const { id } = await createStockTake(asLocationName(newLocation), newTakeDate);
      take = await getStockTake(id);
      counts = {};
      unitCosts = {};
    } catch (e) {
      throw e instanceof ApiError ? new Error(e.message) : new Error('Could not create stock take.');
    }
  }

  async function saveCount(itemName: string) {
    if (!take || counts[itemName] === undefined || counts[itemName] === '') return;
    error = '';
    try {
      await recordStockTakeCount(take.id, asItemName(itemName), Math.round(Math.abs(Number(counts[itemName]))));
      take = await getStockTake(take.id);
      message = `Recorded count for ${itemName}.`;
    } catch (e) {
      error = e instanceof ApiError ? e.message : 'Could not record count.';
    }
  }

  let variantLines = $derived.by(() => take ? take.lines.filter((l) => l.counted_quantity != null && l.counted_quantity !== l.expected_quantity) : []);

  async function submitComplete() {
    if (!take || !session.current) return;
    completing = true;
    error = '';
    try {
      const unitCostMinorByItem: Record<string, number> = {};
      for (const line of variantLines) {
        unitCostMinorByItem[line.item] = Math.round(Math.abs(Number(unitCosts[line.item] ?? '0')) * 100);
      }
      await completeStockTake(take.id, session.current.businessName, session.current.ledgerName, asAccountName(varianceExpenseAccount), inventoryAccount, unitCostMinorByItem);
      take = await getStockTake(take.id);
      message = 'Stock take completed.';
    } catch (e) {
      error = e instanceof ApiError ? e.message : 'Could not complete.';
    } finally {
      completing = false;
    }
  }
</script>

<svelte:head><title>{translations.current['Stock Take'] ?? 'Stock Take'}</title></svelte:head>

<fieldset class="page-title">
  <legend>{translations.current['Stock Take'] ?? 'Stock Take'}</legend>
  <p class="intro">{translations.current['A physical inventory count for one location — the sheet is ordered the way you actually walk the floor (shelf side, then rack, then top to bottom), not alphabetically by item name. Completing it posts any real variance to the ledger and corrects quantity on hand to match what was actually counted.'] ?? 'A physical inventory count for one location — the sheet is ordered the way you actually walk the floor (shelf side, then rack, then top to bottom), not alphabetically by item name. Completing it posts any real variance to the ledger and corrects quantity on hand to match what was actually counted.'}</p>

  {#if loading}
  <p>Loading…</p>
{:else}
    {#if error}<p class="error">{error}</p>{/if}
    {#if message}<p class="success">{message}</p>{/if}

    {#if !take}
      <div class="card form-card">
        <h3>{translations.current['Start a new stock take'] ?? 'Start a new stock take'}</h3>
        <Form
          fields={[
            { name: 'location', label: 'Location', type: 'select', options: locations.map((l) => l.name) },
            { name: 'date', label: 'Date', type: 'date' },
          ]}
          bind:values={newTakeValues}
          onSubmit={startNew}
          submitLabel="Create sheet"
        />
      </div>
    {:else}
      <fieldset class="card-legend">
        <legend>{take.location} — {take.take_date} <span class="status">({take.status})</span></legend>
        <table class="sheet">
          <thead>
            <tr>
              <th>{translations.current['Shelf Side'] ?? 'Shelf side'}</th>
              <th>{translations.current['Rack'] ?? 'Rack'}</th>
              <th>{translations.current['Level'] ?? 'Level'}</th>
              <th>{translations.current['Item'] ?? 'Item'}</th>
              <th class="num">{translations.current['Expected'] ?? 'Expected'}</th>
              <th class="num">{translations.current['Counted'] ?? 'Counted'}</th>
              {#if take.status === 'draft'}<th></th>{/if}
            </tr>
          </thead>
          <tbody>
            {#each take.lines as line}
              <tr class:variance={line.counted_quantity != null && line.counted_quantity !== line.expected_quantity}>
                <td>{line.shelf_side ?? ''}</td>
                <td>{line.rack ?? ''}</td>
                <td>{line.level ?? ''}</td>
                <td>{line.item}</td>
                <td class="num mono">{line.expected_quantity}</td>
                <td class="num">
                  {#if take.status === 'draft'}
                    <input class="count-input" bind:value={counts[line.item]} placeholder={String(line.expected_quantity)} inputmode="numeric" />
                  {:else}
                    {line.counted_quantity ?? ''}
                  {/if}
                </td>
                {#if take.status === 'draft'}
                  <td><button class="btn secondary small" onclick={() => saveCount(line.item)}>{translations.current['Save'] ?? 'Save'}</button></td>
                {/if}
              </tr>
            {/each}
          </tbody>
        </table>

        {#if take.status === 'draft'}
          <h4>{translations.current['Complete'] ?? 'Complete'}</h4>
          {#if variantLines.length > 0}
            <p class="dim">Give a unit cost for each item with a variance, to value the loss/gain correctly:</p>
            {#each variantLines as line}
              <div class="unit-cost-row">
                <span>{line.item} ({line.counted_quantity! - line.expected_quantity > 0 ? '+' : ''}{line.counted_quantity! - line.expected_quantity})</span>
                <input bind:value={unitCosts[line.item]} placeholder={translations.current['Unit cost'] ?? 'Unit cost'} inputmode="decimal" />
              </div>
            {/each}
          {:else}
            <p class="dim">{translations.current['No variance recorded yet.'] ?? 'No variance recorded yet.'}</p>
          {/if}
          <div class="row-2">
            <fieldset>
              <legend>{translations.current['Variance account'] ?? 'Variance account'}</legend>
              <input bind:value={varianceExpenseAccount} placeholder="e.g. Miscellaneous" />
            </fieldset>
            <fieldset>
              <legend>{translations.current['Inventory account'] ?? 'Inventory account'}</legend>
              <input bind:value={inventoryAccount} />
            </fieldset>
          </div>
          <button class="btn" onclick={submitComplete} disabled={completing}>{completing ? 'Completing…' : (translations.current['Complete stock take'] ?? 'Complete stock take')}</button>
        {/if}

        <button class="btn secondary" onclick={() => (take = null)}>{translations.current['Start a different sheet'] ?? 'Start a different sheet'}</button>
      </fieldset>
    {/if}
  {/if}
</fieldset>

<style>
  .intro {
    max-width: 70ch;
  }

.form-card {
    max-width: 480px;
    margin: 0 auto;
    padding: 1rem 1.2rem 1.3rem;
    display: flex;
    flex-direction: column;
    gap: 0.7rem;
  }
  .row-2 {
    display: flex;
    gap: 0.8rem;
  }
  .row-2 > * {
    flex: 1;
  }
  .status {
    font-size: var(--font-size-small);
    color: var(--ink-soft);
    font-weight: normal;
  }
  .sheet th,
  .sheet td {
    padding: 0.35rem 0.5rem;
    border-bottom: 1px solid var(--rule);
    text-align: left;
  }
  .sheet tr.variance td {
    background: #fdf3ee;
  }
  .count-input {
    width: 80px;
  }
  .btn.small {
    padding: 0.2rem 0.5rem;
    font-size: var(--font-size-small);
  }
  .unit-cost-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.8rem;
    margin-bottom: 0.4rem;
  }
  .unit-cost-row input {
    width: 120px;
  }
  .success {
    color: var(--credit);
  }
</style>
