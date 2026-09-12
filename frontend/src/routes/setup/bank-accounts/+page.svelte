<script lang="ts">
  import { auth } from '$lib/state.svelte';
  import { formatAmount } from '$lib/format';
  import { session } from '$lib/state.svelte';
  import { translations } from '$lib/state.svelte';
  import {
    getEntityTree,
    getBankAccounts,
    getCashPosition,
    registerBankAccount,
    unregisterBankAccount,
    getDivisions,
    ApiError,
    type EntityNode,
    type BankAccountRow,
    type CashPositionByCurrency,
  } from '$lib/api';

  let entities: EntityNode[] = $state([]);
  let bankAccounts: BankAccountRow[] = $state([]);
  let cashPosition: CashPositionByCurrency[] = $state([]);
  let divisionNames: string[] = $state([]);
  let loading = $state(true);
  let error = $state('');

  let latestRequestId = 0;
  async function load() {
    if (!session.current) return;
    const requestId = ++latestRequestId;
    loading = true;
    error = '';
    try {
      const [ents, accounts, position, divisions] = await Promise.all([
        getEntityTree(),
        getBankAccounts(session.current.businessName, session.current.ledgerName),
        getCashPosition(session.current.businessName, session.current.ledgerName),
        getDivisions(),
      ]);
      if (requestId !== latestRequestId) return;
      entities = ents;
      bankAccounts = accounts;
      cashPosition = position;
      divisionNames = divisions.map((d) => d.name);
    } catch (e) {
      if (requestId !== latestRequestId) return;
      error = e instanceof ApiError ? e.message : 'Failed to load.';
    } finally {
      if (requestId === latestRequestId) loading = false;
    }
  }

  $effect(() => {
    if (session.current) load();
  });

  function isUnderAsset(e: EntityNode): boolean {
    const byId = new Map(entities.map((x) => [x.id, x]));
    let cur: EntityNode | undefined = e;
    while (cur) {
      if (cur.name === 'Asset') return true;
      cur = cur.parent_id !== null ? byId.get(cur.parent_id) : undefined;
    }
    return false;
  }

  let registeredNames = $derived(new Set(bankAccounts.map((a) => a.name)));
  let candidateAccounts = $derived(entities.filter((e) => e.is_postable_account && isUnderAsset(e) && !registeredNames.has(e.name)));

  import Form from '$lib/components/Form.svelte';

  let registerValues: Record<string, string | number | string[]> = $state({ account: '', scope: '', overdraftLimit: '' });

  async function register(values: Record<string, string | number | string[]>) {
    const accountName = String(values.account ?? '');
    const scopeName = String(values.scope ?? '');
    if (!session.current || !accountName || !scopeName) throw new Error('Account and scope are both required.');
    const overdraft = values.overdraftLimit;
    const limitMinor = overdraft === '' || overdraft == null ? null : Math.round(Number(overdraft) * 100);
    await registerBankAccount(accountName, session.current.businessName, scopeName, limitMinor);
    registerValues = { account: '', scope: '', overdraftLimit: '' };
    await load();
  }

  async function unregister(accountName: string) {
    try {
      await unregisterBankAccount(accountName);
      await load();
    } catch (e) {
      error = e instanceof ApiError ? e.message : 'Could not unregister this account.';
    }
  }

  const fmt = (c: number) => formatAmount(c, auth.current?.user.number_format ?? '1 000.00');
</script>

<svelte:head><title>{translations.current['Bank Accounts'] ?? 'Bank Accounts'}</title></svelte:head>

<fieldset class="page-title">
  <legend>{translations.current['Bank Accounts'] ?? 'Bank Accounts'}</legend>
  <p class="intro">
    {translations.current['Registering which real accounts represent actual cash/bank accounts — distinct from the broader Chart of Accounts, since Inventory or Accounts Receivable also sit under Asset but are genuinely not cash. Each real bank account has its own real business or division scope (a division may bank with a different bank from another) and its own real, optional overdraft limit.'] ?? 'Registering which real accounts represent actual cash/bank accounts — distinct from the broader Chart of Accounts, since Inventory or Accounts Receivable also sit under Asset but are genuinely not cash. Each real bank account has its own real business or division scope (a division may bank with a different bank from another) and its own real, optional overdraft limit.'}
  </p>
</fieldset>

