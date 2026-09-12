<script lang="ts">
  import { translations } from '$lib/state.svelte';
  const items = [
    { href: '/arap/ar-sale', title: 'AR Sale', description: 'Sell to a customer on credit — debits Accounts Receivable, credits Sales Revenue.' },
    { href: '/arap/ar-receipt', title: 'AR Receipt', description: 'Record a payment received from a customer — debits Cash, credits their AR balance.' },
    { href: '/arap/ap-purchase', title: 'AP Purchase', description: 'Buy from a vendor on credit — debits an expense/asset account, credits Accounts Payable.' },
    { href: '/arap/ap-payment', title: 'AP Payment', description: 'Pay a vendor — debits their AP balance, credits Cash.' },
  ];
</script>

<svelte:head><title>{translations.current['AR / AP'] ?? 'AR / AP'}</title></svelte:head>

<fieldset class="page-title">
  <legend>{translations.current['AR / AP'] ?? 'AR / AP'}</legend>
  <p class="intro">{translations.current['Purpose-built entry screens for the most common transactions — each posts through the same atomic journal mechanism as everything else.'] ?? 'Purpose-built entry screens for the most common transactions — each posts through the same atomic journal mechanism as everything else.'}</p>

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
