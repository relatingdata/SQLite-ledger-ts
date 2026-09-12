<script lang="ts">
  import { auth } from '$lib/state.svelte';
  import { translations } from '$lib/state.svelte';
  import { formatAmount } from '$lib/format';
  import { onMount } from 'svelte';
  import { session } from '$lib/state.svelte';
  import {
    getBusinesses,
    getLedgers,
    getEntityTree,
    listItems,
    listLocations,
    createInvoice,
    postInvoiceById,
    getCreditStatus,
    asBusinessName,
    asLedgerName,
    asCustomerName,
    asLocationName,
    ApiError,
    type EntityNode,
    type CreditStatus,
    type LocationRecord,
    type ItemSummary,
  } from '$lib/api';
  import { parseMinorUnits } from '$lib/money';

  let businesses: { id: number; name: string }[] = $state([]);
  let ledgers: { id: number; name: string }[] = $state([]);
  let entities: EntityNode[] = $state([]);
  let locations: LocationRecord[] = $state([]);
  let items: ItemSummary[] = $state([]);
  let loading = $state(true);
  let saving = $state(false);
  let error = $state('');
  let message = $state('');

  let business = $state('');
  let ledger = $state('');
  let customer = $state('');
  let taxRate = $state('');
  let reference = $state('');
  let transdate = $state(new Date().toISOString().slice(0, 10));
  let description = $state('');
  let saleLocation = $state('');

  let lines: ({ itemName: string; quantity: number; unitPriceMinor: number } & { key: number })[] = $state([
    { key: 0, itemName: '', quantity: 1, unitPriceMinor: 0 },
  ]);
  let nextKey = 1;

  function addLine() {
    lines = [...lines, { key: nextKey++, itemName: '', quantity: 1, unitPriceMinor: 0 }];
  }
  function removeLine(key: number) {
    lines = lines.filter((l) => l.key !== key);
  }
  // Auto-add: matching Cash Sale/Purchase's own, established
  // convention — a fresh, empty line appears once every existing
  // line has a real item name filled in, so there's never an
  // "Add line" button to click.
  $effect(() => {
    if (lines.length > 0 && lines.every((l) => l.itemName.trim())) addLine();
  });

  let itemsByName = $derived(new Map(items.map((p) => [p.name, p])));
  function storageOriginOf(itemName: string): 'Hot' | 'Cold' | null {
    if (!itemName.trim()) return null;
    return itemsByName.get(itemName)?.storage_origin ?? null;
  }

  let subtotalMinor = $derived(lines.reduce((sum, l) => sum + (l.itemName.trim() ? l.quantity * l.unitPriceMinor : 0), 0));
  let taxMinor = $derived(taxRate ? Math.round(subtotalMinor * (Number(taxRate) / 100)) : 0);
  let totalMinor = $derived(subtotalMinor + taxMinor);

  // A real, non-blocking warning — never silently refuses the sale,
  // since account management practice genuinely sometimes extends
  // credit past a nominal limit for a trusted customer; this only
  // makes sure that's a deliberate, informed choice, not an accident.
  let creditStatus: CreditStatus | null = $state(null);
  $effect(() => {
    if (customer) loadCreditStatus(customer);
    else creditStatus = null;
  });
  async function loadCreditStatus(name: string) {
    try {
      creditStatus = await getCreditStatus(name);
    } catch {
      creditStatus = null;
    }
  }
  let wouldExceedLimit = $derived.by(() => creditStatus?.limitMinor != null && creditStatus.balanceMinor + totalMinor > creditStatus.limitMinor);

  onMount(async () => {
    try {
      [businesses, entities, items] = await Promise.all([getBusinesses(), getEntityTree(), listItems().then((r) => r.rows)]);
      business = session.current?.businessName ?? businesses[0]?.name ?? '';
      await loadLedgers();
      locations = await listLocations(asBusinessName(business));
    } catch (e) {
      error = e instanceof ApiError ? e.message : 'Failed to load.';
    } finally {
      loading = false;
    }
  });

  async function loadLedgers() {
    if (!business) return;
    ledgers = await getLedgers(business);
    if (!ledger || !ledgers.some((l) => l.name === ledger)) {
      ledger = session.current?.ledgerName && ledgers.some((l) => l.name === session.current!.ledgerName) ? session.current.ledgerName : ledgers[0]?.name ?? '';
    }
  }

  // Customers live under Accounts Receivable in the entity tree.
  let customers = $derived(entities.filter((e) => entities.find((p) => p.id === e.parent_id)?.name === 'Accounts Receivable'));

  async function save() {
    error = '';
    message = '';
    const realLines = lines.filter((l) => l.itemName.trim());
    if (!reference.trim() || !customer || realLines.length === 0) {
      error = 'Reference, customer, and at least one item line are all required.';
      return;
    }
    saving = true;
    try {
      const { id } = await createInvoice({
        invoiceType: 'AR',
        business: asBusinessName(business),
        ledger: asLedgerName(ledger),
        reference,
        counterpartyName: customer,
        invoiceDate: transdate,
        description: description || undefined,
        lines: realLines.map((l) => ({
          description: l.itemName,
          quantity: l.quantity,
          unitPriceMinor: l.unitPriceMinor,
          amountMinor: l.quantity * l.unitPriceMinor,
          taxMinor: taxRate ? Math.round(l.quantity * l.unitPriceMinor * (Number(taxRate) / 100)) : 0,
          itemName: l.itemName,
        })),
      });
      await postInvoiceById(id, 'Sales Revenue', 'Sales Tax Payable');
      message = `Sale ${reference} to ${customer} recorded.`;
      reference = '';
      lines = [{ key: nextKey++, itemName: '', quantity: 1, unitPriceMinor: 0 }];
      taxRate = '';
      description = '';
    } catch (e) {
      error = e instanceof ApiError ? e.message : 'Could not record this sale.';
    } finally {
      saving = false;
    }
  }
