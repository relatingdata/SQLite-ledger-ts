<script lang="ts">
  import { auth } from '$lib/state.svelte';
  import { formatAmount } from '$lib/format';
  import { onMount } from 'svelte';
  import { session } from '$lib/state.svelte';
  import { getEntityTree, listItems, writeOffItems, receiveLot, getExpiringStock, asBusinessName, asLedgerName, asItemName, asAccountName, ApiError, type EntityNode, type ItemSummary, type ExpiringLot } from '$lib/api';
  import { translations } from '$lib/state.svelte';

  let entities: EntityNode[] = $state([]);
  let items: ItemSummary[] = $state([]);
  let expiring: ExpiringLot[] = $state([]);
  let loading = $state(true);
  let error = $state('');
  let message = $state('');
  let withinDays = $state(30);

  async function loadAll() {
    loading = true;
    try {
      [entities, { rows: items }, expiring] = await Promise.all([getEntityTree(), listItems(session.current?.businessName ?? ''), getExpiringStock(undefined, withinDays)]);
    } catch (e) {
      error = e instanceof ApiError ? e.message : 'Failed to load.';
    } finally {
      loading = false;
    }
  }

  onMount(loadAll);

  let expenseAccounts = $derived(entities.filter((e) => entities.find((p) => p.id === e.parent_id)?.name === 'Expense'));
  let assetAccounts = $derived(entities.filter((e) => entities.find((p) => p.id === e.parent_id)?.name === 'Asset'));

  // Write-off form
  let woReference = $state('');
  let woItem = $state('');
  let woQuantity = $state('');
  let woUnitCost = $state('');
  let woExpenseAccount = $state('');
  let woInventoryAccount = $state('Inventory');
  let woReason = $state('');
  let woDate = $state('');
  let writingOff = $state(false);

  async function submitWriteOff() {
    if (!session.current) return;
    writingOff = true;
    error = '';
    message = '';
    try {
      await writeOffItems({
        business: session.current.businessName,
        ledger: session.current.ledgerName,
        reference: woReference,
        itemName: asItemName(woItem),
        quantity: Math.round(Math.abs(Number(woQuantity))),
        unitCostMinor: Math.round(Math.abs(Number(woUnitCost)) * 100),
        writeOffExpenseAccount: asAccountName(woExpenseAccount),
        inventoryAccount: woInventoryAccount,
        reason: woReason,
        transdate: woDate || undefined,
      });
      message = `Wrote off ${woQuantity} of ${woItem}.`;
      woReference = '';
      woQuantity = '';
      woUnitCost = '';
      woReason = '';
      await loadAll();
    } catch (e) {
      error = e instanceof ApiError ? e.message : 'Could not write off stock.';
    } finally {
      writingOff = false;
    }
  }

  // Receive lot form
  let lotReference = $state('');
  let lotItem = $state('');
  let lotNumber = $state('');
  let lotReceivedDate = $state('');
  let lotExpirationDate = $state('');
  let lotQuantity = $state('');
  let receivingLot = $state(false);

  async function submitReceiveLot() {
    if (!session.current) return;
    receivingLot = true;
    error = '';
    message = '';
    try {
      await receiveLot({
        business: session.current.businessName,
        ledger: session.current.ledgerName,
        reference: lotReference,
        itemName: asItemName(lotItem),
        lotNumber,
        receivedDate: lotReceivedDate,
        expirationDate: lotExpirationDate || null,
        quantity: Math.round(Math.abs(Number(lotQuantity))),
      });
      message = `Received lot ${lotNumber} of ${lotItem}.`;
      lotReference = '';
      lotNumber = '';
      lotQuantity = '';
      lotExpirationDate = '';
      await loadAll();
    } catch (e) {
      error = e instanceof ApiError ? e.message : 'Could not receive lot.';
    } finally {
      receivingLot = false;
    }
  }

  const fmt = (c: number) => formatAmount(c, auth.current?.user.number_format ?? '1 000.00');
</script>

<svelte:head><title>Stock Write-offs &amp; Expiration</title></svelte:head>

