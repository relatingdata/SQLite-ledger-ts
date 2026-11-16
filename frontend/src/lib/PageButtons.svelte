<script lang="ts">
  // The page buttons every paged list shares: first, previous, "Page n of
  // m", next, last. The Pager (server-side paging, through a paginator)
  // and generated screens (paging rows already loaded) both draw these.
  import { translations } from '$lib/state.svelte';

  let {
    page,
    totalPages,
    isFirstPage = page === 0,
    isLastPage = totalPages != null && page >= totalPages - 1,
    go,
    previousLabel = 'Previous',
    nextLabel = 'Next',
  }: {
    page: number;
    totalPages: number | null;
    isFirstPage?: boolean;
    isLastPage?: boolean;
    go: (to: 'first' | 'previous' | 'next' | 'last') => void;
    previousLabel?: string;
    nextLabel?: string;
  } = $props();
  const t = (word: string) => translations.current[word] ?? word;
</script>

<div class="pager">
  <button type="button" class="btn secondary" onclick={() => go('first')} disabled={isFirstPage} title={t('First')}>|&larr;</button>
  <button type="button" class="btn secondary" onclick={() => go('previous')} disabled={isFirstPage}>&larr; {t(previousLabel)}</button>
  <span class="page-label">
    {t('Page')} {page + 1}{#if totalPages != null}{' '}{t('of')} {totalPages}{/if}
  </span>
  <button type="button" class="btn secondary" onclick={() => go('next')} disabled={isLastPage}>{t(nextLabel)} &rarr;</button>
  <button type="button" class="btn secondary" onclick={() => go('last')} disabled={isLastPage || totalPages == null} title={t('Last')}>&rarr;|</button>
</div>

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