</script>

<svelte:head><title>{translations.current['AR Sale'] ?? 'AR Sale'}</title></svelte:head>

<fieldset class="page-title">
  <legend>{translations.current['AR Sale'] ?? 'AR Sale'}</legend>
  <p class="intro">{translations.current['A sale to a customer on credit — debits their Accounts Receivable balance, credits Sales Revenue.'] ?? 'A sale to a customer on credit — debits their Accounts Receivable balance, credits Sales Revenue.'}</p>

  {#if loading}
    <p>Loading…</p>
  {:else}
    {#if error}<p class="error">{error}</p>{/if}
    {#if message}<p class="success">{message}</p>{/if}

    <p class="context-line">
      <strong>{business}</strong> — {ledger}
    </p>
    <div class="row">
      <fieldset>
        <legend>{translations.current['Date'] ?? 'Date'}</legend>
        <input type="date" bind:value={transdate} />
      </fieldset>
      <fieldset>
        <legend>{translations.current['Reference'] ?? 'Reference'}</legend>
        <input bind:value={reference} placeholder="e.g. INV-1001" />
      </fieldset>
      <fieldset class="grow">
        <legend>{translations.current['Customer'] ?? 'Customer'}</legend>
        <select bind:value={customer}>
          <option value="">Select customer…</option>
          {#each customers as c}<option value={translations.current[c.name] ?? c.name}>{translations.current[c.name] ?? c.name}</option>{/each}
        </select>
      </fieldset>
      <fieldset class="grow">
        <legend>{translations.current['Location'] ?? 'Location'}</legend>
        <select bind:value={saleLocation}>
          <option value="">{translations.current['unknown'] ?? 'Not yet known'}</option>
          {#each locations as l}<option value={translations.current[l.name] ?? l.name}>{translations.current[l.name] ?? l.name}</option>{/each}
        </select>
      </fieldset>
      <fieldset>
        <legend>{translations.current['Tax %'] ?? 'Tax %'}</legend>
        <input bind:value={taxRate} placeholder="0" inputmode="decimal" />
      </fieldset>
      <fieldset class="grow">
        <legend>{translations.current['Description'] ?? 'Description'}</legend>
        <input bind:value={description} placeholder="optional" />
      </fieldset>
    </div>

    <table class="lines-table">
      <thead>
        <tr>
          <th>{translations.current['Item'] ?? 'Item'}</th>
          <th class="num">{translations.current['Quantity'] ?? 'Quantity'}</th>
          <th class="num">{translations.current['Unit price'] ?? 'Unit price'}</th>
          <th>{translations.current['Storage'] ?? 'Storage'}</th>
          <th></th>
        </tr>
      </thead>
      <tbody>
        {#each lines as line (line.key)}
          <tr>
            <td><input bind:value={line.itemName} placeholder="e.g. Golden Lager 330ml" /></td>
            <td class="num"><input type="number" min="1" bind:value={line.quantity} class="num-input" /></td>
            <td class="num">
              <input
                type="number"
                min="0"
                step="0.01"
                value={(line.unitPriceMinor / 100).toFixed(2)}
                oninput={(e) => (line.unitPriceMinor = Math.round(Number(e.currentTarget.value) * 100))}
                class="num-input"
              />
            </td>
            <td class="storage-cell">
              {#if storageOriginOf(line.itemName) === 'Cold'}
                <span class="storage-tag cold">{translations.current['Cold'] ?? 'Cold'}</span>
              {:else if storageOriginOf(line.itemName) === 'Hot'}
                <span class="storage-tag shelf">{translations.current['Hot'] ?? 'Hot'}</span>
              {/if}
            </td>
            <td>{#if lines.length > 1}<button type="button" class="btn secondary small" onclick={() => removeLine(line.key)}>✕</button>{/if}</td>
          </tr>
        {/each}
      </tbody>
    </table>

    {#if subtotalMinor > 0}
      <p class="total-line">{translations.current['Total owed:'] ?? 'Total owed:'}<strong>{formatAmount(totalMinor, auth.current?.user.number_format ?? '1 000.00')}</strong> (tax: {formatAmount(taxMinor, auth.current?.user.number_format ?? '1 000.00')})</p>
    {/if}
    {#if wouldExceedLimit && creditStatus}
      <p class="credit-warning">
        <strong>{translations.current['Over credit limit'] ?? 'Over credit limit'}:</strong>
        {customer}'s balance of {formatAmount(creditStatus.balanceMinor, auth.current?.user.number_format ?? '1 000.00')} plus this sale
        would exceed their {formatAmount(creditStatus.limitMinor ?? 0, auth.current?.user.number_format ?? '1 000.00')} limit. You can still
        proceed if this is a deliberate exception.
      </p>
    {/if}
    <button class="btn" onclick={save} disabled={saving}>{saving ? (translations.current['Saving'] ?? 'Saving…') : (translations.current['Save'] ?? 'Save')}</button>
  {/if}
</fieldset>

<style>

  .context-line {
    font-size: var(--font-size-base);
    color: var(--ink-soft);
    margin: 0;
    padding-bottom: 0.6rem;
    border-bottom: 1px solid var(--rule);
  }

  .row {
    display: flex;
    gap: 0.8rem;
    flex-wrap: wrap;
    align-items: flex-end;
  }

  .grow {
    flex: 1;
    min-width: 180px;
  }

  .success {
    color: var(--credit);
  }

  .total-line {
    font-size: var(--font-size-medium);
    color: var(--ink-soft);
    margin: 0;
  }

  .credit-warning {
    font-size: var(--font-size-base);
    padding: 0.5rem 0.7rem;
    border-radius: 5px;
    background: #fdecea;
    color: #a33a2e;
    margin: 0;
  }


  .lines-table th, .lines-table td {
    padding: 0.35rem 0.5rem;
    border-bottom: 1px solid var(--rule);
    text-align: left;
  }

  .lines-table th.num, .lines-table td.num {
    text-align: right;
  }

  .num-input {
    width: 90px;
    text-align: right;
  }

  .storage-cell {
    white-space: nowrap;
  }

  .storage-tag {
    display: inline-block;
    padding: 0.1rem 0.5rem;
    border-radius: 4px;
    font-size: var(--font-size-small);
    font-weight: 600;
  }

  .storage-tag.cold {
    background: #e3f0fb;
    color: #1e5f8f;
  }

  .storage-tag.shelf {
    background: #f5efe3;
    color: #8a6a2a;
  }

  .btn.small {
    padding: 0.1rem 0.5rem;
    font-size: var(--font-size-small);
  }
</style>
