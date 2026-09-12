<script lang="ts">
  import { onMount } from 'svelte';
  import { session } from '$lib/state.svelte';
  import { translations } from '$lib/state.svelte';
  import { getEntityTree, getBusinesses, getLedgers, clockInToProject, clockOutOfProject, getOpenProjectClock, asBusinessName, asLedgerName, asEmployeeName, asAccountName, ApiError, type EntityNode, type EmployeeClock } from '$lib/api';

  let businesses: { id: number; name: string }[] = $state([]);
  let ledgers: { id: number; name: string }[] = $state([]);
  let business = $state('');
  let ledger = $state('');
  let entities: EntityNode[] = $state([]);
  let employees: string[] = $state([]);
  let expenseAccounts: string[] = $state([]);

  let employeeName = $state('');
  let projectExpenseAccount = $state('');
  let openClock: EmployeeClock | null = $state(null);

  let loading = $state(true);
  let working = $state(false);
  let error = $state('');
  let message = $state('');

  async function loadLedgers() {
    ledgers = await getLedgers(business);
    ledger = ledgers[0]?.name ?? '';
  }

  async function load() {
    loading = true;
    error = '';
    try {
      [businesses, entities] = await Promise.all([getBusinesses(), getEntityTree()]);
      business = session.current?.businessName ?? businesses[0]?.name ?? '';
      await loadLedgers();

      const employeesRoot = entities.find((e) => e.name === 'Employees');
      employees = entities.filter((e) => e.parent_id === employeesRoot?.id).map((e) => e.name);

      const expenseRoot = entities.find((e) => e.name === 'Expense');
      const isDescendantOfExpense = (id: number | null): boolean => {
        while (id != null) {
          if (id === expenseRoot?.id) return true;
          id = entities.find((e) => e.id === id)?.parent_id ?? null;
        }
        return false;
      };
      expenseAccounts = entities.filter((e) => e.is_postable_account && isDescendantOfExpense(e.parent_id)).map((e) => e.name);
    } catch (e) {
      error = e instanceof ApiError ? e.message : 'Failed to load.';
    } finally {
      loading = false;
    }
  }

  onMount(load);

  async function checkOpenClock() {
    if (!employeeName) {
      openClock = null;
      return;
    }
    try {
      openClock = await getOpenProjectClock(asEmployeeName(employeeName));
    } catch {
      openClock = null;
    }
  }

  $effect(() => {
    if (employeeName) checkOpenClock();
  });

  async function clockIn() {
    if (!employeeName || !projectExpenseAccount) return;
    working = true;
    error = '';
    message = '';
    try {
      await clockInToProject(asEmployeeName(employeeName), asAccountName(projectExpenseAccount), asBusinessName(business), asLedgerName(ledger));
      message = `${employeeName} clocked in against "${projectExpenseAccount}".`;
      await checkOpenClock();
    } catch (e) {
      error = e instanceof ApiError ? e.message : 'Could not clock in.';
    } finally {
      working = false;
    }
  }

  async function clockOut() {
    if (!employeeName) return;
    working = true;
    error = '';
    message = '';
    try {
      await clockOutOfProject(asEmployeeName(employeeName), asBusinessName(business), asLedgerName(ledger));
      message = `${employeeName} clocked out — the real hours worked have been posted as due for payment.`;
      await checkOpenClock();
    } catch (e) {
      error = e instanceof ApiError ? e.message : 'Could not clock out.';
    } finally {
      working = false;
    }
  }
</script>

<svelte:head><title>{translations.current['Projects'] ?? 'Projects'}</title></svelte:head>

<fieldset class="page-title">
  <legend>{translations.current['Projects'] ?? 'Projects'}</legend>
  <p class="intro">
    {translations.current["Clocking in is placing a real, standing order for an employee's own product — their time, at their own real price per hour. Clocking out completes its real delivery, rendering the hours worked genuinely due for payment."] ?? "Clocking in is placing a real, standing order for an employee's own product — their time, at their own real price per hour. Clocking out completes its real delivery, rendering the hours worked genuinely due for payment."}
  </p>

  {#if loading}
    <p>Loading…</p>
  {:else}
    <div class="row">
      <fieldset>
        <legend>{translations.current['Employee'] ?? 'Employee'}</legend>
        <select bind:value={employeeName}>
          <option value="">{translations.current['Select employee...'] ?? 'Select employee...'}</option>
          {#each employees as e}<option value={e}>{e}</option>{/each}
        </select>
      </fieldset>

      {#if openClock}
        <fieldset>
          <legend>{translations.current['Currently clocked in against'] ?? 'Currently clocked in against'}</legend>
          <p class="mono">{openClock.project_expense_account}</p>
          <p class="hint">{translations.current['Since'] ?? 'Since'} {new Date(openClock.clocked_in_at).toLocaleString()}</p>
        </fieldset>
        <button class="btn" onclick={clockOut} disabled={working}>
          {translations.current['Clock out'] ?? 'Clock out'}
        </button>
      {:else if employeeName}
        <fieldset class="grow">
          <legend>{translations.current['Project (expense account)'] ?? 'Project (expense account)'}</legend>
          <select bind:value={projectExpenseAccount}>
            <option value="">{translations.current['Select project...'] ?? 'Select project...'}</option>
            {#each expenseAccounts as a}<option value={a}>{a}</option>{/each}
          </select>
        </fieldset>
        <button class="btn" onclick={clockIn} disabled={working || !projectExpenseAccount}>
          {translations.current['Clock in'] ?? 'Clock in'}
        </button>
      {/if}
    </div>

    {#if error}<p class="error">{error}</p>{/if}
    {#if message}<p class="success">{message}</p>{/if}
  {/if}
</fieldset>

<style>
  .row {
    display: flex;
    gap: 1rem;
    align-items: flex-end;
    flex-wrap: wrap;
  }

  .grow {
    flex: 1;
  }

  .hint {
    font-size: var(--font-size-base);
    color: var(--ink-soft);
  }
</style>
