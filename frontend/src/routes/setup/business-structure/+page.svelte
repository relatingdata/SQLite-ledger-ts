<script lang="ts">
  // Standalone Configuration entry point for the Business Structure
  // popup (see docs/pm-frontend-reference.md's "Business Structure
  // popup" section) — reachable any time, not just right after
  // creating a business from new-business/+page.svelte, which opens
  // the exact same component inline.
  import { session, translations } from '$lib/state.svelte';
  import BusinessStructurePopup from '$lib/components/BusinessStructurePopup.svelte';

  let showPopup = $state(true);
</script>

<svelte:head><title>{translations.current['Business Structure'] ?? 'Business Structure'}</title></svelte:head>

<fieldset class="page-title">
  <legend>{translations.current['Business Structure'] ?? 'Business Structure'}</legend>
  {#if !session.current}
    <p class="center-text">{translations.current['Select a business first.'] ?? 'Select a business first.'}</p>
  {:else}
    <p class="intro">
      {translations.current['Add locations, divisions, item categories and other hierarchies to your current business, and move things between them — the same screens as Locations, Hierarchies &amp; Products and Inventory Catalog, in one graphical view.'] ??
        'Add locations, divisions, item categories and other hierarchies to your current business, and move things between them — the same screens as Locations, Hierarchies & Products and Inventory Catalog, in one graphical view.'}
    </p>
    {#if !showPopup}
      <button type="button" class="btn" onclick={() => (showPopup = true)}>{translations.current['Open'] ?? 'Open'}</button>
    {/if}
    {#if showPopup}
      <BusinessStructurePopup business={session.current.businessName} onClose={() => (showPopup = false)} />
    {/if}
  {/if}
</fieldset>
