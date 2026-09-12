<script lang="ts">
  import { translations } from '$lib/state.svelte';
  let { title, description = '' }: { title: string; description?: string } = $props();
</script>

<svelte:head><title>{translations.current[title] ?? title}</title></svelte:head>

<fieldset class="page-title placeholder">
  <legend>{translations.current[title] ?? title}</legend>
  <div class="watermark">{translations.current['NOT IMPLEMENTED CURRENTLY'] ?? 'NOT IMPLEMENTED CURRENTLY'}</div>
  {#if description}<p class="intro">{translations.current[description] ?? description}</p>{/if}
  <p class="note">
    {translations.current["This screen exists in the original SQL-Ledger. It's shown here as a placeholder in the menu so the full shape of the application is visible — nothing on this page is functional yet."] ?? "This screen exists in the original SQL-Ledger. It's shown here as a placeholder in the menu so the full shape of the application is visible — nothing on this page is functional yet."}
  </p>
</fieldset>

<style>
  .placeholder {
    position: relative;
    border-style: dashed;
    overflow: hidden;
  }

  .watermark {
    position: absolute;
    top: 45%;
    left: 50%;
    transform: translate(-50%, -50%) rotate(-18deg);
    font-size: 2.4rem;
    font-weight: 800;
    letter-spacing: 0.06em;
    color: var(--ink-soft);
    opacity: 0.12;
    white-space: nowrap;
    pointer-events: none;
    user-select: none;
  }

  .note {
    position: relative;
    color: var(--ink-soft);
    max-width: 60ch;
    font-size: var(--font-size-base);
    margin-top: 1rem;
  }
</style>
