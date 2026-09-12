<script lang="ts">
  // CashTransaction.svelte — the one, real, genuine screen behind
  // both "Cash Purchase" and "Cash Sale". Confirmed directly: every
  // line of difference between the two original, separate files was
  // pure parameter-swapping (vendor<->customer, Accounts Payable<->
  // Accounts Receivable, "Purchase"<->"Sale", receive<->dispatch) —
  // zero genuine structural difference. One real screen, parameterized
  // by direction, not two.
  import { auth, session, translations } from '$lib/state.svelte';
  import { formatAmount } from '$lib/format';
  import { onMount } from 'svelte';
  import {
    getBusinesses,
    getLedgers,
    listLocations,
    getEntityTree,
    listItems,
    completeCashPurchase,
    completePosSale,
    asBusinessName,
    asLedgerName,
    asLocationName,
    asVendorName,
    asCustomerName,
    asAccountName,
    asItemName,
    ApiError,
    type LocationRecord,
    type EntityNode,
    type ItemSummary,
  } from '$lib/api';

  let { direction }: { direction: 'purchase' | 'sale' } = $props();

  const isPurchase = direction === 'purchase';
  const partyLabel = isPurchase ? 'Vendor' : 'Customer';
  const partyParentEntity = isPurchase ? 'Accounts Payable' : 'Accounts Receivable';
  const locationLabel = isPurchase ? 'Receive at location' : 'Dispatch from location';
  const totalLabel = isPurchase ? 'Total to pay' : 'Total owed';
  const completeLabel = isPurchase ? 'Complete purchase' : 'Complete sale';
  const completingLabel = isPurchase ? 'Purchase completed' : 'Sale completed';
  const notCompleteError = isPurchase ? 'Could not complete this purchase.' : 'Could not complete this sale.';
  const title = isPurchase ? 'Cash Purchase' : 'Cash Sale';
  const intro = isPurchase
    ? 'A real, immediate-payment purchase — paid in full right now, no outstanding Accounts Payable balance, even momentarily. Choose any real location to receive stock at, including a warehouse — possibly the start of a real wholesale channel.'
    : 'A real, immediate-payment sale — paid in full right now, no outstanding Accounts Receivable balance, even momentarily. Choose any real location to dispatch from, including a warehouse — possibly the start of a real wholesale channel. The everyday retail register is the real POS Terminal; this is the same real mechanism for a larger, non-register sale.';

  let businesses: { id: number; name: string }[] = $state([]);
  let ledgers: { id: number; name: string }[] = $state([]);
  let locations: LocationRecord[] = $state([]);
  let entities: EntityNode[] = $state([]);
  let items: ItemSummary[] = $state([]);

  let business = $state('');
  let ledger = $state('');
  let locationName = $state('');
  let partyName = $state('');
  let transdate = $state(new Date().toISOString().slice(0, 10));
  let taxAccount = $state('Sales Tax Payable');
  let paymentMethod = $state('cash');

  let lines: ({ itemName: string; quantity: number; unitPriceMinor: number; taxMinor: number } & { key: number })[] = $state([
    { key: 0, itemName: '', quantity: 1, unitPriceMinor: 0, taxMinor: 0 },
  ]);
  let nextKey = 1;

  let submitting = $state(false);
  let error = $state('');
  let result: { invoiceId: number; reference: string; totalMinor: number } | null = $state(null);
  let loading = $state(true);

  onMount(async () => {
    try {
      businesses = await getBusinesses();
      if (session.current) {
        business = session.current.businessName;
        entities = await getEntityTree();
        items = (await listItems()).rows;
      }
      if (business) await loadForBusiness();
    } catch (e) {
      error = e instanceof ApiError ? e.message : 'Failed to load.';
    } finally {
      loading = false;
    }
  });

  async function loadForBusiness() {
    const [ledgerList, locationList] = await Promise.all([getLedgers(asBusinessName(business)), listLocations(asBusinessName(business))]);
    ledgers = ledgerList;
    locations = locationList;
    const currentSession = session.current;
    if (currentSession && ledgers.some((l) => l.name === currentSession.ledgerName)) ledger = currentSession.ledgerName;
    else if (ledgers.length > 0) ledger = ledgers[0].name;
    if (locations.length > 0 && !locationName) locationName = locations[0].name;
  }

  let parties = $derived(entities.filter((e) => entities.find((p) => p.id === e.parent_id)?.name === partyParentEntity));
  let itemsByName = $derived(new Map(items.map((p) => [p.name, p])));

  function storageOriginOf(itemName: string): 'Hot' | 'Cold' | null {
    if (!itemName.trim()) return null;
    return itemsByName.get(itemName)?.storage_origin ?? null;
  }

  function addLine() {
    lines = [...lines, { key: nextKey++, itemName: '', quantity: 1, unitPriceMinor: 0, taxMinor: 0 }];
  }
  function removeLine(key: number) {
    lines = lines.filter((l) => l.key !== key);
  }
  // Auto-add: as soon as every existing line has a real item name
  // filled in (no blank line left anywhere), a fresh, empty one
  // appears at the end — the same, real, direct spreadsheet-style
  // convention already used elsewhere in this codebase for a form of
  // unknown length, so there's never an "Add line" button to click.
  // Re-fires only on that real transition (not on every keystroke):
  // once a blank line exists, every line().itemName.trim() check
  // below is false until every one is filled again.
  $effect(() => {
    if (lines.length > 0 && lines.every((l) => l.itemName.trim())) addLine();
  });

  let subtotalMinor = $derived(lines.reduce((s, l) => s + l.quantity * l.unitPriceMinor, 0));
  let taxMinor = $derived(lines.reduce((s, l) => s + l.taxMinor, 0));
  let totalMinor = $derived(subtotalMinor + taxMinor);

  async function submit() {
    if (!business || !ledger || !locationName || !partyName || lines.length === 0) return;
    submitting = true;
    error = '';
    result = null;
    try {
      const commonLines = lines.map(({ key, ...l }) => ({ ...l, itemName: asItemName(l.itemName) }));
      if (isPurchase) {
        result = await completeCashPurchase({
          business: asBusinessName(business),
          ledger: asLedgerName(ledger),
          locationName: asLocationName(locationName),
          vendorName: asVendorName(partyName),
          lines: commonLines,
          taxAccount: asAccountName(taxAccount),
          paymentMethod,
          transdate,
        });
      } else {
        result = await completePosSale({
          business: asBusinessName(business),
          ledger: asLedgerName(ledger),
          locationName: asLocationName(locationName),
          customerName: asCustomerName(partyName),
          lines: commonLines,
          taxAccount,
          paymentMethod,
          transdate,
        });
      }
      lines = [];
    } catch (e) {
      error = e instanceof ApiError ? e.message : notCompleteError;
    } finally {
      submitting = false;
    }
  }

  const fmt = (c: number) => formatAmount(c, auth.current?.user.number_format ?? '1 000.00');
