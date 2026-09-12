<script lang="ts">
  import { auth } from '$lib/state.svelte';
  import { formatAmount } from '$lib/format';
  import { onMount } from 'svelte';
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';
  import { session } from '$lib/state.svelte';
  import { getEntityTree, getContact, setContact, getCounterpartyHistory, getLanguages, getCreditStatus, ApiError, type EntityNode, type Contact, type HistoryLine, type CreditStatus } from '$lib/api';
  import { translations } from '$lib/state.svelte';
  import AddressList from '$lib/components/AddressList.svelte';
  import PhoneList from '$lib/components/PhoneList.svelte';
  import ContactList from '$lib/components/ContactList.svelte';

  let history: HistoryLine[] = $state([]);
  let creditStatus: CreditStatus | null = $state(null);
  let languages: { id: number; name: string }[] = $state([]);

  let entities: EntityNode[] = $state([]);
  let loading = $state(true);
  let error = $state('');
  let message = $state('');

  let selectedName = $state('');
  // Real contact fields that still live directly on the contact
  // itself, distinct from address/phone — those are now handled
  // entirely by AddressList/PhoneList below, the one, shared
  // component used everywhere an entity needs them, not a second copy
  // of the old address_line1/phone fields here.
  let contact: Pick<Contact, 'email' | 'payment_terms_days' | 'credit_limit_minor' | 'wage_minor_per_hour' | 'salary_minor_per_year' | 'reminder_level' | 'preferred_language'> = $state({
    email: null,
    payment_terms_days: null,
    credit_limit_minor: null,
    wage_minor_per_hour: null,
    salary_minor_per_year: null,
    reminder_level: 0,
    preferred_language: null,
  });
  let saving = $state(false);

  onMount(async () => {
    try {
      [entities, languages] = await Promise.all([getEntityTree(), getLanguages()]);
    } catch (e) {
      error = e instanceof ApiError ? e.message : 'Failed to load.';
    } finally {
      loading = false;
    }
  });

  // Each category lives under a different branch of the entity tree.
  // The same real person can appear in more than one list at once (an
  // employee who's also a customer) — that's two separate entities
  // today, one per role, not one entity trying to occupy two places in
  // a tree that only allows a single parent. This screen shows
  // whichever of these categories a given entity actually belongs to;
  // it doesn't try to unify "these are the same real person" across
  // categories, which is a genuinely separate design question.
  let employees = $derived(entities.filter((e) => entities.find((p) => p.id === e.parent_id)?.name === 'Employees'));
  let customers = $derived(entities.filter((e) => entities.find((p) => p.id === e.parent_id)?.name === 'Accounts Receivable'));
  let vendors = $derived(entities.filter((e) => entities.find((p) => p.id === e.parent_id)?.name === 'Accounts Payable'));
  let manufacturers = $derived(entities.filter((e) => entities.find((p) => p.id === e.parent_id)?.name === 'Manufacturers'));
  let isEmployee = $derived(employees.some((e) => e.name === selectedName));

  // Which real category the person actually arrived to see — set by
  // the real menu link they clicked (Customers under Accounts
  // Receivable, Vendors under Accounts Payable), not guessed. Per
  // direct request: the same, real, shared underlying page and
  // mechanism stays exactly as it was — customers and vendors ARE
  // genuinely the same kind of record — but which one is actually
  // shown by default is now clear from the person's own real,
  // immediate perspective, not left for them to visually pick out of
  // four lists every time.
  let focus = $derived($page.url.searchParams.get('focus'));

  async function select(name: string) {
    selectedName = name;
    error = '';
    message = '';
    try {
      const loaded = await getContact(name);
      contact = {
        email: loaded?.email ?? null,
        payment_terms_days: loaded?.payment_terms_days ?? null,
        credit_limit_minor: loaded?.credit_limit_minor ?? null,
        wage_minor_per_hour: loaded?.wage_minor_per_hour ?? null,
        salary_minor_per_year: loaded?.salary_minor_per_year ?? null,
        reminder_level: loaded?.reminder_level ?? 0,
        preferred_language: loaded?.preferred_language ?? null,
      };
      history = session.current ? await getCounterpartyHistory(session.current.businessName, session.current.ledgerName, name) : [];
      creditStatus = await getCreditStatus(name);
    } catch (e) {
      error = e instanceof ApiError ? e.message : 'Could not load contact details.';
    }
  }

  async function save() {
    if (!selectedName) return;
    saving = true;
    error = '';
    message = '';
    try {
      // setContact does a full replace, not a partial merge — but
      // address_line1/phone are no longer item of what this screen
      // manages at all (AddressList/PhoneList save independently,
      // immediately, the moment each is edited), so there's nothing
      // to lose by omitting them here.
      await setContact(selectedName, contact);
      message = `Saved ${selectedName}.`;
    } catch (e) {
      error = e instanceof ApiError ? e.message : 'Could not save.';
    } finally {
      saving = false;
    }
  }