<fieldset class="page-title">
  <legend>{translations.current['Write-offs & Expiration'] ?? 'Stock Write-offs & Expiration'}</legend>
  <p class="intro">{translations.current['Write off broken, spoiled, or expired stock — a real transaction, reducing quantity on hand and recognizing the loss in the ledger, not just an adjustment with no accounting consequence. Track batches/lots with their own expiration dates below, separate from a item\'s overall quantity.'] ?? 'Write off broken, spoiled, or expired stock — a real transaction, reducing quantity on hand and recognizing the loss in the ledger, not just an adjustment with no accounting consequence. Track batches/lots with their own expiration dates below, separate from a item\'s overall quantity.'}</p>

  {#if loading}
  <p>Loading…</p>
{:else}
    {#if error}<p class="error">{error}</p>{/if}
    {#if message}<p class="success">{message}</p>{/if}

    <div class="layout">
      <div class="card form-card">
        <h3>{translations.current['Write off stock'] ?? 'Write off stock'}</h3>
        <div class="row-2">
          <fieldset>
            <legend>{translations.current['Reference'] ?? 'Reference'}</legend>
            <input bind:value={woReference} placeholder="e.g. WO-1001" />
          </fieldset>
          <fieldset>
            <legend>{translations.current['Date'] ?? 'Date'}</legend>
            <input type="date" bind:value={woDate} />
          </fieldset>
        </div>
        <fieldset>
          <legend>{translations.current['Item'] ?? 'Item'}</legend>
          <select bind:value={woItem}>
            <option value="">Select…</option>
            {#each items as p}<option value={translations.current[p.name] ?? p.name}>{translations.current[p.name] ?? p.name}</option>{/each}
          </select>
        </fieldset>
        <div class="row-2">
          <fieldset>
            <legend>{translations.current['Quantity'] ?? 'Quantity'}</legend>
            <input bind:value={woQuantity} placeholder="e.g. 15" inputmode="numeric" />
          </fieldset>
          <fieldset>
            <legend>{translations.current['Unit cost'] ?? 'Unit cost'}</legend>
            <input bind:value={woUnitCost} placeholder="0.00" inputmode="decimal" />
          </fieldset>
        </div>
        <div class="row-2">
          <fieldset>
            <legend>{translations.current['Write-off expense account'] ?? 'Write-off expense account'}</legend>
            <select bind:value={woExpenseAccount}>
              <option value="">Select…</option>
              {#each expenseAccounts as a}<option value={translations.current[a.name] ?? a.name}>{translations.current[a.name] ?? a.name}</option>{/each}
            </select>
          </fieldset>
          <fieldset>
            <legend>{translations.current['Inventory account'] ?? 'Inventory account'}</legend>
            <select bind:value={woInventoryAccount}>
              {#each assetAccounts as a}<option value={translations.current[a.name] ?? a.name}>{translations.current[a.name] ?? a.name}</option>{/each}
            </select>
          </fieldset>
        </div>
        <fieldset>
          <legend>{translations.current['Reason'] ?? 'Reason'}</legend>
          <input bind:value={woReason} placeholder="e.g. Spoiled, damaged in transit" />
        </fieldset>
        <button class="btn" onclick={submitWriteOff} disabled={writingOff}>{writingOff ? 'Writing off…' : 'Write off'}</button>
      </div>

      <div class="card form-card">
        <h3>{translations.current['Receive a lot'] ?? 'Receive a lot'}</h3>
        <div class="row-2">
          <fieldset>
            <legend>{translations.current['Reference'] ?? 'Reference'}</legend>
            <input bind:value={lotReference} placeholder="e.g. LOT-REC-1001" />
          </fieldset>
          <fieldset>
            <legend>{translations.current['Lot number'] ?? 'Lot number'}</legend>
            <input bind:value={lotNumber} placeholder="e.g. L-2027-03" />
          </fieldset>
        </div>
        <fieldset>
          <legend>{translations.current['Item'] ?? 'Item'}</legend>
          <select bind:value={lotItem}>
            <option value="">Select…</option>
            {#each items as p}<option value={translations.current[p.name] ?? p.name}>{translations.current[p.name] ?? p.name}</option>{/each}
          </select>
        </fieldset>
        <div class="row-2">
          <fieldset>
            <legend>{translations.current['Received date'] ?? 'Received date'}</legend>
            <input type="date" bind:value={lotReceivedDate} />
          </fieldset>
          <fieldset>
            <legend>{translations.current['Expiration date'] ?? 'Expiration date'}</legend>
            <input type="date" bind:value={lotExpirationDate} placeholder="optional" />
          </fieldset>
        </div>
        <fieldset>
          <legend>{translations.current['Quantity'] ?? 'Quantity'}</legend>
          <input bind:value={lotQuantity} placeholder="e.g. 100" inputmode="numeric" />
        </fieldset>
        <button class="btn" onclick={submitReceiveLot} disabled={receivingLot}>{receivingLot ? 'Receiving…' : 'Receive lot'}</button>
      </div>
    </div>

    <div class="card expiring-card">
      <div class="expiring-header">
        <h3>{translations.current['Expiring Stock'] ?? 'Expiring stock'}</h3>
        <fieldset>
          <legend>{translations.current['Within (days)'] ?? 'Within (days)'}</legend>
          <input type="number" min="1" bind:value={withinDays} onchange={loadAll} />
        </fieldset>
      </div>
      {#if expiring.length === 0}
        <p class="empty">Nothing expiring within {withinDays} days.</p>
      {:else}
        <table>
          <thead>
            <tr>
              <th>{translations.current['Item'] ?? 'Item'}</th>
              <th>{translations.current['Lot'] ?? 'Lot'}</th>
              <th>{translations.current['Expires'] ?? 'Expires'}</th>
              <th class="num">{translations.current['Quantity'] ?? 'Quantity'}</th>
              <th class="num">{translations.current['Days'] ?? 'Days'}</th>
            </tr>
          </thead>
          <tbody>
            {#each expiring as lot}
              <tr class:overdue={lot.days_until_expiration < 0}>
                <td>{lot.item}</td>
                <td>{lot.lot_number}</td>
                <td>{lot.expiration_date}</td>
                <td class="num">{lot.quantity_on_hand}</td>
                <td class="num">{lot.days_until_expiration}</td>
              </tr>
            {/each}
          </tbody>
        </table>
      {/if}
    </div>
  {/if}
</fieldset>

<style>
  .intro {
    max-width: 70ch;
  }

.layout {
    display: flex;
    gap: 1.2rem;
    margin-bottom: 1.2rem;
  }
  .form-card {
    flex: 1;
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
  .expiring-card {
    padding: 1rem 1.2rem 1.3rem;
  }
  .expiring-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    margin-bottom: 0.8rem;
  }
  .expiring-header fieldset {
    width: 140px;
  }
  .expiring-card th,
  .expiring-card td {
    padding: 0.4rem 0.6rem;
    text-align: left;
    border-bottom: 1px solid var(--rule);
  }
  .expiring-card tr.overdue td {
    color: var(--debit);
  }
  .empty {
    color: var(--ink-soft);
  }
  .success {
    color: var(--credit);
  }
</style>
