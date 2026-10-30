<script lang="ts">
  import { getTypedAddresses, setTypedAddress, deleteTypedAddress, listAddressTypes, type TypedAddress } from '$lib/api';
  import { translations } from '$lib/state.svelte';
  import TypedList from '$lib/components/TypedList.svelte';

  let { entityName }: { entityName: string } = $props();

  // Combined address box, split across address_line1/2 — see docs/pm-frontend-reference.md.
  function combinedLines(a: TypedAddress): string {
    return [a.address_line1, a.address_line2].filter(Boolean).join('\n');
  }
</script>

<TypedList
  {entityName}
  kindLabel="Addresses"
  typeField="address_type"
  emptyText="No addresses yet — click here and press Insert to add one."
  newTypePlaceholder="e.g. Head Office, Warehouse, Site Office"
  listTypes={listAddressTypes}
  getItems={getTypedAddresses}
  save={(name, type, values) => {
    const lines = String(values.lines ?? '').split('\n');
    return setTypedAddress(name, {
      address_type: type,
      business_name: (values.businessName as string) || null,
      address_line1: lines[0] || null,
      address_line2: lines.slice(1).join('\n') || null,
      city: (values.city as string) || null,
      region: (values.region as string) || null,
      postal_code: (values.postal as string) || null,
      country: (values.country as string) || null,
    });
  }}
  remove={deleteTypedAddress}
  canSave={(values) => !!String(values.lines ?? '').trim()}
  initialValues={() => ({ businessName: '', lines: '', city: '', region: '', postal: '', country: '' })}
>
  {#snippet form({ values, setFirstField })}
    <label class="field-label" for="addr-business-{entityName}">Business / company name</label>
    <input
      id="addr-business-{entityName}"
      {@attach (el) => setFirstField(el)}
      value={String(values.businessName ?? '')}
      oninput={(e) => (values.businessName = e.currentTarget.value)}
      placeholder="e.g. Acme Pty Ltd — leave blank if this is a personal address"
    />
    <label class="field-label" for="addr-lines-{entityName}">Building &amp; Street Address</label>
    <textarea
      id="addr-lines-{entityName}"
      value={String(values.lines ?? '')}
      oninput={(e) => (values.lines = e.currentTarget.value)}
      rows="2"
      placeholder="e.g. Unit 4, 42 Market Street"
    ></textarea>
    <div class="row-2">
      <input value={String(values.city ?? '')} oninput={(e) => (values.city = e.currentTarget.value)} placeholder={translations.current['City'] ?? 'City'} />
      <input value={String(values.region ?? '')} oninput={(e) => (values.region = e.currentTarget.value)} placeholder="Region / State" />
    </div>
    <div class="row-2">
      <input value={String(values.postal ?? '')} oninput={(e) => (values.postal = e.currentTarget.value)} placeholder={translations.current['Postal code'] ?? 'Postal code'} />
      <input value={String(values.country ?? '')} oninput={(e) => (values.country = e.currentTarget.value)} placeholder={translations.current['Country'] ?? 'Country'} />
    </div>
  {/snippet}
  {#snippet display(a)}
    {#if a.business_name}<div><strong>{a.business_name}</strong></div>{/if}
    {#each combinedLines(a).split('\n') as line}<div>{line}</div>{/each}
    <div>{[a.city, a.region, a.postal_code].filter(Boolean).join(', ')}</div>
    {#if a.country}<div>{a.country}</div>{/if}
  {/snippet}
</TypedList>

<style>
  .field-label {
    font-size: var(--font-size-small);
    color: var(--ink-soft);
    margin-bottom: -0.2rem;
    display: block;
  }
  .row-2 {
    display: flex;
    gap: 0.6rem;
    margin-top: 0.4rem;
  }
  .row-2 > * {
    flex: 1;
  }
  textarea {
    font-family: inherit;
    font-size: var(--font-size-medium);
    padding: 0.3rem 0.4rem;
    border: 1px solid var(--rule);
    border-radius: 4px;
    resize: vertical;
    width: 100%;
  }
</style>
