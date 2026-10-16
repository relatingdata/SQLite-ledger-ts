<script lang="ts">
  import { onMount } from 'svelte';
  import { session } from '$lib/state.svelte';
  import { auth } from '$lib/state.svelte';
  import { formatAmount } from '$lib/format';
  import { translations } from '$lib/state.svelte';
  import {
    listLocations,
    listItems,
    lookupItemByUpc,
    completePosSale,
    listPendingCustomers,
    verifyCustomer,
    getPosTerminals,
    createPosTerminal,
    asBusinessName,
    asLocationName,
    asCustomerName,
    asAccountName,
    asItemName,
    ApiError,
    type LocationRecord,
    type ItemSummary,
    type PosSaleLineInput,
    type PosSaleResult,
    type PendingCustomer,
    type PosTerminalRecord,
  } from '$lib/api';

  interface CartLine extends PosSaleLineInput {
    id: string;
  }

  let locations: LocationRecord[] = [];
  let items: ItemSummary[] = [];
  let loading = true;
  let error = '';

  let locationName = '';
  let customerName = 'Cash Sale';
  let onAccount = false;

  // Per docs/multicurrency-design.md, Slice 4 - each real POS terminal
  // is a real, single cash drawer, transacting in exactly one real
  // currency. A real, ordinary retail outlet has none of these at
  // all; a real, border-town one may show two or more real terminals,
  // one per real, distinct currency it actually serves customers in.
  let terminals: PosTerminalRecord[] = [];
  let terminalName = '';
  let showAddTerminal = false;
  let newTerminalName = '';
  let newTerminalCurrency = '';

  let productInput = '';
  let searchResults: ItemSummary[] = [];
  let cart: CartLine[] = [];

  let taxAccount = 'Sales Tax Payable';
  let paymentMethod: 'cash' | 'card' = 'cash';
  let cashTendered = '';

  let completing = false;
  let receipt: PosSaleResult | null = null;

  let pendingCustomers: PendingCustomer[] = [];
  let showPending = false;

  // Every real terminal a real location actually has, each with its
  // own real, resolved currency (or none — the real, ordinary,
  // home-currency case). Re-loaded whenever the selected location
  // changes; a real, ordinary location returns a real, empty list.
  async function loadTerminals(name: string) {
    terminals = [];
    terminalName = '';
    if (!name) return;
    try {
      terminals = await getPosTerminals(name);
    } catch {
      // non-critical — the register still works in the real, ordinary, home-currency case
    }
  }
  $: loadTerminals(locationName);

  async function addTerminal() {
    if (!newTerminalName.trim() || !locationName) return;
    try {
      await createPosTerminal(locationName, newTerminalName.trim(), newTerminalCurrency.trim() || undefined);
      terminals = await getPosTerminals(locationName);
      terminalName = newTerminalName.trim();
      newTerminalName = '';
      newTerminalCurrency = '';
      showAddTerminal = false;
    } catch (e) {
      error = e instanceof ApiError ? e.message : 'Could not create that terminal.';
    }
  }

  async function loadPending() {
    try {
      pendingCustomers = await listPendingCustomers();
    } catch {
      // non-critical — the register still works without this
    }
  }

  async function decideCustomer(name: string, approve: boolean) {
    try {
      await verifyCustomer(name, approve);
      await loadPending();
    } catch (e) {
      error = e instanceof ApiError ? e.message : 'Could not verify.';
    }
  }

  onMount(async () => {
    try {
      [locations, { rows: items }] = await Promise.all([listLocations(asBusinessName(session.current?.businessName ?? '')), listItems(session.current?.businessName ?? '')]);
      const firstRetail = locations.find((l) => l.location_type === 'Retail');
      if (firstRetail) locationName = firstRetail.name;
    } catch (e) {
      error = e instanceof ApiError ? e.message : 'Failed to load.';
    } finally {
      loading = false;
    }
    loadPending();
  });

  $: retailLocations = locations.filter((l) => l.location_type === 'Retail' && !l.name.includes('Refrigerated'));

  function addToCart(item: ItemSummary) {
    const existing = cart.find((l) => l.itemName === item.name);
    if (existing) {
      existing.quantity += 1;
      cart = [...cart];
    } else {
      cart = [
        ...cart,
        {
          id: crypto.randomUUID(),
          itemName: asItemName(item.name),
          quantity: 1,
          // A real, combination-tagged item's own, real price is
          // resolved server-side (getItemPriceForCurrency, checked
          // against its exact combination first) - omitted here
          // entirely, rather than defaulting to a real item's own,
          // separate, base retail price (or, worse, a bare 0).
          unitPriceMinor: item.combinationValues ? undefined : (item.retail_price_minor ?? 0),
          taxMinor: 0,
          combinationValues: item.combinationValues,
          combinationShape: item.combinationShape,
        },
      ];
    }
    productInput = '';
    searchResults = [];
  }

  async function onProductInputKeydown(e: KeyboardEvent) {
    if (e.key !== 'Enter' || !productInput.trim()) return;
    // A scanner types the UPC then hits Enter — try an exact UPC match
    // first. If nothing matches, fall back to the first name search hit.
    try {
      const item = await lookupItemByUpc(productInput.trim());
      addToCart(item);
      return;
    } catch {
      // not a UPC match — fall through to name search
    }
    if (searchResults.length > 0) {
      addToCart(searchResults[0]);
    }
  }

  $: searchResults = productInput.trim().length >= 2 ? items.filter((p) => p.name.toLowerCase().includes(productInput.trim().toLowerCase())).slice(0, 8) : [];

  function removeLine(id: string) {
    cart = cart.filter((l) => l.id !== id);
  }

  $: subtotalMinor = cart.reduce((s, l) => s + l.quantity * (l.unitPriceMinor ?? 0), 0);
  $: taxMinor = cart.reduce((s, l) => s + l.taxMinor, 0);
  $: totalMinor = subtotalMinor + taxMinor;
  $: cashTenderedMinor = Math.round(Math.abs(Number(cashTendered) || 0) * 100);
  $: changeDueMinor = onAccount ? 0 : Math.max(0, cashTenderedMinor - totalMinor);
  $: fmt = (c: number) => formatAmount(c, auth.current?.user.number_format ?? '1 000.00');

  async function completeSale() {
    if (!session.current || cart.length === 0 || !locationName) return;
    completing = true;
    error = '';
    try {
      const result = await completePosSale({
        business: session.current.businessName,
        ledger: session.current.ledgerName,
        locationName: asLocationName(locationName),
        customerName: asCustomerName(onAccount ? customerName : 'Cash Sale'),
        lines: cart.map((l) => ({ itemName: asItemName(l.itemName), quantity: l.quantity, unitPriceMinor: l.unitPriceMinor, taxMinor: l.taxMinor })),
        taxAccount: asAccountName(taxAccount),
        paymentMethod: onAccount ? undefined : paymentMethod,
        cashTenderedMinor: onAccount ? undefined : cashTenderedMinor,
        terminalName: terminalName || undefined,
      }, 'POS Sale');
      receipt = result;
      cart = [];
      cashTendered = '';
    } catch (e) {
      error = e instanceof ApiError ? e.message : 'Could not complete sale.';
    } finally {
      completing = false;
    }
  }

  function newSale() {
    receipt = null;
  }
