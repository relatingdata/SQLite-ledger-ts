<script lang="ts">
  import { auth } from '$lib/state.svelte';
  import { formatAmount, todayIsoDate } from '$lib/format';
  import { onMount } from 'svelte';
  import { session } from '$lib/state.svelte';
  import { getEntityTree, getCustomerStatement, ApiError, type EntityNode, type CustomerStatement } from '$lib/api';
  import { translations } from '$lib/state.svelte';

  let entities: EntityNode[] = [];
  let customers: string[] = [];
  let selectedCustomer = '';
  let asOfDate = todayIsoDate();
  let statement: CustomerStatement | null = null;
  let loading = true;
  let error = '';

  async function loadCustomers() {
    entities = await getEntityTree();
    const byId = new Map(entities.map((e) => [e.id, e]));
    customers = entities
      .filter((e) => byId.get(e.parent_id ?? -1)?.name === 'Accounts Receivable')
      .map((e) => e.name)
      .sort((a, b) => a.localeCompare(b));
  }

  // A real, genuine race is possible here: loadCustomers() fetches
  // the full, real entity tree, which can genuinely take a moment on
  // a real, populated business — long enough that a real person could
  // already change the customer or date before it resolves. Without
  // a guard, that slower, earlier request's own result would land
  // last and silently overwrite the person's real, later choice. This
  // is the standard, real fix: each call captures its own id, and
  // only ever applies its own result if it's still the most recent
  // request by the time it actually completes.
  let latestRequestId = 0;
  async function load() {
    if (!session.current || !selectedCustomer) return;
    const requestId = ++latestRequestId;
    loading = true;
    error = '';
    try {
      const result = await getCustomerStatement(session.current.businessName, session.current.ledgerName, selectedCustomer, asOfDate || undefined);
      if (requestId !== latestRequestId) return;
      statement = result;
    } catch (e) {
      if (requestId !== latestRequestId) return;
      error = e instanceof ApiError ? e.message : 'Failed to load.';
    } finally {
      if (requestId === latestRequestId) loading = false;
    }
  }

  onMount(async () => {
    loading = true;
    try {
      await loadCustomers();
      if (customers.length > 0 && !selectedCustomer) {
        selectedCustomer = customers[0];
        await load();
      }
    } finally {
      loading = false;
    }
  });

  function printStatement() {
    window.print();
  }

  const fmt = (c: number) => formatAmount(c, auth.current?.user.number_format ?? '1 000.00');
</script>

<svelte:head><title>{translations.current['Customer Statement'] ?? 'Customer Statement'}</title></svelte:head>

<fieldset class="page-title no-print">
  <legend>{translations.current['Customer Statement'] ?? 'Customer Statement'}</legend>
  <p class="intro">
    {translations.current['Every real, posted invoice for one customer as of a date — paid, partially paid, and still outstanding — not just the unpaid subset the Aged Receivables report shows. A real, printable document a customer could actually be handed or sent.'] ?? 'Every real, posted invoice for one customer as of a date — paid, partially paid, and still outstanding — not just the unpaid subset the Aged Receivables report shows. A real, printable document a customer could actually be handed or sent.'}
  </p>

<div class="controls no-print">
  <fieldset>
    <legend>{translations.current['Customer'] ?? 'Customer'}</legend>
    <select bind:value={selectedCustomer} onchange={load}>
      {#each customers as c}<option value={c}>{c}</option>{/each}
    </select>
  </fieldset>
  <fieldset>
    <legend>{translations.current['As of date'] ?? 'As of date'}</legend>
    <input type="date" bind:value={asOfDate} onchange={load} />
  </fieldset>
  <button class="btn" onclick={printStatement} disabled={!statement}>{translations.current['Print'] ?? 'Print'}</button>
</div>

{#if loading}
  <p class="no-print">Loading…</p>
{:else if error}
  <p class="error no-print">{error}</p>
{:else if statement}
  <div class="statement-sheet">
    <div class="statement-header">
      <div>
        <h3>{translations.current['Statement of Account'] ?? 'Statement of Account'}</h3>
        <p class="business-line">{session.current?.businessName ?? ''}</p>
      </div>
      <div class="statement-meta">
        <p><strong>{translations.current['Customer'] ?? 'Customer'}:</strong> {statement.customer}</p>
        <p><strong>{translations.current['As of'] ?? 'As of'}:</strong> {statement.as_of_date}</p>
      </div>
    </div>

    <table>
      <thead>
        <tr>
          <th>{translations.current['Reference'] ?? 'Reference'}</th>
          <th>{translations.current['Invoice Date'] ?? 'Invoice Date'}</th>
          <th>{translations.current['Due date'] ?? 'Due date'}</th>
          <th class="num">{translations.current['Total'] ?? 'Total'}</th>
          <th class="num">{translations.current['Paid'] ?? 'Paid'}</th>
          <th class="num">{translations.current['Outstanding'] ?? 'Outstanding'}</th>
          <th>{translations.current['Status'] ?? 'Status'}</th>
        </tr>
      </thead>
      <tbody>
        {#if statement.lines.length === 0}
          <tr><td colspan="7" class="empty">{translations.current['No invoices for this customer as of this date.'] ?? 'No invoices for this customer as of this date.'}</td></tr>
        {/if}
        {#each statement.lines as line}
          <tr>
            <td>{line.reference}</td>
            <td>{line.invoice_date}</td>
            <td>{line.due_date ?? ''}</td>
            <td class="num mono">{fmt(line.total_minor)}</td>
            <td class="num mono">{fmt(line.paid_minor)}</td>
            <td class="num mono">{fmt(line.outstanding_minor)}</td>
            <td>{line.status}</td>
          </tr>
        {/each}
      </tbody>
      <tfoot>
        <tr>
          <td colspan="5" class="total-label">{translations.current['Total outstanding'] ?? 'Total outstanding'}</td>
          <td class="num mono total-value">{fmt(statement.total_outstanding_minor)}</td>
          <td></td>
        </tr>
      </tfoot>
    </table>
  </div>
{/if}
</fieldset>

<style>
  .intro {
    max-width: 70ch;
  }
  .error {
    color: var(--debit);
  }
  .controls {
    display: flex;
    align-items: flex-end;
    justify-content: center;
    gap: 1.2rem;
    margin-bottom: 1.2rem;
  }
  .statement-sheet {
    max-width: 900px;
    margin: 0 auto;
    padding: 1.5rem 1.8rem;
    border: 1px solid var(--rule-strong);
    border-radius: 8px;
    background: var(--paper);
  }
  .statement-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: 1.2rem;
    padding-bottom: 0.8rem;
    border-bottom: 2px solid var(--ink);
  }
  .statement-header h3 {
    margin: 0 0 0.2rem;
  }
  .business-line {
    margin: 0;
    color: var(--ink-soft);
  }
  .statement-meta {
    text-align: right;
  }
  .statement-meta p {
    margin: 0.1rem 0;
  }
  th,
  td {
    padding: 0.5rem 0.7rem;
    text-align: left;
    border-bottom: 1px solid var(--rule);
  }
  .num {
    text-align: right;
  }
  .mono {
    font-variant-numeric: tabular-nums;
  }
  .empty {
    text-align: center;
    color: var(--ink-soft);
  }
  tfoot .total-label {
    text-align: right;
    font-weight: 600;
  }
  tfoot .total-value {
    font-weight: 600;
  }

  @media print {
    :global(.no-print) {
      display: none !important;
    }
    .statement-sheet {
      border: none;
      max-width: none;
      padding: 0;
    }
  }
</style>
