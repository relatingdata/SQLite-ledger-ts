<script lang="ts">
  import { auth } from '$lib/state.svelte';
  import { formatAmount } from '$lib/format';
  import { onMount } from 'svelte';
  import { session } from '$lib/state.svelte';
  import { translations } from '$lib/state.svelte';
  import { getEntityTree, getContact, payEmployeeWages, getOrganizationChart, asEmployeeName, ApiError, type EntityNode, type Contact, type OrganizationChart } from '$lib/api';

  let activeTab: 'pay' | 'directory' = $state('pay');

  let entities: EntityNode[] = $state([]);
  let loading = $state(true);
  let error = $state('');

  let employeeName = $state('');
  let employeeContact: Contact | null = $state(null);
  let loadingContact = $state(false);
  let hours = $state('');
  let paymentMethod = $state('onaccount');
  let transdate = $state(new Date().toISOString().slice(0, 10));
  let submitting = $state(false);
  let payError = $state('');
  let payResult: { invoiceId: number; reference: string; grossMinor: number; medicareLevyMinor: number; superannuationMinor: number; netMinor: number } | null = $state(null);

  let chart: OrganizationChart | null = $state(null);
  let loadingChart = $state(false);
  let chartError = $state('');

  onMount(async () => {
    try {
      entities = await getEntityTree();
    } catch (e) {
      error = e instanceof ApiError ? e.message : 'Failed to load.';
    } finally {
      loading = false;
    }
  });

  let employees = $derived(entities.filter((e) => entities.find((p) => p.id === e.parent_id)?.name === 'Employees').sort((a, b) => a.name.localeCompare(b.name)));

  async function selectEmployee(name: string) {
    employeeName = name;
    employeeContact = null;
    payResult = null;
    payError = '';
    hours = '';
    if (!name) return;
    loadingContact = true;
    try {
      employeeContact = (await getContact(name)) ?? null;
    } catch (e) {
      payError = e instanceof ApiError ? e.message : 'Could not load this employee.';
    } finally {
      loadingContact = false;
    }
  }

  let isHourly = $derived.by(() => !!employeeContact?.wage_minor_per_hour);
  let isSalaried = $derived.by(() => !!employeeContact?.salary_minor_per_year);
  let hasNoRate = $derived(employeeContact !== null && !isHourly && !isSalaried);

  async function submitPayment() {
    if (!employeeName || !session.current) return;
    if (isHourly && (!hours || Number(hours) <= 0)) {
      payError = 'Enter real hours worked first.';
      return;
    }
    submitting = true;
    payError = '';
    payResult = null;
    try {
      payResult = await payEmployeeWages({
        business: session.current.businessName,
        ledger: session.current.ledgerName,
        employeeName: asEmployeeName(employeeName),
        hours: isHourly ? Number(hours) : undefined,
        paymentMethod: paymentMethod === 'onaccount' ? undefined : paymentMethod,
        transdate,
      });
      hours = '';
    } catch (e) {
      payError = e instanceof ApiError ? e.message : 'Could not pay this employee.';
    } finally {
      submitting = false;
    }
  }

  async function loadChart() {
    if (!session.current) return;
    loadingChart = true;
    chartError = '';
    try {
      chart = await getOrganizationChart(session.current.businessName);
    } catch (e) {
      chartError = e instanceof ApiError ? e.message : 'Could not load the organization chart.';
    } finally {
      loadingChart = false;
    }
  }

  function switchTab(tab: 'pay' | 'directory') {
    activeTab = tab;
    if (tab === 'directory' && !chart) loadChart();
  }

  const fmt = (c: number) => formatAmount(c, auth.current?.user.number_format ?? '1 000.00');
</script>

<svelte:head><title>{translations.current['HR / Payroll'] ?? 'HR / Payroll'}</title></svelte:head>

<fieldset class="page-title">
  <legend>{translations.current['HR / Payroll'] ?? 'HR / Payroll'}</legend>
  <p class="intro">
    {translations.current['A real employee is treated as a real Accounts Payable counterparty — the same mechanism a vendor invoice already uses. Paying wages debits Wages (or the employee\'s own monthly salary), withholds a real Medicare levy from their own pay, and accrues real superannuation as a separate, additional employer cost.'] ?? 'A real employee is treated as a real Accounts Payable counterparty — the same mechanism a vendor invoice already uses. Paying wages debits Wages (or the employee\'s own monthly salary), withholds a real Medicare levy from their own pay, and accrues real superannuation as a separate, additional employer cost.'}
  </p>
