<script lang="ts">
  import type { Paginator } from '$lib/pagination';
  import { translations } from '$lib/state.svelte';

  let { paginator }: { paginator: Paginator<unknown> } = $props();
</script>

{#if $paginator.showPager}
  <div class="pager">
    <button class="btn secondary" onclick={paginator.first} disabled={$paginator.isFirstPage} title={translations.current['First'] ?? 'First'}>|&larr;</button>
    <button class="btn secondary" onclick={paginator.previous} disabled={$paginator.isFirstPage}>&larr; {translations.current['Newer'] ?? 'Newer'}</button>
    <span class="page-label">
      {translations.current['Page'] ?? 'Page'} {$paginator.page + 1}{#if $paginator.totalPages != null} {translations.current['of'] ?? 'of'} {$paginator.totalPages}{/if}
    </span>
    <button class="btn secondary" onclick={paginator.next} disabled={$paginator.isLastPage}>{translations.current['Older'] ?? 'Older'} &rarr;</button>
    <button class="btn secondary" onclick={paginator.last} disabled={$paginator.isLastPage} title={translations.current['Last'] ?? 'Last'}>&rarr;|</button>
  </div>
{/if}
<style>
  .pager {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.6rem;
    margin-top: 1.2rem;
  }

  .page-label {
    font-size: var(--font-size-base);
    color: var(--ink-soft);
    white-space: nowrap;
  }
</style>
