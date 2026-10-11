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
    resolveCashTransactionAccounts,
    resolveSaleAccounts,
    receiveStock,
    dispatchStock,
    stageLine,
    postJournalEntry,
    asBusinessName,
    asLedgerName,
    asLocationName,
    asAccountName,
    asItemName,
    ApiError,
    type LocationRecord,
    type EntityNode,
    type ItemSummary,
  } from '$lib/api';
  import { cashPurchaseLines, posSaleLines, freshReference } from '$lib/canned-journal';

  let { direction }: { direction: 'purchase' | 'sale' } = $props();

  // direction is genuinely static for this component's whole real
  // lifetime - set once, directly, by the one, real, separate route
  // file that renders it (<CashTransaction direction="purchase" />),
  // never reassigned afterward. A plain const is the correct, real
  // choice here, not a missed $derived.
  // svelte-ignore state_referenced_locally
  const isPurchase = direction === 'purchase';
  const partyLabel = isPurchase ? 'Vendor' : 'Customer';
  // Real, confirmed bug (found while diagnosing why a real, just-created
  // customer never appeared in this real Cash Sale screen's own party
  // list): backend's own createProvider parents a new real provider
  // directly under the real 'Accounts Payable' CoA account (confirmed
  // directly - Highland Brewing Co's own real parent_id resolves to that
  // real account), so 'Accounts Payable' here is correct and matches.
  // backend's own createCustomer, by contrast, parents a new real
  // customer under 'Customers' - a real, structural Vocabulary category,
  // never the real 'Accounts Receivable' CoA account - confirmed
  // directly the same way. The real string here was simply the wrong
  // one for the sale side; 'Customers' is the one that actually matches
  // where createCustomer puts a real customer.
  const partyParentEntity = isPurchase ? 'Accounts Payable' : 'Customers';
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
      // A real, confirmed bug, found directly: the auto-added,
      // trailing blank line (the exact, same, real convention this
      // component's own addLine/$effect above already documents)
      // must never actually be sent - genuinely filtered out here,
      // not just visually blank, since the real, live backend schema
      // correctly rejects an empty itemName, and submitting it
      // silently failed every real purchase/sale that reached this
      // point with a real, unfilled line still present.
      const commonLines = lines.filter((l) => l.itemName.trim()).map(({ key, ...l }) => ({ ...l, itemName: asItemName(l.itemName) }));
      if (isPurchase) {
        // Per docs/canned-journal-to-frontend-design.md Phase 0: the
        // canned account selection (which account, how much) is now
        // computed here, client-side, by the one, shared
        // cashPurchaseLines function — the backend is only asked to
        // resolve/create the real Inventory accounts (a real, stateful
        // side effect) and to receive the physical stock; the actual
        // posting goes through the exact, same, generic journal
        // staging+post calls the General Journal screen's own "Save"
        // button uses.
        const purchaseLines = commonLines.map((l) => ({ ...l, itemName: l.itemName as string }));
        const resolved = await resolveCashTransactionAccounts({
          business: asBusinessName(business),
          locationName: asLocationName(locationName),
          items: purchaseLines.map((l) => ({ itemName: l.itemName })),
          wantCashAccount: !!paymentMethod,
        });
        if (!resolved.cashAccount) throw new Error('No payment account resolved for this purchase.');
        const reference = freshReference('CASHPUR');
        const builtLines = cashPurchaseLines({
          lines: purchaseLines,
          inventoryAccounts: resolved.inventoryAccounts,
          taxAccount,
          cashAccount: resolved.cashAccount,
        });
        for (const line of builtLines) {
          await stageLine({
            reference,
            business: asBusinessName(business),
            ledger: asLedgerName(ledger),
            transdate,
            account: asAccountName(line.account),
            amount_minor: line.amount_minor,
          }, 'Cash Purchase');
        }
        await postJournalEntry(reference, asBusinessName(business), asLedgerName(ledger), 'Cash Purchase');
        await receiveStock({
          business: asBusinessName(business),
          ledger: asLedgerName(ledger),
          reference,
          locationName: asLocationName(locationName),
          lines: purchaseLines.map((l) => ({ itemName: l.itemName, quantity: l.quantity })),
          transdate,
        }, 'Cash Purchase');
        const totalMinor = purchaseLines.reduce((s, l) => s + l.quantity * l.unitPriceMinor + l.taxMinor, 0);
        result = { invoiceId: 0, reference, totalMinor };
      } else {
        // Per docs/canned-journal-to-frontend-design.md Phase 1: the
        // exact, same real pattern as the purchase branch above,
        // mirrored for the sale side — the canned account selection
        // moves client-side (posSaleLines), the backend is only asked
        // to resolve/create the real Sales/COGS/Inventory accounts
        // (plus each item's own, real, known per-unit cost) and to
        // dispatch the real, physical stock. Per the real precedent
        // already established and committed for Cash Purchase: a real,
        // immediate-cash sale creates no genuine invoice/receivable
        // record at all, just a direct journal posting plus the real,
        // physical stock side effect.
        const saleLines = commonLines.map((l) => ({ ...l, itemName: l.itemName as string }));
        const resolved = await resolveSaleAccounts({
          business: asBusinessName(business),
          locationName: asLocationName(locationName),
          items: saleLines.map((l) => ({ itemName: l.itemName })),
          wantCashAccount: !!paymentMethod,
        });
        if (!resolved.cashAccount) throw new Error('No payment account resolved for this sale.');
        const reference = freshReference('CASHSALE');
        const built = posSaleLines({
          lines: saleLines,
          salesAccounts: resolved.salesAccounts,
          cogsAccounts: resolved.cogsAccounts,
          inventoryAccounts: resolved.inventoryAccounts,
          unitCostMinor: resolved.unitCostMinor,
          taxAccount,
          cashAccount: resolved.cashAccount,
        });
        // Dispatched first, deliberately, before anything is staged or
        // posted: dispatchStock is the one, real step genuinely likely
        // to fail (not enough real stock on hand) — a failed dispatch
        // must never leave a real, posted journal entry behind for
        // stock that was never actually sent out.
        await dispatchStock({
          business: asBusinessName(business),
          ledger: asLedgerName(ledger),
          reference,
          locationName: asLocationName(locationName),
          lines: saleLines.map((l) => ({ itemName: l.itemName, quantity: l.quantity })),
          transdate,
        }, 'Cash Sale');
        for (const line of built.lines) {
          await stageLine({
            reference,
            business: asBusinessName(business),
            ledger: asLedgerName(ledger),
            transdate,
            account: asAccountName(line.account),
            amount_minor: line.amount_minor,
          }, 'Cash Sale');
        }
        await postJournalEntry(reference, asBusinessName(business), asLedgerName(ledger), 'Cash Sale');
        if (built.cogsLines.length > 0) {
          const cogsReference = `${reference}-COGS`;
          for (const line of built.cogsLines) {
            await stageLine({
              reference: cogsReference,
              business: asBusinessName(business),
              ledger: asLedgerName(ledger),
              transdate,
              account: asAccountName(line.account),
              amount_minor: line.amount_minor,
            }, 'Cash Sale');
          }
          await postJournalEntry(cogsReference, asBusinessName(business), asLedgerName(ledger), 'Cash Sale');
        }
        const totalMinor = saleLines.reduce((s, l) => s + l.quantity * l.unitPriceMinor + l.taxMinor, 0);
        result = { invoiceId: 0, reference, totalMinor };
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