<div class="tab-bar">
  <button type="button" class:active={activeTab === 'pay'} onclick={() => switchTab('pay')}>{translations.current['Pay Wages'] ?? 'Pay Wages'}</button>
  <button type="button" class:active={activeTab === 'directory'} onclick={() => switchTab('directory')}>{translations.current['Org Chart'] ?? 'Org Chart'}</button>
</div>

{#if loading}
  <p class="center-text">Loading…</p>
{:else if activeTab === 'pay'}
  <div class="card form-card">
    <p class="context-line">
      <strong>{session.current?.businessName ?? ''}</strong> — {session.current?.ledgerName ?? ''}
    </p>

    <div class="row-2">
      <fieldset>
        <legend>{translations.current['Employee'] ?? 'Employee'}</legend>
        <select value={employeeName} onchange={(e) => selectEmployee(e.currentTarget.value)}>
          <option value="">{translations.current['Select employee…'] ?? 'Select employee…'}</option>
          {#each employees as emp}<option value={translations.current[emp.name] ?? emp.name}>{translations.current[emp.name] ?? emp.name}</option>{/each}
        </select>
      </fieldset>
      <fieldset>
        <legend>{translations.current['Date'] ?? 'Date'}</legend>
        <input type="date" bind:value={transdate} />
      </fieldset>
    </div>

    {#if loadingContact}
      <p class="center-text">Loading…</p>
    {:else if employeeContact}
      {#if hasNoRate}
        <p class="hint over">
          {translations.current['No real wage or salary configured for this employee yet — set one on the Contacts page first.'] ?? 'No real wage or salary configured for this employee yet — set one on the Contacts page first.'}
        </p>
      {:else if isHourly}
        <p class="pay-rate">{translations.current['Hourly wage'] ?? 'Hourly wage'}: <strong>{fmt(employeeContact.wage_minor_per_hour ?? 0)}/hour</strong></p>
        <fieldset>
          <legend>{translations.current['Hours worked'] ?? 'Hours worked'}</legend>
          <input type="number" min="0" step="0.25" bind:value={hours} placeholder="e.g. 38.5" />
        </fieldset>
      {:else if isSalaried}
        <p class="pay-rate">
          {translations.current['Annual salary'] ?? 'Annual salary'}: <strong>{fmt(employeeContact.salary_minor_per_year ?? 0)}/year</strong>
          — {translations.current['this pays one real month'] ?? 'this pays one real month'}: {fmt(Math.round((employeeContact.salary_minor_per_year ?? 0) / 12))}
        </p>
      {/if}

      {#if !hasNoRate}
        <fieldset class="payment-method">
          <legend>{translations.current['Payment method'] ?? 'Payment method'}</legend>
          <label><input type="radio" bind:group={paymentMethod} value="onaccount" /> {translations.current['On account (pay later)'] ?? 'On account (pay later)'}</label>
          <label><input type="radio" bind:group={paymentMethod} value="cash" /> {translations.current['Cash'] ?? 'Cash'}</label>
          <label><input type="radio" bind:group={paymentMethod} value="eft" /> {translations.current['EFT'] ?? 'EFT'}</label>
        </fieldset>

        {#if payError}<p class="error">{payError}</p>{/if}
        {#if payResult}
          <div class="pay-result">
            <p><strong>{translations.current['Paid'] ?? 'Paid'}: {payResult.reference}</strong></p>
            <p>{translations.current['Gross'] ?? 'Gross'}: {fmt(payResult.grossMinor)}</p>
            <p>{translations.current['Medicare levy withheld'] ?? 'Medicare levy withheld'}: {fmt(payResult.medicareLevyMinor)}</p>
            <p>{translations.current['Superannuation (employer cost)'] ?? 'Superannuation (employer cost)'}: {fmt(payResult.superannuationMinor)}</p>
            <p>{translations.current['Net paid to employee'] ?? 'Net paid to employee'}: <strong>{fmt(payResult.netMinor)}</strong></p>
          </div>
        {/if}

        <button class="btn" onclick={submitPayment} disabled={submitting || (isHourly && !hours)}>
          {submitting ? 'Paying…' : (translations.current['Pay employee'] ?? 'Pay employee')}
        </button>
      {/if}
    {/if}
  </div>
{:else}
  <div class="card directory-card">
    {#if loadingChart}
      <p class="center-text">Loading…</p>
    {:else if chartError}
      <p class="error">{chartError}</p>
    {:else if chart}
      {#if chart.companyWideEmployees.length > 0}
        <div class="org-section">
          <h3>{translations.current['Company-wide staff'] ?? 'Company-wide staff'}</h3>
          <ul>
            {#each chart.companyWideEmployees as name}<li>{name}</li>{/each}
          </ul>
        </div>
      {/if}
      {#each chart.groups as group}
        <div class="org-section">
          <h3>{group.group}</h3>
          {#each group.locations as loc}
            <div class="org-location">
              <p class="org-location-name">{loc.location}</p>
              <ul>
                {#each loc.employees as name}<li>{name}</li>{/each}
              </ul>
            </div>
          {/each}
        </div>
      {/each}
    {/if}
  </div>
{/if}

</fieldset>
<style>
  .intro {
    max-width: 70ch;
  }
  .center-text {
    text-align: center;
  }
  .tab-bar {
    display: flex;
    gap: 0.5rem;
    max-width: 720px;
    margin: 0 auto 1rem;
    border-bottom: 1px solid var(--rule);
  }
  .tab-bar button {
    background: none;
    border: none;
    border-bottom: 3px solid transparent;
    padding: 0.6rem 0.9rem;
    font-size: var(--font-size-medium);
    font-weight: 600;
    color: var(--ink-soft);
    cursor: pointer;
  }
  .tab-bar button.active {
    border-bottom-color: var(--brass-dark, #8a6d3b);
    color: var(--ink);
  }
  .context-line {
    font-size: var(--font-size-base);
    color: var(--ink-soft);
    margin: 0 0 0.8rem;
    padding-bottom: 0.6rem;
    border-bottom: 1px solid var(--rule);
  }
  .form-card,
  .directory-card {
    max-width: 720px;
    margin: 0 auto 1.2rem;
    padding: 1.2rem 1.3rem;
    border: 1px solid var(--rule-strong, #ccc);
    border-radius: 8px;
    background: var(--paper);
  }
  .row-2 {
    display: flex;
    gap: 1rem;
    margin-bottom: 0.6rem;
  }
  .row-2 fieldset {
    flex: 1;
  }
  .pay-rate {
    font-size: var(--font-size-medium);
    color: var(--ink-soft);
    margin: 0.6rem 0;
  }
  .payment-method {
    margin: 0.8rem 0;
    display: flex;
    flex-direction: column;
    align-items: stretch;
    gap: 0.5rem;
  }
  .payment-method label {
    display: flex;
    align-items: flex-start;
    gap: 0.5rem;
    font-weight: normal;
    width: 100%;
  }
  .payment-method label input[type='radio'] {
    margin-top: 0.2rem;
    flex-shrink: 0;
    width: 1rem !important;
  }
  .hint.over {
    color: var(--debit, #a33a2e);
  }
  .error {
    color: var(--debit, #a33a2e);
  }
  .pay-result {
    padding: 0.6rem 0.8rem;
    border-radius: 5px;
    background: #eaf5ea;
    color: #2a5c2a;
    margin: 0.8rem 0;
  }
  .pay-result p {
    margin: 0.15rem 0;
  }
  .org-section {
    margin-bottom: 1.2rem;
  }
  .org-section h3 {
    margin: 0 0 0.4rem;
    font-size: var(--font-size-medium);
  }
  .org-section > ul {
    margin: 0 0 0.4rem;
    padding-left: 1.2rem;
  }
  .org-location {
    margin: 0.4rem 0 0.4rem 0.8rem;
  }
  .org-location-name {
    font-weight: 600;
    margin: 0.3rem 0 0.1rem;
    font-size: var(--font-size-medium);
  }
  .org-location ul {
    margin: 0;
    padding-left: 1.2rem;
    font-size: var(--font-size-medium);
    color: var(--ink-soft);
  }
</style>
