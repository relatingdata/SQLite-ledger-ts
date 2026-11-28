<!--
  The business's locations, as the web's Locations screen
  (frontend/src/routes/locations/+page.svelte) lists them. I adds one,
  asking for the web form's fields in its order: name, city, location
  type (picked from the location types); Enter on the type creates it
  (createLocation), as the web form's Enter does, with no capacities and
  the UTC time zone, as the web form's defaults. Editing a location, its
  addresses and its currencies are web-only.
-->
<script lang="ts">
  import { Box, Text } from 'sveltui';
  import { keyboard } from 'sveltui';
  import { onDestroy } from 'svelte';
  import { ApiError, asBusinessName, createLocation, getLocationTypes, listLocations, type LocationRecord } from '../api.ts';
  import Panel from '../components/Panel.svelte';
  import TextInput from '../components/TextInput.svelte';
  import SelectList from '../components/SelectList.svelte';
  import { brass, inkSoft } from '../theme.ts';

  type Step = 'list' | 'name' | 'city' | 'type';

  let { businessName, onBack }: { businessName: string; onBack: () => void } = $props();

  let step: Step = $state('list');
  let locations: LocationRecord[] | null = $state(null);
  let types: string[] | null = $state(null);
  let name = $state('');
  let city = $state('');
  let error: string | null = $state(null);
  let message: string | null = $state(null);
  let busy = $state(false);

  async function load() {
    try {
      locations = await listLocations(asBusinessName(businessName));
    } catch (err) {
      error = err instanceof ApiError ? err.message : 'Could not load the locations.';
    }
  }
  void load();
  getLocationTypes()
    .then((rows) => (types = rows))
    .catch((err) => (error = err instanceof ApiError ? err.message : 'Could not load the location types.'));

  const unsubscribe = keyboard.on((event) => {
    if (event.key === 'Escape') {
      if (step === 'list') onBack();
      else step = 'list';
      return true;
    }
    if (step === 'list' && event.key === 'i') {
      name = '';
      city = '';
      error = null;
      message = null;
      step = 'name';
      return true;
    }
    return false;
  });
  onDestroy(unsubscribe);

  async function create(locationType: string) {
    if (busy) return;
    busy = true;
    error = null;
    step = 'list';
    try {
      await createLocation(name.trim(), businessName, {
        city: city.trim(),
        location_type: locationType,
        is_billing_address: false,
        bottle_capacity: null,
        carton_capacity: null,
        timezone: 'UTC',
      });
      message = `Created ${name.trim()}.`;
      await load();
    } catch (err) {
      error = err instanceof ApiError ? err.message : 'Could not create the location.';
    } finally {
      busy = false;
    }
  }

  const title = $derived(`Locations — ${businessName}`);
  const listText = $derived(
    (locations ?? []).length === 0
      ? 'No locations yet — press I to add one.'
      : (locations ?? []).map((l) => `  ${l.name.padEnd(28)}${(l.city ?? '').padEnd(16)}${l.location_type ?? ''}`).join('\n')
  );
</script>

<!-- Each step has a Panel of its own: content that appears inside a Panel
     that stays mounted draws blank (docs/tui-design.md, "Running on
     Svelte 5.56"). -->
{#if step === 'name'}
  <Panel title={`${title} — new location`} focused>
    <Box flexDirection="row"><Box width={10}><Text text="Name" color={brass} /></Box><TextInput bind:value={name} focused onSubmit={() => { if (name.trim()) step = 'city'; }} /></Box>
    <Text text="Enter continues · Escape cancels" color={inkSoft} dim />
  </Panel>
{:else if step === 'city'}
  <Panel title={`${title} — ${name}`} focused>
    <Box flexDirection="row"><Box width={10}><Text text="City" color={brass} /></Box><TextInput bind:value={city} focused onSubmit={() => { if (city.trim()) step = 'type'; }} /></Box>
    <Text text="Enter continues · Escape cancels" color={inkSoft} dim />
  </Panel>
{:else if step === 'type' && types}
  <Panel title={`${title} — ${name}, ${city} — location type`} focused>
    <SelectList limit={14} items={types.map((t) => ({ label: t, value: t }))} onSelect={(item) => void create(item.value)} />
    <Text text="↑/↓ move · Enter creates the location · Escape cancels" color={inkSoft} dim />
  </Panel>
{:else if step === 'type'}
  <Panel title={`${title} — ${name}, ${city} — location type`} focused>
    <Text text={error ?? 'Loading…'} color={error ? 'red' : inkSoft} />
  </Panel>
{:else if locations === null}
  <Panel title={title} focused>
    <Text text={error ?? 'Loading…'} color={error ? 'red' : inkSoft} />
  </Panel>
{:else}
  <Panel title={title} focused>
    <Text text={`  ${'Location'.padEnd(28)}${'City'.padEnd(16)}Type`} color={inkSoft} />
    <Text text={listText} />
    <Text text="I add a location · Escape back to menu" color={inkSoft} dim />
    <Text text={error ?? message ?? (busy ? 'Working…' : '')} color={error ? 'red' : inkSoft} />
  </Panel>
{/if}