</script>

<svelte:head><title>{translations.current['POS Terminal'] ?? 'POS Terminal'}</title></svelte:head>

<fieldset class="page-title">
  <legend>{translations.current['POS Terminal'] ?? 'POS Terminal'}</legend>

{#if pendingCustomers.length > 0}
  <div class="card pending-card">
    <button type="button" class="pending-toggle" onclick={() => (showPending = !showPending)}>
      {pendingCustomers.length} customer registration{pendingCustomers.length === 1 ? '' : 's'} awaiting verification
      {showPending ? '▲' : '▼'}
    </button>
    {#if showPending}
      <table>
        <thead>
          <tr>
            <th>{translations.current['Name'] ?? 'Name'}</th>
            <th>{translations.current['Email'] ?? 'Email'}</th>
            <th>{translations.current['Phone'] ?? 'Phone'}</th>
            <th>{translations.current['Card on file'] ?? 'Card on file'}</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {#each pendingCustomers as c}
            <tr>
              <td>{translations.current[c.name] ?? c.name}</td>
              <td>{c.email ?? ''}</td>
              <td>{c.phone ?? ''}</td>
              <td>{c.card_label ?? '(none given)'}</td>
              <td class="pending-actions">
                <button class="btn small" onclick={() => decideCustomer(c.name, true)}>{translations.current['Approve'] ?? 'Approve'}</button>
                <button class="btn secondary small" onclick={() => decideCustomer(c.name, false)}>{translations.current['Reject'] ?? 'Reject'}</button>
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
      <p class="hint">Check the customer's actual card/ID against what's shown here before approving.</p>
    {/if}
  </div>
{/if}

{#if loading}
  <p>{translations.current['Loading'] ?? 'Loading…'}</p>
{:else if receipt}
  <div class="card receipt no-print-controls">
    <h3>{translations.current['Sale complete'] ?? 'Sale complete'} — {receipt.reference}</h3>
    <p class="receipt-total">{translations.current['Total'] ?? 'Total'}: {fmt(receipt.totalMinor)}</p>
    {#if receipt.changeDueMinor > 0}
      <p class="receipt-change">Change due: {fmt(receipt.changeDueMinor)}</p>
    {/if}
    <div class="receipt-actions">
      <button class="btn" onclick={() => window.print()}>{translations.current['Print receipt'] ?? 'Print receipt'}</button>
      <button class="btn secondary" onclick={newSale}>{translations.current['New sale'] ?? 'New sale'}</button>
    </div>
  </div>
{:else}
  {#if error}<p class="error">{error}</p>{/if}

  <div class="pos-layout">
    <div class="card setup-card">
      <fieldset>
        <legend>{translations.current['Store'] ?? 'Store'}</legend>
        <select bind:value={locationName}>
          {#each retailLocations as l}<option value={translations.current[l.name] ?? l.name}>{translations.current[l.name] ?? l.name} ({l.city})</option>{/each}
        </select>
      </fieldset>

      {#if terminals.length > 0 || showAddTerminal}
        <fieldset>
          <legend>{translations.current['Terminal'] ?? 'Terminal'}</legend>
          <select bind:value={terminalName}>
            <option value="">{translations.current['(home currency)'] ?? '(home currency)'}</option>
            {#each terminals as t}<option value={t.name}>{t.name}{t.currency ? ` (${t.currency})` : ''}</option>{/each}
          </select>
          {#if !showAddTerminal}
            <button type="button" class="add-link" onclick={() => (showAddTerminal = true)}>+ {translations.current['New terminal'] ?? 'New terminal'}</button>
          {:else}
            <div class="terminal-add-row">
              <input bind:value={newTerminalName} placeholder={translations.current['Terminal name'] ?? 'Terminal name'} />
              <input bind:value={newTerminalCurrency} placeholder="e.g. USD" maxlength="6" />
              <button type="button" class="btn small" onclick={addTerminal}>{translations.current['Add'] ?? 'Add'}</button>
              <button type="button" class="btn small secondary" onclick={() => (showAddTerminal = false)}>{translations.current['Cancel'] ?? 'Cancel'}</button>
            </div>
          {/if}
        </fieldset>
      {:else}
        <button type="button" class="add-link" onclick={() => (showAddTerminal = true)}>+ {translations.current['Add a foreign-currency terminal'] ?? 'Add a foreign-currency terminal'}</button>
      {/if}

      <label class="checkbox-label">
        <input type="checkbox" bind:checked={onAccount} />
        Sell on account (existing customer, no immediate payment)
      </label>
      {#if onAccount}
        <fieldset>
          <legend>{translations.current['Customer'] ?? 'Customer'}</legend>
          <input bind:value={customerName} placeholder={translations.current['Customer name'] ?? 'Customer name'} />
        </fieldset>
      {/if}

      <fieldset>
        <legend>{translations.current['Scan or search a product'] ?? 'Scan or search a product'}</legend>
        <!--
          A real POS terminal, operated by staff standing at a real
          till, must be scan-ready the instant this page loads -
          without autofocus, every real sale would need an extra,
          real click before the very first scan could even register.
          This is a deliberate, real trade-off for this one, specific,
          staff-only screen, not a careless default.
        -->
        <!-- svelte-ignore a11y_autofocus -->
        <input bind:value={productInput} onkeydown={onProductInputKeydown} placeholder="Scan barcode or type a name…" autofocus />
      </fieldset>
      {#if searchResults.length > 0}
        <div class="search-results">
          {#each searchResults as p}
            <button type="button" class="search-hit" onclick={() => addToCart(p)}>{translations.current[p.name] ?? p.name}</button>
          {/each}
        </div>
      {/if}
    </div>

    <div class="card cart-card">
      <h3>{translations.current['Cart'] ?? 'Cart'}</h3>
      {#if cart.length === 0}
        <p class="empty">{translations.current['No items yet'] ?? 'No items yet'} — scan or search to add.</p>
      {:else}
        <table>
          <thead>
            <tr>
              <th>{translations.current['Item'] ?? 'Item'}</th>
              <th class="num">{translations.current['Qty'] ?? 'Qty'}</th>
              <th class="num">{translations.current['Unit price'] ?? 'Unit price'}</th>
              <th class="num">{translations.current['Tax'] ?? 'Tax'}</th>
              <th class="num">{translations.current['Line total'] ?? 'Line total'}</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {#each cart as line (line.id)}
              <tr>
                <td>{line.itemName}</td>
                <td class="num"><input class="qty-input" type="number" min="1" bind:value={line.quantity} /></td>
                <td class="num">
                  <input
                    class="price-input"
                    type="number"
                    min="0"
                    step="0.01"
                    value={((line.unitPriceMinor ?? 0) / 100).toFixed(2)}
                    onchange={(e) => (line.unitPriceMinor = Math.round(Number((e.target as HTMLInputElement).value) * 100))}
                  />
                </td>
                <td class="num">
                  <input
                    class="price-input"
                    type="number"
                    min="0"
                    step="0.01"
                    value={(line.taxMinor / 100).toFixed(2)}
                    onchange={(e) => (line.taxMinor = Math.round(Number((e.target as HTMLInputElement).value) * 100))}
                  />
                </td>
                <td class="num mono">{fmt(line.quantity * (line.unitPriceMinor ?? 0) + line.taxMinor)}</td>
                <td><button class="btn secondary small" onclick={() => removeLine(line.id)}>&times;</button></td>
              </tr>
            {/each}
          </tbody>
        </table>

        <div class="totals">
          <div><span>{translations.current['Subtotal'] ?? 'Subtotal'}</span><span class="mono">{fmt(subtotalMinor)}</span></div>
          <div><span>{translations.current['Tax'] ?? 'Tax'}</span><span class="mono">{fmt(taxMinor)}</span></div>
          <div class="grand-total"><span>{translations.current['Total'] ?? 'Total'}</span><span class="mono">{fmt(totalMinor)}</span></div>
        </div>

        {#if !onAccount}
          <fieldset>
            <legend>{translations.current['Payment method'] ?? 'Payment method'}</legend>
            <select bind:value={paymentMethod}>
              <option value="cash">{translations.current['Cash'] ?? 'Cash'}</option>
              <option value="card">{translations.current['Card'] ?? 'Card'}</option>
            </select>
          </fieldset>
          {#if paymentMethod === 'cash'}
            <fieldset>
              <legend>{translations.current['Cash tendered'] ?? 'Cash tendered'}</legend>
              <input bind:value={cashTendered} inputmode="decimal" placeholder="0.00" />
            </fieldset>
            <p class="change-due">{translations.current['Change due:'] ?? 'Change due:'}<strong>{fmt(changeDueMinor)}</strong></p>
          {/if}
        {/if}

        <button class="btn" onclick={completeSale} disabled={completing || !locationName}>
          {completing ? 'Completing…' : 'Complete Sale'}
        </button>
      {/if}
    </div>
  </div>
{/if}
</fieldset>

<style>
  .add-link {
    background: none;
    border: none;
    color: var(--brass-dark, #8a6d3b);
    text-decoration: underline;
    cursor: pointer;
    padding: 0;
    font-size: var(--font-size-base);
    display: block;
    margin: 0.3rem 0 0.8rem;
  }
  .terminal-add-row {
    display: flex;
    gap: 0.4rem;
    margin-top: 0.4rem;
    flex-wrap: wrap;
  }
  .terminal-add-row input {
    max-width: 8rem;
  }

  .pending-card {
    margin-bottom: 1.2rem;
    padding: 0.8rem 1.1rem;
  }

  .pending-toggle {
    width: 100%;
    text-align: left;
    background: none;
    border: none;
    font-weight: 600;
    font-size: var(--font-size-medium);
    cursor: pointer;
    padding: 0.2rem 0;
    color: var(--ink);
  }

  .pending-actions {
    display: flex;
    gap: 0.4rem;
  }

  .hint {
    color: var(--ink-soft);
    font-size: var(--font-size-small);
    margin: 0.5rem 0 0;
  }

  .pos-layout {
    display: flex;
    gap: 1.5rem;
    align-items: flex-start;
  }

  .setup-card {
    width: 320px;
    flex-shrink: 0;
    padding: 1rem 1.2rem;
    display: flex;
    flex-direction: column;
    gap: 0.8rem;
  }

  .cart-card {
    flex: 1;
    padding: 1rem 1.2rem;
  }

  .checkbox-label {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    font-size: var(--font-size-base);
  }

  .search-results {
    display: flex;
    flex-direction: column;
    gap: 0.2rem;
    border: 1px solid var(--rule);
    border-radius: 6px;
    padding: 0.3rem;
  }

  .search-hit {
    text-align: left;
    background: none;
    border: none;
    padding: 0.35rem 0.5rem;
    border-radius: 4px;
    cursor: pointer;
    font-size: var(--font-size-base);
  }

  .search-hit:hover {
    background: var(--paper-dim);
  }

  .empty {
    color: var(--ink-soft);
  }

  .qty-input {
    width: 55px;
  }

  .price-input {
    width: 75px;
  }

  .totals {
    margin-top: 1rem;
    display: flex;
    flex-direction: column;
    gap: 0.3rem;
    max-width: 260px;
    margin-left: auto;
  }

  .totals div {
    display: flex;
    justify-content: space-between;
    font-size: var(--font-size-medium);
  }

  .grand-total {
    font-weight: 600;
    border-top: 1px solid var(--rule-strong);
    padding-top: 0.3rem;
    font-size: var(--font-size-large) !important;
  }

  .change-due {
    font-size: var(--font-size-medium);
    text-align: right;
  }

  .btn.small {
    padding: 0.15rem 0.5rem;
    font-size: var(--font-size-base);
  }

  .receipt {
    max-width: 420px;
    margin: 0 auto;
    padding: 1.5rem 1.8rem;
    text-align: center;
  }

  .receipt-total {
    font-size: var(--font-size-large);
    font-weight: 600;
  }

  .receipt-change {
    font-size: var(--font-size-large);
    color: var(--credit);
  }

  .receipt-actions {
    display: flex;
    gap: 0.8rem;
    justify-content: center;
    margin-top: 1rem;
  }

  @media print {
    .no-print-controls .receipt-actions {
      display: none;
    }
  }
</style>
