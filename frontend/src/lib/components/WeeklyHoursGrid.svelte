<script lang="ts">
  import { translations } from '$lib/state.svelte';
  let {
    lines = $bindable([]),
    fromLabel = 'From',
    toLabel = 'To',
  }: {
    lines?: { day: string; from_time: string; to_time: string }[];
    fromLabel?: string;
    toLabel?: string;
  } = $props();

  const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  // Local per-day working copy, all 7 days — see docs/pm-frontend-reference.md.
  let days = $state(
    DAY_NAMES.map((name) => {
      const existing = lines.find((l) => l.day === name);
      return { name, on: !!existing, from_time: existing?.from_time ?? '09:00', to_time: existing?.to_time ?? '17:00' };
    })
  );

  function emit() {
    lines = days.filter((d) => d.on).map((d) => ({ day: d.name, from_time: d.from_time, to_time: d.to_time }));
  }
</script>

<div class="weekly-grid">
  <div class="grid-header">
    <span></span>
    <span>{fromLabel}</span>
    <span>{toLabel}</span>
  </div>
  {#each days as d}
    <div class="grid-row" class:off={!d.on}>
      <label class="day-toggle">
        <input type="checkbox" bind:checked={d.on} onchange={emit} />
        {translations.current[d.name] ?? d.name}
      </label>
      <input type="time" bind:value={d.from_time} onchange={emit} disabled={!d.on} />
      <input type="time" bind:value={d.to_time} onchange={emit} disabled={!d.on} />
    </div>
  {/each}
</div>

<style>
  .weekly-grid {
    display: flex;
    flex-direction: column;
    gap: 0.2rem;
    font-size: var(--font-size-medium);
  }
  .grid-header {
    display: grid;
    grid-template-columns: 120px 1fr 1fr;
    gap: 0.5rem;
    font-size: var(--font-size-small);
    color: var(--ink-soft);
    padding: 0 0.2rem;
  }
  .grid-row {
    display: grid;
    grid-template-columns: 120px 1fr 1fr;
    gap: 0.5rem;
    align-items: center;
    padding: 0.2rem;
    border-radius: 4px;
  }
  .grid-row.off {
    opacity: 0.55;
  }
  .day-toggle {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    font-weight: normal;
  }
  .day-toggle input[type='checkbox'] {
    width: 1rem;
    flex-shrink: 0;
  }
  .grid-row input[type='time'] {
    width: 100%;
    padding: 0.15rem 0.3rem;
    border: 1px solid var(--rule);
    border-radius: 4px;
  }
</style>
