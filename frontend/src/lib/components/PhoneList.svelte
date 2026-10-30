<script lang="ts">
  import { getTypedPhones, setTypedPhone, deleteTypedPhone, listPhoneTypes, type TypedPhone } from '$lib/api';
  import { translations } from '$lib/state.svelte';
  import TypedList from '$lib/components/TypedList.svelte';

  let { entityName }: { entityName: string } = $props();
</script>

<TypedList
  {entityName}
  kindLabel="Phone numbers"
  typeField="phone_type"
  emptyText="No phone numbers yet — click here and press Insert to add one."
  newTypePlaceholder="e.g. Direct Line, After Hours"
  listTypes={listPhoneTypes}
  getItems={getTypedPhones}
  save={(name, type, values) => setTypedPhone(name, type, String(values.number ?? ''), (values.businessName as string) || null)}
  remove={deleteTypedPhone}
  canSave={(values) => !!String(values.number ?? '').trim()}
  initialValues={() => ({ number: '', businessName: '' })}
>
  {#snippet form({ values, setFirstField })}
    <input
      {@attach (el) => setFirstField(el)}
      value={String(values.number ?? '')}
      oninput={(e) => (values.number = e.currentTarget.value)}
      type="tel"
      placeholder={translations.current['Number'] ?? 'Number'}
    />
    <input
      value={String(values.businessName ?? '')}
      oninput={(e) => (values.businessName = e.currentTarget.value)}
      placeholder="Business / company name (optional)"
    />
  {/snippet}
  {#snippet display(p)}
    {#if p.business_name}<strong>{p.business_name}</strong> — {/if}{p.phone}
  {/snippet}
</TypedList>
