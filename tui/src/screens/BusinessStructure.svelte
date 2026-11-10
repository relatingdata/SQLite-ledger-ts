<!--
  A thin step-switcher over the three real steps the web app's own
  Business Structure popup wizard has (BusinessStructurePopup.svelte's
  STEPS array) - Org Chart (Locations/Divisions/Departments/
  Employees), Item Categories, and Other Hierarchies. The web app
  moves between them with Back/Next buttons; this TUI reuses ←/→,
  since every other arrow key is already claimed (↑/↓ move within a
  list). Escape on a step's own top-level view moves back a step,
  exactly like the web wizard's own "Back" - and, on the first step,
  leaves this screen entirely, back to the menu.
-->
<script lang="ts">
  import { keyboard } from 'sveltui';
  import { onDestroy } from 'svelte';
  import OrgChart from './OrgChart.svelte';
  import ItemCategories from './ItemCategories.svelte';
  import OtherHierarchies from './OtherHierarchies.svelte';

  const STEPS = ['org-chart', 'categories', 'hierarchies'] as const;

  let { businessName, onBack }: { businessName: string; onBack: () => void } = $props();

  let stepIndex = $state(0);

  const unsubscribe = keyboard.on((event) => {
    if (event.key === 'ArrowRight') { stepIndex = Math.min(stepIndex + 1, STEPS.length - 1); return true; }
    if (event.key === 'ArrowLeft') { stepIndex = Math.max(stepIndex - 1, 0); return true; }
    return false;
  });
  onDestroy(unsubscribe);

  function onStepBack() {
    if (stepIndex > 0) stepIndex -= 1;
    else onBack();
  }

  const step = $derived(STEPS[stepIndex]);
</script>

{#if step === 'categories'}
  <ItemCategories {businessName} onBack={onStepBack} />
{:else if step === 'hierarchies'}
  <OtherHierarchies {businessName} onBack={onStepBack} />
{:else}
  <OrgChart {businessName} onBack={onStepBack} />
{/if}