{#if loading}
  <p class="center-text">Loading…</p>
{:else}
  {#if error}<p class="error">{error}</p>{/if}

  {#if cashPosition.length > 0}
    <div class="card position-card">
      <h3>{translations.current['Current cash position'] ?? 'Current cash position'}</h3>
      <table>
        <thead>
          <tr>
            <th>{translations.current['Currency'] ?? 'Currency'}</th>
            <th class="num">{translations.current['Balance'] ?? 'Balance'}</th>
            <th class="num">{translations.current['Overdraft limit'] ?? 'Overdraft limit'}</th>
            <th class="num">{translations.current['Headroom'] ?? 'Headroom'}</th>
          </tr>
        </thead>
        <tbody>
          {#each cashPosition as row}
            <tr>
              <td>{row.currency ?? (session.current?.businessName ?? 'Home currency')}</td>
              <td class="num mono">{fmt(row.total_balance_minor)}</td>
              <td class="num mono">{row.total_overdraft_limit_minor === null ? '—' : fmt(row.total_overdraft_limit_minor)}</td>
              <td class="num mono" class:warn={row.headroom_minor !== null && row.headroom_minor < 0}>
                {row.headroom_minor === null ? translations.current['unknown'] ?? 'unknown' : fmt(row.headroom_minor)}
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  {/if}

  <fieldset class="card-legend">
    <legend>{translations.current['Registered bank accounts'] ?? 'Registered bank accounts'}</legend>
    {#if bankAccounts.length === 0}
      <p class="empty">{translations.current['No bank accounts registered yet.'] ?? 'No bank accounts registered yet.'}</p>
    {:else}
      <table>
        <thead>
          <tr>
            <th>{translations.current['Account'] ?? 'Account'}</th>
            <th>{translations.current['Scope'] ?? 'Scope'}</th>
            <th>{translations.current['Currency'] ?? 'Currency'}</th>
            <th class="num">{translations.current['Balance'] ?? 'Balance'}</th>
            <th class="num">{translations.current['Overdraft limit'] ?? 'Overdraft limit'}</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {#each bankAccounts as acc}
            <tr>
              <td>{translations.current[acc.name] ?? acc.name}</td>
              <td>{acc.scope}</td>
              <td>{acc.currency ?? ''}</td>
              <td class="num mono">{fmt(acc.balance_minor)}</td>
              <td class="num mono">{acc.overdraft_limit_minor === null ? '—' : fmt(acc.overdraft_limit_minor)}</td>
              <td><button type="button" class="remove-link" onclick={() => unregister(acc.name)}>{translations.current['Unregister'] ?? 'Unregister'}</button></td>
            </tr>
          {/each}
        </tbody>
      </table>
    {/if}
  </fieldset>

  <fieldset class="card-legend">
    <legend>{translations.current['Register a bank account'] ?? 'Register a bank account'}</legend>
    <Form
      fields={[
        { name: 'account', label: 'Account', type: 'select', options: candidateAccounts.map((acc) => acc.name) },
        {
          name: 'scope',
          label: 'Scope (business or division)',
          type: 'select',
          options: [...(session.current ? [session.current.businessName] : []), ...divisionNames],
        },
        { name: 'overdraftLimit', label: 'Overdraft limit (optional)', type: 'number', step: 0.01 },
      ]}
      bind:values={registerValues}
      onSubmit={register}
      submitLabel="Register"
    />
  </fieldset>
{/if}

<style>
  .intro {
    max-width: 80ch;
  }
  .center-text {
    text-align: center;
  }
  .error {
    color: var(--debit);
  }
  .card {
    max-width: 900px;
    margin: 0 auto 1.2rem;
    padding: 1.2rem 1.3rem;
    border: 1px solid var(--rule-strong, #ccc);
    border-radius: 8px;
    background: var(--paper);
  }
  .card h3 {
    margin-top: 0;
  }
  .position-card {
    background: #fdf6e8;
    border-color: #d9a441;
  }
  th,
  td {
    padding: 0.4rem 0.6rem;
    text-align: left;
    border-bottom: 1px solid var(--rule);
  }
  .num {
    text-align: right;
  }
  .mono {
    font-variant-numeric: tabular-nums;
  }
  .warn {
    color: var(--debit, #a33a2e);
    font-weight: 600;
  }
  .empty {
    color: var(--ink-soft);
  }
  .remove-link {
    background: none;
    border: none;
    cursor: pointer;
    color: var(--debit, #a33a2e);
    font-size: var(--font-size-base);
  }
</style>
