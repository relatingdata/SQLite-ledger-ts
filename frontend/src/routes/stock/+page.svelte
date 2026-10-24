<script lang="ts">
  import { translations } from '$lib/state.svelte';
  const items = [
    { href: '/stock/po', title: 'Purchase Order', description: 'Commit to buying from a provider — memo only, until a Stock Receipt fulfills it.' },
    { href: '/stock/stock-receipt', title: 'Stock Receipt', description: 'Fulfill a Purchase Order — receives goods or a service, real posting.' },
    { href: '/stock/so', title: 'Sales Order', description: "A customer's committed order — memo only, until a Stock Dispatch fulfills it." },
    { href: '/stock/stock-dispatch', title: 'Stock Dispatch', description: 'Fulfill a Sales Order — ships and invoices in one action, real posting.' },
  ];
</script>

<svelte:head><title>{translations.current['Stock / Orders'] ?? 'Stock / Orders'}</title></svelte:head>

<fieldset class="page-title">
  <legend>{translations.current['Stock / Orders'] ?? 'Stock / Orders'}</legend>
  <p class="intro">{translations.current['Purchase and Sales Orders are commitments only — placing one never touches a real account. Fulfilling one (a Stock Receipt or Dispatch) is what actually posts to the ledger.'] ?? 'Purchase and Sales Orders are commitments only — placing one never touches a real account. Fulfilling one (a Stock Receipt or Dispatch) is what actually posts to the ledger.'}</p>

  <div class="grid">
    {#each items as item}
      <a class="card tile" href={item.href}>
        <h3>{item.title}</h3>
        <p>{item.description}</p>
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
</style>
