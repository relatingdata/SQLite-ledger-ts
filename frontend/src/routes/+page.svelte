<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { browser } from '$app/environment';
  import { session } from '$lib/state.svelte';
  import { auth } from '$lib/state.svelte';

  onMount(() => {
    if (browser && !session.current) goto('/session');
  });
</script>

{#if session.current}
  <fieldset class="page-title welcome">
    <legend>Welcome{auth.current ? `, ${auth.current.user.username}` : ''}</legend>
    <p class="intro">
      Choose where to go from the menu on the left.
    </p>
  </fieldset>
{/if}

<style>
  .welcome {
    display: flex;
    flex-direction: column;
    justify-content: center;
    min-height: 70vh;
    text-align: center;
  }
</style>
