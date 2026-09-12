<script lang="ts">
  import { listContactPersonTypes, getTypedContactPersons, setTypedContactPerson, deleteTypedContactPerson, type ContactPerson } from '$lib/api';
  import { translations } from '$lib/state.svelte';
  import TypedList from '$lib/components/TypedList.svelte';

  let { entityName }: { entityName: string } = $props();
</script>

<TypedList
  {entityName}
  kindLabel="Contacts"
  typeField="contact_type"
  emptyText="No contacts yet — click here and press Insert to add one."
  newTypePlaceholder="e.g. Store Man, Dispatch, Help Desk"
  listTypes={listContactPersonTypes}
  getItems={getTypedContactPersons}
  save={(name, type, values) =>
    setTypedContactPerson(name, type, {
      name: String(values.name ?? '').trim(),
      phone: (values.phone as string) || null,
      email: (values.email as string) || null,
    })}
  remove={deleteTypedContactPerson}
  canSave={(values) => !!String(values.name ?? '').trim()}
  initialValues={() => ({ name: '', phone: '', email: '' })}
>
  {#snippet form({ values, setFirstField })}
    <label class="field-label" for="cp-name-{entityName}">{translations.current['Name'] ?? 'Name'}</label>
    <input
      id="cp-name-{entityName}"
      {@attach (el) => setFirstField(el)}
      value={String(values.name ?? '')}
      oninput={(e) => (values.name = e.currentTarget.value)}
      placeholder="e.g. Jordan Reyes, or Help Desk"
    />
    <div class="row-2">
      <input value={String(values.phone ?? '')} oninput={(e) => (values.phone = e.currentTarget.value)} placeholder={translations.current['Phone'] ?? 'Phone'} />
      <input value={String(values.email ?? '')} oninput={(e) => (values.email = e.currentTarget.value)} placeholder={translations.current['Email (optional)'] ?? 'Email (optional)'} />
    </div>
  {/snippet}
  {#snippet display(p)}
    <div>{p.name ? (translations.current[p.name] ?? p.name) : ''}</div>
    {#if p.phone}<div>{p.phone}</div>{/if}
    {#if p.email}<div>{p.email}</div>{/if}
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
</style>
