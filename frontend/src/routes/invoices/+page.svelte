<script lang="ts">
  import { auth } from '$lib/state.svelte';
  import { formatAmount } from '$lib/format';
  import { onMount } from 'svelte';
  import { page } from '$app/stores';
  import { session } from '$lib/state.svelte';
  import {
    getEntityTree,
    listInvoices,
    createInvoice,
    getInvoiceById,
    postInvoiceById,
    getInvoiceOutstanding,
    allocatePaymentToInvoice,
    exportInvoiceAsEInvoice,
    importEInvoice,
    ApiError,
    type EntityNode,
    type Invoice,
    type InvoiceLine,
    type ImportEInvoiceResult,
    asVendorName,
  } from '$lib/api';
  import { translations } from '$lib/state.svelte';

  let entities: EntityNode[] = $state([]);
  let invoices: Invoice[] = $state([]);
  let totalCount = $state(0);
  let pageIndex = $state(0);
  const pageSize = 50;
  let sourceFilter: 'manual' | 'pos' | 'all' = $state('manual');
  let loading = $state(true);
  let error = $state('');
  let message = $state('');
  let invoiceTypeFilter: 'AR' | 'AP' = $state('AR');

  let selected: Invoice | null = $state(null);
  let outstandingMinor: number | null = $state(null);

  // New invoice form
  let showNewForm = $state(false);
  let newDocumentType: 'invoice' | 'credit_note' | 'debit_memo' = $state('invoice');
  let newReference = $state('');
  let newCounterparty = $state('');
  let newDate = $state('');
  let newDescription = $state('');
  let newReferencesInvoiceId: number | null = $state(null);
  let newLines: InvoiceLine[] = $state([{ description: '', amountMinor: 0, taxMinor: 0 }]);
  let creating = $state(false);

  // Posting form
  let revenueOrExpenseAccount = $state('');
  let taxAccount = $state('');
  let restockInventory = $state(false);
  let posting = $state(false);

  // Allocation form
  let allocPaymentReference = $state('');
  let allocAmount = $state('');
  let allocDate = $state('');
  let allocPaymentAccount = $state('Cash and Bank');
  let allocating = $state(false);
  let exportingEInvoice = $state(false);

  // Import e-invoice form state
  let showImportForm = $state(false);
  let importPreviewXml = $state('');
  let importVendor = $state('');
  let importPoReference = $state('');
  let importing = $state(false);
  let importResult: ImportEInvoiceResult | null = $state(null);

  async function loadAll() {
    if (!session.current) return;
    loading = true;
    try {
      const [entityTree, invoiceResult] = await Promise.all([
        getEntityTree(),
        listInvoices(session.current.businessName, session.current.ledgerName, invoiceTypeFilter, sourceFilter, pageSize, pageIndex * pageSize),
      ]);
      entities = entityTree;
      invoices = invoiceResult.rows;
      totalCount = invoiceResult.totalCount;
    } catch (e) {
      error = e instanceof ApiError ? e.message : 'Failed to load.';
    } finally {
      loading = false;
    }
  }

  function changeFilter() {
    pageIndex = 0;
    loadAll();
  }

  onMount(() => {
    const t = $page.url.searchParams.get('type');
    if (t === 'AP') invoiceTypeFilter = 'AP';
    loadAll();
  });

  let customers = $derived(entities.filter((e) => entities.find((p) => p.id === e.parent_id)?.name === 'Accounts Receivable'));
  let vendors = $derived(entities.filter((e) => entities.find((p) => p.id === e.parent_id)?.name === 'Accounts Payable'));
  let counterpartyOptions = $derived(invoiceTypeFilter === 'AR' ? customers : vendors);
  let postedInvoicesForCredit = $derived(invoices.filter((i) => i.status === 'posted' && i.document_type === 'invoice'));

  async function selectInvoice(id: number) {
    error = '';
    message = '';
    try {
      selected = await getInvoiceById(id);
      outstandingMinor = selected.status === 'posted' ? (await getInvoiceOutstanding(id)).outstanding_minor : null;
      revenueOrExpenseAccount = '';
      taxAccount = '';
      restockInventory = false;
      allocPaymentReference = '';
      allocAmount = '';
      allocDate = '';
      allocPaymentAccount = 'Cash and Bank';
    } catch (e) {
      error = e instanceof ApiError ? e.message : 'Could not load invoice.';
    }
  }

  function addLine() {
    newLines = [...newLines, { description: '', amountMinor: 0, taxMinor: 0 }];
  }
  function removeLine(i: number) {
    newLines = newLines.filter((_, idx) => idx !== i);
  }

  function startNew(documentType: 'invoice' | 'credit_note' | 'debit_memo') {
    showNewForm = true;
    newDocumentType = documentType;
    newReference = '';
    newCounterparty = '';
    newDate = '';
    newDescription = '';
    newReferencesInvoiceId = null;
    newLines = [{ description: '', amountMinor: 0, taxMinor: 0 }];
    selected = null;
  }

  async function submitNew() {
    if (!session.current) return;
    creating = true;
    error = '';
    try {
      const { id } = await createInvoice({
        invoiceType: invoiceTypeFilter,
        documentType: newDocumentType,
        referencesInvoiceId: newReferencesInvoiceId,
        business: session.current.businessName,
        ledger: session.current.ledgerName,
        reference: newReference,
        counterpartyName: newCounterparty,
        invoiceDate: newDate,
        description: newDescription,
        lines: newLines
          .filter((l) => l.description)
          .map((l) => ({
            description: l.description,
            quantity: l.quantity ? Number(l.quantity) : null,
            unitPriceMinor: l.unitPriceMinor ? Math.round(Math.abs(Number(l.unitPriceMinor)) * 100) : null,
            amountMinor: Math.round(Math.abs(Number(l.amountMinor))),
            taxMinor: l.taxMinor ? Math.round(Math.abs(Number(l.taxMinor))) : 0,
          })),
      });
      showNewForm = false;
      await loadAll();
      await selectInvoice(id);
      message = 'Created.';
    } catch (e) {
      error = e instanceof ApiError ? e.message : 'Could not create.';
    } finally {
      creating = false;
    }
  }

  async function submitPost() {
    if (!selected) return;
    posting = true;
    error = '';
    try {
      await postInvoiceById(selected.id, revenueOrExpenseAccount, taxAccount, restockInventory);
      await loadAll();
      await selectInvoice(selected.id);
      message = 'Posted.';
    } catch (e) {
      error = e instanceof ApiError ? e.message : 'Could not post.';
    } finally {
      posting = false;
    }
  }

  async function submitAllocation() {
    if (!selected) return;
    allocating = true;
    error = '';
    try {
      await allocatePaymentToInvoice(selected.id, allocPaymentReference, Math.round(Math.abs(Number(allocAmount)) * 100), allocDate, allocPaymentAccount);
      await selectInvoice(selected.id);
      message = 'Allocated.';
    } catch (e) {
      error = e instanceof ApiError ? e.message : 'Could not allocate.';
    } finally {
      allocating = false;
    }
  }

  async function downloadEInvoice() {
    if (!selected) return;
    exportingEInvoice = true;
    error = '';
    try {
      const xml = await exportInvoiceAsEInvoice(selected.id);
      const blob = new Blob([xml], { type: 'application/xml' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `invoice-${selected.reference}.xml`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      error = e instanceof ApiError ? e.message : 'Could not export this invoice as a real e-invoice.';
    } finally {
      exportingEInvoice = false;
    }
  }

  function onImportFileChange(e: Event) {
    const input = e.currentTarget as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) {
      importPreviewXml = '';
      return;
    }
    importResult = null;
    error = '';
    const reader = new FileReader();
    reader.onload = () => {
      importPreviewXml = typeof reader.result === 'string' ? reader.result : '';
    };
    reader.onerror = () => {
      error = 'Could not read this file.';
      importPreviewXml = '';
    };
    reader.readAsText(file);
  }

  async function submitImport() {
    if (!session.current || !importPreviewXml || !importVendor) return;
    importing = true;
    error = '';
    try {
      importResult = await importEInvoice(importPreviewXml, session.current.businessName, session.current.ledgerName, asVendorName(importVendor), importPoReference || undefined);
      await loadAll();
    } catch (e) {
      error = e instanceof ApiError ? e.message : 'Could not import this e-invoice.';
    } finally {
      importing = false;
    }
  }

  const fmt = (c: number) => formatAmount(c, auth.current?.user.number_format ?? '1 000.00');
</script>

<svelte:head><title>{translations.current['Invoices'] ?? 'Invoices'}</title></svelte:head>

<fieldset class="page-title">
  <legend>{invoiceTypeFilter === 'AR' ? 'Sales Invoices' : 'Purchase Invoices'}</legend>
  <p class="intro">
    {invoiceTypeFilter === 'AR'
      ? (translations.current['The real billing event — this is what creates AR and recognizes revenue, distinct from a Dispatch Note/Goods Receipt which only moves stock. Credit Notes and Debit Memos use the same mechanism in reverse.'] ?? 'The real billing event — this is what creates AR and recognizes revenue, distinct from a Dispatch Note/Goods Receipt which only moves stock. Credit Notes and Debit Memos use the same mechanism in reverse.')
      : (translations.current['The real billing event — this is what creates AP and recognizes expense, distinct from a Dispatch Note/Goods Receipt which only moves stock. Credit Notes and Debit Memos use the same mechanism in reverse.'] ?? 'The real billing event — this is what creates AP and recognizes expense, distinct from a Dispatch Note/Goods Receipt which only moves stock. Credit Notes and Debit Memos use the same mechanism in reverse.')}
  </p>

  <div class="type-toggle">
    <button class="btn secondary" class:active={invoiceTypeFilter === 'AR'} onclick={() => { invoiceTypeFilter = 'AR'; selected = null; changeFilter(); }}>{translations.current['AR (Sales)'] ?? 'AR (Sales)'}</button>
    <button class="btn secondary" class:active={invoiceTypeFilter === 'AP'} onclick={() => { invoiceTypeFilter = 'AP'; selected = null; changeFilter(); }}>{translations.current['AP (Purchases)'] ?? 'AP (Purchases)'}</button>
  </div>

  <fieldset class="source-filter">
    <legend>{translations.current['Show'] ?? 'Show'}</legend>
    <select bind:value={sourceFilter} onchange={changeFilter}>
      <option value="manual">{translations.current['Account invoices only'] ?? 'Account invoices only'}</option>
      <option value="pos">{translations.current['POS sales only'] ?? 'POS sales only'}</option>
      <option value="all">{translations.current['Everything'] ?? 'Everything'}</option>
    </select>
  </fieldset>

{#if loading}
  <p>Loading…</p>
{:else}
  {#if error}<p class="error">{error}</p>{/if}
  {#if message}<p class="success">{message}</p>{/if}

  <div class="layout">
    <div class="card list-card">
      <h3>{translations.current['Journal Entries'] ?? 'Invoices'}</h3>
      {#if invoices.length === 0}
        <p class="empty">{translations.current['None yet.'] ?? 'None yet.'}</p>
      {/if}
      {#each invoices as inv}
        <button type="button" class="entry" class:active={selected?.id === inv.id} onclick={() => selectInvoice(inv.id)}>
          <span class="ref">{inv.reference}</span>
          <span class="dim">{inv.counterparty} · {inv.status}{inv.document_type !== 'invoice' ? ` · ${inv.document_type}` : ''}</span>
        </button>
      {/each}
      {#if totalCount > pageSize}
        <div class="pagination">
          <button class="btn secondary" disabled={pageIndex === 0} onclick={() => { pageIndex -= 1; loadAll(); }}>{translations.current['Prev'] ?? 'Prev'}</button>
          <span class="page-summary">{pageIndex * pageSize + 1}–{Math.min((pageIndex + 1) * pageSize, totalCount)} of {totalCount}</span>
          <button class="btn secondary" disabled={(pageIndex + 1) * pageSize >= totalCount} onclick={() => { pageIndex += 1; loadAll(); }}>{translations.current['Next'] ?? 'Next'}</button>
        </div>
      {/if}
      <div class="new-buttons">
        <button class="btn" onclick={() => startNew('invoice')}>+ New Invoice</button>
        <button class="btn secondary" onclick={() => startNew('credit_note')}>+ {invoiceTypeFilter === 'AR' ? 'Credit Note' : 'Debit Memo'}</button>
        {#if invoiceTypeFilter === 'AP'}
          <button class="btn secondary" onclick={() => (showImportForm = !showImportForm)}>{translations.current['Import e-invoice'] ?? 'Import e-invoice'}</button>
        {/if}
      </div>
    </div>

    {#if showImportForm}
      <div class="card form-card">
        <h3>{translations.current['Import e-invoice (UBL 2.1)'] ?? 'Import e-invoice (UBL 2.1)'}</h3>
        <p class="hint">
          A real, incoming UBL 2.1 e-invoice — lands as a real, draft Purchase Invoice, never auto-posted. If a real
          Purchase Order reference is given, a real 3-way match checks the incoming invoice against it and flags any
          genuine discrepancy directly in the draft's own description, so it's impossible to miss before you post it.
        </p>
        <fieldset>
          <legend>{translations.current['XML file'] ?? 'XML file'}</legend>
          <input type="file" accept=".xml,application/xml,text/xml" onchange={onImportFileChange} />
        </fieldset>
        <div class="row-2">
          <fieldset>
            <legend>{translations.current['Vendor'] ?? 'Vendor'}</legend>
            <select bind:value={importVendor}>
              <option value="">Select vendor…</option>
              {#each vendors as v}<option value={translations.current[v.name] ?? v.name}>{translations.current[v.name] ?? v.name}</option>{/each}
            </select>
          </fieldset>
          <fieldset>
            <legend>{translations.current['Matching PO reference (optional)'] ?? 'Matching PO reference (optional)'}</legend>
            <input bind:value={importPoReference} placeholder="e.g. PO-4-Warehouse-2-PO" />
          </fieldset>
        </div>
        {#if importPreviewXml}
          <p class="hint">Real file loaded ({importPreviewXml.length.toLocaleString()} characters) — ready to import.</p>
        {/if}
        {#if importResult}
          <div class="import-result" class:has-discrepancies={importResult.discrepancies.length > 0}>
            {#if importResult.discrepancies.length === 0}
              <p><strong>{translations.current['Imported successfully'] ?? 'Imported successfully'}</strong> — a real, new draft invoice was created, no discrepancies found.</p>
            {:else}
              <p><strong>{translations.current['Imported with discrepancies'] ?? 'Imported with discrepancies'}</strong> — review before posting:</p>
              <ul>
                {#each importResult.discrepancies as d}
                  <li>{d.field}: PO says {d.poValue}, invoice says {d.invoiceValue}</li>
                {/each}
              </ul>
            {/if}
            <button class="btn secondary" onclick={() => importResult && selectInvoice(importResult.invoiceId)}>{translations.current['Review the draft'] ?? 'Review the draft'}</button>
          </div>
        {/if}
        <button class="btn" onclick={submitImport} disabled={importing || !importPreviewXml || !importVendor}>
          {importing ? 'Importing…' : (translations.current['Import'] ?? 'Import')}
        </button>
        <button class="btn secondary" onclick={() => (showImportForm = false)}>{translations.current['Cancel'] ?? 'Cancel'}</button>
      </div>
    {/if}

    {#if showNewForm}
      <div class="card form-card">
        <h3>New {newDocumentType === 'invoice' ? (invoiceTypeFilter === 'AR' ? 'Sales Invoice' : 'Purchase Invoice') : invoiceTypeFilter === 'AR' ? 'Credit Note' : 'Debit Memo'}</h3>
        <div class="row-2">
          <fieldset>
            <legend>{translations.current['Reference'] ?? 'Reference'}</legend>
            <input bind:value={newReference} placeholder="e.g. INV-1001" />
          </fieldset>
          <fieldset>
            <legend>{translations.current['Date'] ?? 'Date'}</legend>
            <input type="date" bind:value={newDate} />
          </fieldset>
        </div>
        <fieldset>
          <legend>{invoiceTypeFilter === 'AR' ? 'Customer' : 'Vendor'}</legend>
          <select bind:value={newCounterparty}>
            <option value="">Select…</option>
            {#each counterpartyOptions as c}<option value={translations.current[c.name] ?? c.name}>{translations.current[c.name] ?? c.name}</option>{/each}
          </select>
        </fieldset>
        {#if newDocumentType !== 'invoice'}
          <fieldset>
            <legend>{translations.current['Referencing which invoice'] ?? 'Referencing which invoice'}</legend>
            <select bind:value={newReferencesInvoiceId}>
              <option value={null}>(none)</option>
              {#each postedInvoicesForCredit as inv}<option value={inv.id}>{inv.reference} — {inv.counterparty}</option>{/each}
            </select>
          </fieldset>
        {/if}
        <fieldset>
          <legend>{translations.current['Description'] ?? 'Description'}</legend>
          <input bind:value={newDescription} placeholder="optional" />
        </fieldset>

        <h4>{translations.current['Lines'] ?? 'Lines'}</h4>
        {#each newLines as line, i}
          <div class="line-row">
            <input bind:value={line.description} placeholder={translations.current['Description'] ?? 'Description'} class="line-desc" />
            <input bind:value={line.quantity} placeholder={translations.current['Qty'] ?? 'Qty'} inputmode="numeric" class="line-num" />
            <input bind:value={line.unitPriceMinor} placeholder={translations.current['Unit price'] ?? 'Unit price'} inputmode="decimal" class="line-num" />
            <input bind:value={line.amountMinor} placeholder={translations.current['Amount (minor units)'] ?? 'Amount (minor units)'} inputmode="numeric" class="line-num" />
            <input bind:value={line.taxMinor} placeholder={translations.current['Tax (minor units)'] ?? 'Tax (minor units)'} inputmode="numeric" class="line-num" />
            <button type="button" class="remove" onclick={() => removeLine(i)}>✕</button>
          </div>
        {/each}
        <button type="button" class="btn secondary add-line" onclick={addLine}>+ Add line</button>

        <div class="button-row">
          <button class="btn" onclick={submitNew} disabled={creating}>{creating ? 'Saving…' : 'Save draft'}</button>
          <button class="btn secondary" onclick={() => (showNewForm = false)}>{translations.current['Cancel'] ?? 'Cancel'}</button>
        </div>
      </div>
    {:else if selected}
      <div class="card form-card">
        <h3>{selected.reference}</h3>
        <p class="dim">
          {selected.counterparty} · {selected.invoice_date}{selected.due_date ? ` · due ${selected.due_date}` : ''} · {selected.status}
        </p>
        {#if selected.description}<p>{selected.description}</p>{/if}

        <table class="lines-table">
          <thead>
            <tr>
              <th>{translations.current['Description'] ?? 'Description'}</th>
              <th class="num">{translations.current['Qty'] ?? 'Qty'}</th>
              <th class="num">{translations.current['Unit price'] ?? 'Unit price'}</th>
              <th class="num">{translations.current['Amount'] ?? 'Amount'}</th>
              <th class="num">{translations.current['Tax'] ?? 'Tax'}</th>
            </tr>
          </thead>
          <tbody>
            {#each selected.lines as line}
              <tr>
                <td>{line.description}</td>
                <td class="num">{line.quantity ?? ''}</td>
                <td class="num">{line.unitPriceMinor != null ? fmt(line.unitPriceMinor) : ''}</td>
                <td class="num">{fmt(line.amountMinor)}</td>
                <td class="num">{fmt(line.taxMinor ?? 0)}</td>
              </tr>
            {/each}
          </tbody>
          <tfoot>
            <tr>
              <td colspan="3"><strong>{translations.current['Total'] ?? 'Total'}</strong></td>
              <td class="num"><strong>{fmt(selected.total_amount_minor)}</strong></td>
              <td class="num"><strong>{fmt(selected.total_tax_minor)}</strong></td>
            </tr>
          </tfoot>
        </table>

        {#if selected.status === 'draft'}
          <h4>{translations.current['Post to the ledger'] ?? 'Post to the ledger'}</h4>
          <div class="row-2">
            <fieldset>
              <legend>{invoiceTypeFilter === 'AR' ? 'Revenue account' : 'Expense account'}</legend>
              <input bind:value={revenueOrExpenseAccount} placeholder="e.g. Sales Revenue" />
            </fieldset>
            <fieldset>
              <legend>{translations.current['Tax account'] ?? 'Tax account'}</legend>
              <input bind:value={taxAccount} placeholder="e.g. Sales Tax Payable" />
            </fieldset>
          </div>
          {#if selected.document_type !== 'invoice'}
            <label class="checkbox-label">
              <input type="checkbox" bind:checked={restockInventory} />
              Restock inventory (goods were physically returned)
            </label>
          {/if}
          <button class="btn" onclick={submitPost} disabled={posting}>{posting ? 'Posting…' : 'Post'}</button>
        {:else if selected.status === 'posted' && outstandingMinor != null}
          <p class="outstanding">{translations.current['Outstanding:'] ?? 'Outstanding:'}<strong>{fmt(outstandingMinor)}</strong></p>
          <button class="btn secondary e-invoice-btn" onclick={downloadEInvoice} disabled={exportingEInvoice}>
            {exportingEInvoice ? 'Preparing…' : (translations.current['Export as e-invoice (UBL 2.1)'] ?? 'Export as e-invoice (UBL 2.1)')}
          </button>
          {#if outstandingMinor > 0}
            <h4>{translations.current['Allocate a payment'] ?? 'Allocate a payment'}</h4>
            <div class="row-2">
              <fieldset>
                <legend>{translations.current['Payment reference'] ?? 'Payment reference'}</legend>
                <input bind:value={allocPaymentReference} placeholder="e.g. RCPT-1001" />
              </fieldset>
              <fieldset>
                <legend>{translations.current['Date'] ?? 'Date'}</legend>
                <input type="date" bind:value={allocDate} />
              </fieldset>
            </div>
            <fieldset>
              <legend>{translations.current['Amount'] ?? 'Amount'}</legend>
              <input bind:value={allocAmount} placeholder="0.00" inputmode="decimal" />
            </fieldset>
            <fieldset>
              <legend>{translations.current['Paid into'] ?? 'Paid into'}</legend>
              <input bind:value={allocPaymentAccount} placeholder={translations.current['Cash and Bank'] ?? 'Cash and Bank'} />
            </fieldset>
            <button class="btn" onclick={submitAllocation} disabled={allocating}>{allocating ? 'Allocating…' : 'Allocate'}</button>
          {/if}
        {/if}
      </div>
    {/if}
  </div>
{/if}
</fieldset>

<style>
  .intro {
    max-width: 70ch;
  }
  .type-toggle {
    display: flex;
    justify-content: center;
    gap: 0.6rem;
    margin-bottom: 1.2rem;
  }
  .source-filter {
    display: flex;
    justify-content: center;
    align-items: center;
    margin-bottom: 1.2rem;
  }
  .pagination {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.7rem;
    padding: 0.6rem 0;
    font-size: var(--font-size-base);
  }
  .page-summary {
    color: var(--ink-soft);
  }
  .type-toggle .active {
    background: var(--brass);
    color: white;
    border-color: var(--brass);
  }
  .layout {
    display: flex;
    gap: 1.5rem;
    align-items: flex-start;
  }
  .list-card {
    width: 280px;
    flex-shrink: 0;
    padding: 0.9rem 1rem;
  }
  .list-card h3 {
    margin: 0 0 0.6rem;
    font-size: var(--font-size-medium);
  }
  .empty {
    color: var(--ink-soft);
    font-size: var(--font-size-base);
    margin: 0;
  }
  .entry {
    display: flex;
    flex-direction: column;
    width: 100%;
    text-align: left;
    background: none;
    border: none;
    padding: 0.4rem 0.5rem;
    border-radius: 4px;
    cursor: pointer;
    margin-bottom: 0.15rem;
  }
  .entry:hover {
    background: var(--paper-dim, #f2ede1);
  }
  .entry.active {
    background: var(--paper-dim, #f2ede1);
    border-left: 3px solid var(--brass);
  }
  .ref {
    font-weight: 600;
    font-size: var(--font-size-base);
  }
  .dim {
    font-size: var(--font-size-small);
    color: var(--ink-soft);
  }
  .new-buttons {
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
    margin-top: 0.8rem;
  }
  .form-card {
    flex: 1;
    max-width: 640px;
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
  .line-row {
    display: flex;
    gap: 0.4rem;
    align-items: center;
  }
  .line-desc {
    flex: 2;
  }
  .line-num {
    flex: 1;
    min-width: 0;
  }
  .remove {
    background: none;
    border: none;
    color: var(--debit, #b1442e);
    cursor: pointer;
  }
  .add-line {
    align-self: flex-start;
  }
  .button-row {
    display: flex;
    gap: 0.6rem;
    justify-content: center;
  }
  .lines-table th,
  .lines-table td {
    padding: 0.3rem 0.5rem;
    border-bottom: 1px solid var(--rule);
  }
  .lines-table tfoot td {
    border-top: 2px solid var(--rule-strong);
    border-bottom: none;
  }
  .outstanding {
    font-size: var(--font-size-medium);
    color: var(--debit);
  }
  .e-invoice-btn {
    margin-bottom: 0.8rem;
  }
  .hint {
    font-size: var(--font-size-small);
    color: var(--ink-soft);
    max-width: 60ch;
  }
  .import-result {
    padding: 0.6rem 0.8rem;
    border-radius: 6px;
    background: #eaf5ea;
    color: #2a5c2a;
    margin: 0.6rem 0;
  }
  .import-result.has-discrepancies {
    background: #fdecea;
    color: #a33a2e;
  }
  .import-result ul {
    margin: 0.3rem 0;
    padding-left: 1.2rem;
  }
  .checkbox-label {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    font-size: var(--font-size-base);
  }
  .success {
    color: var(--credit);
  }
</style>