</script>

<svelte:head><title>{translations.current[title] ?? title}</title></svelte:head>

<fieldset class="page-title">
  <legend>{translations.current[title] ?? title}</legend>
  <p class="intro">{translations.current[intro] ?? intro}</p>

  {#if loading}
    <p class="center-text">Loading…</p>
  {:else}
    <p class="context-line">
      <strong>{business}</strong> — {ledger}
    </p>
    <div class="row-3">
      <fieldset>
        <legend>{translations.current['Date'] ?? 'Date'}</legend>
        <input type="date" bind:value={transdate} />
      </fieldset>
    </div>
    <div class="row-2">
      <fieldset>
        <legend>{translations.current[partyLabel] ?? partyLabel}</legend>
        <select bind:value={partyName}>
          <option value="">Select {partyLabel.toLowerCase()}…</option>
          {#each parties as p}<option value={translations.current[p.name] ?? p.name}>{translations.current[p.name] ?? p.name}</option>{/each}
        </select>
      </fieldset>
      <fieldset>
        <legend>{translations.current[locationLabel] ?? locationLabel}</legend>
        <select bind:value={locationName}>
          {#each locations as l}<option value={translations.current[l.name] ?? l.name}>{translations.current[l.name] ?? l.name}</option>{/each}
        </select>
      </fieldset>
    </div>

    <table class="lines-table">
      <thead>
        <tr>
          <th>{translations.current['Item'] ?? 'Item'}</th>
          <th class="num">{translations.current['Quantity'] ?? 'Quantity'}</th>
          <th class="num">{translations.current['Unit price'] ?? 'Unit price'}</th>
          <th class="num">{translations.current['Tax'] ?? 'Tax'}</th>
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
            <td class="num">
              <input
                type="number"
                min="0"
                step="0.01"
                value={(line.taxMinor / 100).toFixed(2)}
                oninput={(e) => (line.taxMinor = Math.round(Number(e.currentTarget.value) * 100))}
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

    {#if lines.length > 0}
      <p class="total-line">
        {translations.current[totalLabel] ?? totalLabel}: <strong>{fmt(totalMinor)}</strong>
        ({translations.current['Tax'] ?? 'Tax'}: {fmt(taxMinor)})
      </p>
    {/if}

    <fieldset class="payment-method">
      <legend>{translations.current['Payment method'] ?? 'Payment method'}</legend>
      <label><input type="radio" bind:group={paymentMethod} value="cash" /> {translations.current['Cash'] ?? 'Cash'}</label>
      <label><input type="radio" bind:group={paymentMethod} value="eft" /> {translations.current['EFT'] ?? 'EFT'}</label>
    </fieldset>

    {#if error}<p class="error">{error}</p>{/if}
    {#if result}
      <p class="success">{translations.current[completingLabel] ?? completingLabel}: {result.reference} — {fmt(result.totalMinor)}</p>
    {/if}

    <button class="btn" onclick={submit} disabled={submitting || !partyName || lines.filter((l) => l.itemName.trim()).length === 0}>
      {submitting ? 'Completing…' : (translations.current[completeLabel] ?? completeLabel)}
    </button>
  {/if}
</fieldset>

<style>
  .intro {
    max-width: 70ch;
  }
  .center-text {
    text-align: center;
  }
  .context-line {
    font-size: var(--font-size-base);
    color: var(--ink-soft);
    margin: 0 0 0.8rem;
    padding-bottom: 0.6rem;
    border-bottom: 1px solid var(--rule);
  }
  .row-3 {
    display: flex;
    gap: 1rem;
  }
  .row-3 fieldset {
    flex: 1;
  }
  .row-2 {
    display: flex;
    gap: 1rem;
    margin-top: 0.6rem;
  }
  .row-2 fieldset {
    flex: 1;
  }
  .lines-table th,
  .lines-table td {
    padding: 0.35rem 0.5rem;
    border-bottom: 1px solid var(--rule);
    text-align: left;
  }
  .num {
    text-align: right;
  }
  .num-input {
    width: 6rem;
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
    padding: 0.2rem 0.5rem;
    font-size: var(--font-size-small);
  }
  .total-line {
    font-size: var(--font-size-medium);
    color: var(--ink-soft);
    margin: 0.8rem 0;
  }
  .payment-method {
    margin: 0.8rem 0;
    display: flex;
    align-items: center;
    gap: 1.2rem;
  }
  .payment-method label {
    display: flex;
    align-items: center;
    gap: 0.3rem;
    font-weight: normal;
  }
  .error {
    color: var(--debit, #a33a2e);
  }
  .success {
    padding: 0.5rem 0.7rem;
    border-radius: 5px;
    background: #eaf5ea;
    color: #2a5c2a;
  }
</style>
