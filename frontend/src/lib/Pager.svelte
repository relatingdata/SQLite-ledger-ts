<script lang="ts">
  import type { Paginator } from '$lib/pagination';
  import PageButtons from '$lib/PageButtons.svelte';

  let { paginator }: { paginator: Paginator<unknown> } = $props();
</script>

{#if $paginator.showPager}
  <PageButtons
    page={$paginator.page}
    totalPages={$paginator.totalPages}
    isFirstPage={$paginator.isFirstPage}
    isLastPage={$paginator.isLastPage}
    go={(to) => paginator[to]()}
    previousLabel="Newer"
    nextLabel="Older"
  />
{/if}