</script>

<svelte:head><title>{translations.current['Contacts'] ?? 'Contacts'}</title></svelte:head>

<fieldset class="page-title">
  <legend>
    {#if focus === 'customers'}{translations.current['Customers'] ?? 'Customers'}
    {:else if focus === 'vendors'}{translations.current['Vendors'] ?? 'Vendors'}
    {:else}{translations.current['Contacts'] ?? 'Contacts'}{/if}
  </legend>
  {#if focus === 'customers'}
    <p class="intro">{translations.current['Real, account-based customers — created automatically the first time one is used on an AR Sale. A walk-in POS sale never creates one of these.'] ?? 'Real, account-based customers — created automatically the first time one is used on an AR Sale. A walk-in POS sale never creates one of these.'}</p>
  {:else if focus === 'vendors'}
    <p class="intro">{translations.current['Real vendors/suppliers — created automatically the first time one is used on an AP Purchase.'] ?? 'Real vendors/suppliers — created automatically the first time one is used on an AP Purchase.'}</p>
  {:else}
    <p class="intro">{translations.current['Employees, customers, vendors/suppliers, and manufacturers — all stored the same way, as entities with contact details. Customers and vendors are created automatically the first time they\'re used on an AR Sale or AP Purchase; employees and manufacturers don\'t have that yet, so for now they need to exist first via the Structured Editor before contact details can be added here. The same real person can appear in more than one list — an employee who\'s also a customer is two separate entities, one per role, not a special case this screen tries to unify.'] ?? 'Employees, customers, vendors/suppliers, and manufacturers — all stored the same way, as entities with contact details. Customers and vendors are created automatically the first time they\'re used on an AR Sale or AP Purchase; employees and manufacturers don\'t have that yet, so for now they need to exist first via the Structured Editor before contact details can be added here. The same real person can appear in more than one list — an employee who\'s also a customer is two separate entities, one per role, not a special case this screen tries to unify.'}</p>
  {/if}
  {#if focus}
    <p class="show-all"><button type="button" class="link-btn" onclick={() => goto('/contacts')}>{translations.current['Show everything (employees, customers, vendors, manufacturers)'] ?? 'Show everything (employees, customers, vendors, manufacturers)'}</button></p>
  {/if}

  {#if focus && !loading}
    {#if focus === 'employees'}
      <fieldset class="list-card embedded">
        {#if employees.length === 0}
          <p class="empty">{translations.current['None yet.'] ?? 'None yet.'}</p>
        {/if}
        {#each employees as emp}
          <button type="button" class="entry" class:active={selectedName === emp.name} onclick={() => select(emp.name)}>
            {translations.current[emp.name] ?? emp.name}
          </button>
        {/each}
      </fieldset>
    {:else if focus === 'customers'}
      <fieldset class="list-card embedded">
        {#if customers.length === 0}
          <p class="empty">{translations.current['None yet.'] ?? 'None yet.'}</p>
        {/if}
        {#each customers as c}
          <button type="button" class="entry" class:active={selectedName === c.name} onclick={() => select(c.name)}>
            {translations.current[c.name] ?? c.name}
          </button>
        {/each}
      </fieldset>
    {:else if focus === 'vendors'}
      <fieldset class="list-card embedded">
        {#if vendors.length === 0}
          <p class="empty">{translations.current['None yet.'] ?? 'None yet.'}</p>
        {/if}
        {#each vendors as v}
          <button type="button" class="entry" class:active={selectedName === v.name} onclick={() => select(v.name)}>
            {translations.current[v.name] ?? v.name}
          </button>
        {/each}
      </fieldset>
    {:else if focus === 'manufacturers'}
      <fieldset class="list-card embedded">
        {#if manufacturers.length === 0}
          <p class="empty">{translations.current['None yet.'] ?? 'None yet.'}</p>
        {/if}
        {#each manufacturers as m}
          <button type="button" class="entry" class:active={selectedName === m.name} onclick={() => select(m.name)}>
            {translations.current[m.name] ?? m.name}
          </button>
        {/each}
      </fieldset>
    {/if}
  {/if}

{#if loading}
  <p class="center-text">Loading…</p>
{:else}
  <div class="layout">
  {#if !focus}
    <div class="lists">
      <fieldset class="list-card">
        <legend>{translations.current['Employees'] ?? 'Employees'}</legend>
        {#if employees.length === 0}
          <p class="empty">{translations.current['None yet.'] ?? 'None yet.'}</p>
        {/if}
        {#each employees as emp}
          <button type="button" class="entry" class:active={selectedName === emp.name} onclick={() => select(emp.name)}>
            {translations.current[emp.name] ?? emp.name}
          </button>
        {/each}
      </fieldset>
      <fieldset class="list-card">
        <legend>{translations.current['Customers'] ?? 'Customers'}</legend>
        {#if customers.length === 0}
          <p class="empty">{translations.current['None yet.'] ?? 'None yet.'}</p>
        {/if}
        {#each customers as c}
          <button type="button" class="entry" class:active={selectedName === c.name} onclick={() => select(c.name)}>
            {translations.current[c.name] ?? c.name}
          </button>
        {/each}
      </fieldset>
      <fieldset class="list-card">
        <legend>{translations.current['Vendors / Suppliers'] ?? 'Vendors / Suppliers'}</legend>
        {#if vendors.length === 0}
          <p class="empty">{translations.current['None yet.'] ?? 'None yet.'}</p>
        {/if}
        {#each vendors as v}
          <button type="button" class="entry" class:active={selectedName === v.name} onclick={() => select(v.name)}>
            {translations.current[v.name] ?? v.name}
          </button>
        {/each}
      </fieldset>
      <fieldset class="list-card">
        <legend>{translations.current['Manufacturers'] ?? 'Manufacturers'}</legend>
        {#if manufacturers.length === 0}
          <p class="empty">{translations.current['None yet.'] ?? 'None yet.'}</p>
        {/if}
        {#each manufacturers as m}
          <button type="button" class="entry" class:active={selectedName === m.name} onclick={() => select(m.name)}>
            {translations.current[m.name] ?? m.name}
          </button>
        {/each}
      </fieldset>
    </div>
  {/if}

    {#if selectedName}
      <fieldset class="form-card">
        <legend>{selectedName}</legend>
        {#if error}<p class="error">{error}</p>{/if}
        {#if message}<p class="success">{message}</p>{/if}

        {#key selectedName}
          <AddressList entityName={selectedName} />
          <PhoneList entityName={selectedName} />
          <ContactList entityName={selectedName} />
        {/key}

        <fieldset>
          <legend>{translations.current['Email'] ?? 'Email'}</legend>
          <input bind:value={contact.email} placeholder="optional" />
        </fieldset>
        <fieldset>
          <legend>{translations.current['Payment terms (days)'] ?? 'Payment terms (days)'}</legend>
          <input type="number" min="0" bind:value={contact.payment_terms_days} placeholder="e.g. 30 — leave blank if not yet set" />
        </fieldset>
        <p class="hint">
          0 means cash only (due on receipt). A real term (e.g. 30) means aging reports bucket this account at
          30/60/90 days — the buckets are always 1x/2x/3x this number, since account management practice genuinely
          varies per customer or vendor.
        </p>
        <fieldset>
          <legend>{translations.current['Credit limit'] ?? 'Credit limit'}</legend>
          <input
            type="number"
            min="0"
            step="0.01"
            value={contact.credit_limit_minor !== null ? (contact.credit_limit_minor / 100).toFixed(2) : ''}
            oninput={(e) => (contact.credit_limit_minor = e.currentTarget.value === '' ? null : Math.round(Number(e.currentTarget.value) * 100))}
            placeholder="e.g. 5000.00 — leave blank for no limit"
          />
        </fieldset>
        <p class="hint">
          The real, maximum outstanding balance this customer/vendor is allowed to carry — leave blank for no limit
          (an ordinary, unrestricted account). A real, separate setting from payment terms: generous terms and a
          tight limit, or tight terms and a generous limit, are both genuine, real combinations.
        </p>
        {#if isEmployee}
          <fieldset>
            <legend>{translations.current['Wage per hour'] ?? 'Wage per hour'}</legend>
            <input
              type="number"
              min="0"
              step="0.01"
              value={contact.wage_minor_per_hour !== null ? (contact.wage_minor_per_hour / 100).toFixed(2) : ''}
              oninput={(e) => {
                contact.wage_minor_per_hour = e.currentTarget.value === '' ? null : Math.round(Number(e.currentTarget.value) * 100);
                if (contact.wage_minor_per_hour !== null) contact.salary_minor_per_year = null;
              }}
              placeholder="e.g. 28.50 — an hourly employee"
            />
          </fieldset>
          <fieldset>
            <legend>{translations.current['Salary per year'] ?? 'Salary per year'}</legend>
            <input
              type="number"
              min="0"
              step="0.01"
              value={contact.salary_minor_per_year !== null ? (contact.salary_minor_per_year / 100).toFixed(2) : ''}
              oninput={(e) => {
                contact.salary_minor_per_year = e.currentTarget.value === '' ? null : Math.round(Number(e.currentTarget.value) * 100);
                if (contact.salary_minor_per_year !== null) contact.wage_minor_per_hour = null;
              }}
              placeholder="e.g. 88000.00 — a salaried employee, instead of an hourly wage"
            />
          </fieldset>
          <p class="hint">
            {translations.current["A real employee has exactly one of the two — hourly wage or fixed annual salary, never both. Setting one clears the other. Pay Wages (under HR) uses whichever is actually set."] ?? "A real employee has exactly one of the two — hourly wage or fixed annual salary, never both. Setting one clears the other. Pay Wages (under HR) uses whichever is actually set."}
          </p>
        {/if}
        {#if creditStatus}
          <p class="hint credit-status" class:over={creditStatus.overLimit}>
            {#if creditStatus.limitMinor === null}
              Current balance: {formatAmount(creditStatus.balanceMinor, auth.current?.user.number_format ?? '1 000.00')} — no credit limit set.
            {:else if creditStatus.overLimit}
              <strong>{translations.current['Over limit'] ?? 'Over limit'}</strong> — current balance {formatAmount(creditStatus.balanceMinor, auth.current?.user.number_format ?? '1 000.00')}
              exceeds the {formatAmount(creditStatus.limitMinor, auth.current?.user.number_format ?? '1 000.00')} limit by
              {formatAmount(-creditStatus.remainingMinor!, auth.current?.user.number_format ?? '1 000.00')}.
            {:else}
              Current balance {formatAmount(creditStatus.balanceMinor, auth.current?.user.number_format ?? '1 000.00')} of
              {formatAmount(creditStatus.limitMinor, auth.current?.user.number_format ?? '1 000.00')} limit —
              {formatAmount(creditStatus.remainingMinor!, auth.current?.user.number_format ?? '1 000.00')} remaining.
            {/if}
          </p>
        {/if}
        <fieldset>
          <legend>{translations.current['Language'] ?? 'Language'} (for printed documents)</legend>
          <select bind:value={contact.preferred_language}>
            <option value={null}>(use the business default)</option>
            {#each languages as l}<option value={translations.current[l.name] ?? l.name}>{translations.current[l.name] ?? l.name}</option>{/each}
          </select>
        </fieldset>
        <p class="hint">
          This customer/vendor's own preferred language for invoices — genuinely necessary in multilingual markets
          (Canada, Switzerland) where the business's own default language doesn't tell you what a specific customer
          wants their invoice printed in. Leave unset to use the business's own default language.
        </p>
        <button class="btn" onclick={save} disabled={saving}>{saving ? 'Saving…' : (translations.current['Save'] ?? 'Save')}</button>
      </fieldset>

      <fieldset class="history-card">
        <legend>{translations.current['History'] ?? 'History'}</legend>
        {#if history.length === 0}
          <p class="empty">{translations.current['No activity yet.'] ?? 'No activity yet.'}</p>
        {:else}
          <table>
            <thead>
              <tr>
                <th>{translations.current['Date'] ?? 'Date'}</th>
                <th>{translations.current['Reference'] ?? 'Reference'}</th>
                <th>{translations.current['Item'] ?? 'Item'}</th>
                <th class="num">{translations.current['Qty'] ?? 'Qty'}</th>
                <th class="num">{translations.current['Amount'] ?? 'Amount'}</th>
              </tr>
            </thead>
            <tbody>
              {#each history as h}
                <tr>
                  <td>{h.invoice_date}</td>
                  <td>{h.invoice_reference}{h.document_type !== 'invoice' ? ` (${h.document_type})` : ''}</td>
                  <td>{h.description}</td>
                  <td class="num">{h.quantity ?? ''}</td>
                  <td class="num mono">{formatAmount(h.amount_minor, auth.current?.user.number_format ?? '1 000.00')}</td>
                </tr>
              {/each}
            </tbody>
          </table>
        {/if}
      </fieldset>
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

  .show-all {
    margin: 0.3rem 0 0;
    font-size: var(--font-size-base);
  }
  .link-btn {
    background: none;
    border: none;
    padding: 0;
    color: var(--brass-dark, #7a5c2e);
    text-decoration: underline;
    cursor: pointer;
    font: inherit;
  }

  .layout {
    display: flex;
    gap: 1.5rem;
    align-items: flex-start;
    justify-content: center;
  }

  .lists {
    display: flex;
    flex-direction: column;
    gap: 1rem;
    width: 220px;
    flex-shrink: 0;
  }

  .list-card {
    background: var(--paper);
    padding: 0.9rem 1rem;
  }

  .list-card.embedded {
    background: transparent;
    border: none;
    padding: 0.3rem 0 0;
    margin: 0;
  }

  .empty {
    color: var(--ink-soft);
    font-size: var(--font-size-base);
    margin: 0;
  }

  .entry {
    display: block;
    width: 100%;
    text-align: left;
    background: none;
    border: none;
    padding: 0.4rem 0.5rem;
    border-radius: 4px;
    cursor: pointer;
    font-size: var(--font-size-base);
    color: var(--ink);
  }

  .entry:hover {
    background: var(--paper-dim, #f2ede1);
  }

  .entry.active {
    background: var(--paper-dim, #f2ede1);
    border-left: 3px solid var(--brass);
    font-weight: 600;
  }

  .form-card {
    flex: 1;
    max-width: 480px;
    background: var(--paper);
    padding: 1rem 1.2rem;
    display: flex;
    flex-direction: column;
    gap: 0.8rem;
  }
  .form-card > legend {
    font-size: var(--font-size-large);
    font-weight: 600;
    color: var(--ink);
    padding: 0 0.5rem;
  }

  .hint {
    font-size: var(--font-size-small);
    color: var(--ink-soft);
    margin: -0.3rem 0 0.2rem;
  }

  .credit-status {
    font-size: var(--font-size-base);
    padding: 0.4rem 0.6rem;
    border-radius: 5px;
    background: var(--paper-dim, #f2ede1);
    color: var(--ink);
  }
  .credit-status.over {
    background: #fdecea;
    color: #a33a2e;
    font-weight: 500;
  }

  .success {
    color: var(--credit);
  }
  .history-card {
    background: var(--paper);
    margin-top: 1rem;
    padding: 1rem 1.2rem;
    max-width: 480px;
  }
  .history-card > legend {
    font-size: var(--font-size-large);
    font-weight: 600;
    color: var(--ink);
    padding: 0 0.5rem;
  }

  .history-card th,
  .history-card td {
    padding: 0.3rem 0.5rem;
    text-align: left;
    border-bottom: 1px solid var(--rule);
    font-size: var(--font-size-base);
  }
</style>
