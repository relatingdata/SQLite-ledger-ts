<script lang="ts">
  import { translations } from '$lib/state.svelte';

  let reports = $derived([
    { href: '/reports/trial-balance', title: translations.current['Trial Balance'] ?? 'Trial Balance', description: 'Every posted account, split into debit or credit.' },
    { href: '/reports/balance-sheet', title: translations.current['Balance Sheet'] ?? 'Balance Sheet', description: 'Assets, Liabilities, and Equity — including unclosed net income.' },
    { href: '/reports/profit-and-loss', title: translations.current['Profit and Loss Statement'] ?? 'Profit and Loss Statement', description: 'Income and Expenses, and the resulting net income.' },
    { href: '/reports/compare', title: translations.current['Compare Ledgers'] ?? 'Compare Ledgers', description: 'Actual vs. a budget or scenario, side by side, with variance.' },
    { href: '/reports/storage-space', title: translations.current['Inventory and Storage'] ?? 'Inventory and Storage', description: 'Each location\'s own, real, physical storage space — Installed, Occupied, and Remaining, per storage unit. Outside Chart of Accounts, so never on the Trial Balance.' },
  ]);
</script>

<svelte:head><title>{translations.current['Reports'] ?? 'Reports'}</title></svelte:head>

<fieldset class="page-title">
  <legend>{translations.current['Reports'] ?? 'Reports'}</legend>
  <p class="intro">
    {@html translations.current["Both Balance Sheet and Profit and Loss are derived from the same Chart of Accounts tree, via each category's <code>relation_id</code> — not a second stored hierarchy."] ?? "Both Balance Sheet and Profit and Loss are derived from the same Chart of Accounts tree, via each category's <code>relation_id</code> — not a second stored hierarchy."}
  </p>

  <div class="grid">
    {#each reports as r}
      <a class="card tile" href={r.href}>
        <h3>{r.title}</h3>
        <p>{r.description}</p>
      </a>
    {/each}
  </div>
</fieldset>

<style>

  .grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
    gap: 1rem;
  }

  .tile {
    display: block;
    padding: 1.1rem 1.2rem;
    text-decoration: none;
    color: var(--ink);
  }

  .tile:hover {
    border-color: var(--brass);
  }

  .tile h3 {
    margin: 0 0 0.4rem;
    color: var(--brass-dark);
  }

  .tile p {
    margin: 0;
    font-size: var(--font-size-base);
    color: var(--ink-soft);
  }

  :global(.intro code) {
    font-family: var(--font-mono);
    background: var(--rule);
    padding: 0.1em 0.35em;
    border-radius: 3px;
  }
</style>
