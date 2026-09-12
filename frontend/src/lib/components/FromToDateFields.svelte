<script lang="ts">
  import { translations } from '$lib/state.svelte';

  let {
    fromDate = $bindable(),
    toDate = $bindable(),
    onchange,
  }: {
    fromDate: string;
    toDate: string;
    onchange: () => void;
  } = $props();
</script>

<fieldset>
  <legend>{translations.current['From'] ?? 'From'}</legend>
  <input type="date" bind:value={fromDate} {onchange} />
</fieldset>
<fieldset>
  <legend>{translations.current['To'] ?? 'To'}</legend>
  <input type="date" bind:value={toDate} {onchange} />
</fieldset>
