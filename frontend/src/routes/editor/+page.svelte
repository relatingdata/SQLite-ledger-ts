<script lang="ts">
  // The generic entity editor — see docs/pm-frontend-reference.md for
  // the full design of the sections below.
  import { onMount } from 'svelte';
  import {
    getEntityTree,
    createEntity,
    createProvider,
    createCustomer,
    supersedeEntity,
    revokeEntity,
    getContact,
    setContact,
    getHierarchyLinksPointingAt,
    ApiError,
    type EntityNode,
    type Contact,
    type HierarchyLinkPointingAt,
  } from '$lib/api';
  import { translations } from '$lib/state.svelte';
  import { hasUnsavedEdit } from '$lib/state.svelte';
  import AddressList from '$lib/components/AddressList.svelte';
  import PhoneList from '$lib/components/PhoneList.svelte';
  import ContactList from '$lib/components/ContactList.svelte';

  let entities: EntityNode[] = $state([]);

  // Memoized id -> entity map, fixing an O(n)-per-row perf bug — see
  // docs/pm-frontend-reference.md.
  let entitiesById = $derived.by(() => new Map(entities.map((e) => [e.id, e])));

  // Excludes Vocabulary's childless children from the parent/relation
  // picker (not the whole subtree) — see docs/pm-frontend-reference.md.
  let parentableEntities = $derived.by(() => {
    const vocab = entities.find((e) => e.name === 'Vocabulary');
    if (!vocab) return entities;
    const hasOwnChildren = new Set(entities.filter((e) => e.parent_id != null).map((e) => e.parent_id));
    const excludedIds = new Set<number>([vocab.id]);
    for (const e of entities) {
      if (e.parent_id === vocab.id && !hasOwnChildren.has(e.id)) excludedIds.add(e.id);
    }
    return entities.filter((e) => !excludedIds.has(e.id));
  });
  let loading = $state(true);
  let error = $state('');

  let selectedId: number | null = $state(null);
  let editName = $state('');
  let editParent = $state('');
  let editRelation = $state('');
  let editAccountnumber = $state('');
  let saving = $state(false);
  // Re-parent guard rail (§5) — see docs/pm-frontend-reference.md.
  let originalParent = $state('');
  let originalName = $state('');
  let originalRelation = $state('');
  let originalAccountnumber = $state('');

  // Opts into the shared Esc-with-warning mechanism ($lib/dirty-state).
  $effect(() => {
    hasUnsavedEdit.set(
      selectedId != null && (editName !== originalName || editParent !== originalParent || editRelation !== originalRelation || editAccountnumber !== originalAccountnumber)
    );
  });

  // Fields that still live directly on the contact record — see docs/pm-frontend-reference.md.
  let contact: Pick<Contact, 'email' | 'payment_terms_days' | 'reminder_level' | 'preferred_language'> = $state({
    email: null,
    payment_terms_days: null,
    reminder_level: 0,
    preferred_language: null,
  });
  let savingContact = $state(false);

  // "Why is this here" trail guard rail (§5) — see docs/pm-frontend-reference.md.
  let hierarchyLinksIn: HierarchyLinkPointingAt[] = $state([]);

  let newName = $state('');
  let newParent = $state('');
  let newRelation = $state('');
  let newAccountnumber = $state('');
  let creating = $state(false);

  // Insert/Enter/Escape/Delete on the entity list itself — see
  // docs/pm-frontend-reference.md. Deliberately a plain, transient
  // `$state` flag, never wired into `hasUnsavedEdit`: that mechanism (the
  // $effect above, and +layout.svelte's global Escape-with-confirm
  // handler) exists specifically to warn before abandoning a real edit to
  // an already-persisted entity — a freshly-opened, still-empty "New
  // entity" form has nothing real to lose, so it gets its own, local,
  // silent Escape instead (stopPropagation, same as every other
  // converted screen's inline-add form).
  let insertingEntity = $state(false);

  function openInsertEntity() {
    insertingEntity = true;
  }

  function closeInsertEntity() {
    insertingEntity = false;
  }

  function selectRow(e: MouseEvent | KeyboardEvent, entity: EntityNode) {
    select(entity);
    (e.currentTarget as HTMLElement)?.focus();
  }

  // Scoped to the list's own toolbar div, target-tag-filtered the same
  // way every other converted screen's handler is, so typing in the Edit
  // or New-entity forms' own inputs/selects never fires these.
  function handleListKeydown(e: KeyboardEvent) {
    const target = e.target as HTMLElement;
    if (target.tagName === 'INPUT' || target.tagName === 'SELECT' || target.tagName === 'TEXTAREA') return;
    if (e.key === 'Insert') {
      e.preventDefault();
      openInsertEntity();
    } else if (e.key === 'Delete' && selectedId != null) {
      e.preventDefault();
      removeSelected();
    }
  }

  // Duplicate-intent guard rail (§5) — see docs/pm-frontend-reference.md.
  function normalizeForDuplicateCheck(name: string): string {
    return name.trim().toLowerCase().replace(/[\s\-–—.,'’]+/g, ' ').trim();
  }
  let possibleDuplicate = $derived.by(() => {
    if (!newName.trim()) return null;
    const normalizedNew = normalizeForDuplicateCheck(newName);
    return entities.find((e) => normalizeForDuplicateCheck(e.name) === normalizedNew) ?? null;
  });

  async function load() {
    loading = true;
    try {
      entities = await getEntityTree();
    } catch (e) {
      error = e instanceof ApiError ? e.message : 'Failed to load.';
    } finally {
      loading = false;
    }
  }

  onMount(load);

  async function select(e: EntityNode) {
    selectedId = e.id;
    editName = e.name;
    editParent = entities.find((p) => p.id === e.parent_id)?.name ?? '';
    originalParent = editParent;
    originalName = editName;
    editRelation = entities.find((p) => p.id === e.relation_id)?.name ?? '';
    originalRelation = editRelation;
    editAccountnumber = e.accountnumber ?? '';
    originalAccountnumber = editAccountnumber;
    error = '';
    hierarchyLinksIn = [];
    try {
      hierarchyLinksIn = await getHierarchyLinksPointingAt(e.id);
    } catch {
      /* the trail is a real, helpful extra, not a blocking requirement — leave it empty if it fails to load */
    }
    try {
      const loaded = await getContact(e.name);
      contact = {
        email: loaded?.email ?? null,
        payment_terms_days: loaded?.payment_terms_days ?? null,
        reminder_level: loaded?.reminder_level ?? 0,
        preferred_language: loaded?.preferred_language ?? null,
      };
    } catch {
      /* contact is optional; leave the blank form if it fails to load */
    }
  }

  async function saveContact() {
    if (selectedId == null) return;
    savingContact = true;
    error = '';
    try {
      // setContact is a full replace, not a partial merge — see docs/pm-frontend-reference.md.
      await setContact(editName, contact);
    } catch (e) {
      error = e instanceof ApiError ? e.message : 'Could not save contact.';
    } finally {
      savingContact = false;
    }
  }

  function nameFor(id: number | null): string {
    if (id == null) return '—';
    return entitiesById.get(id)?.name ?? '—';
  }

  async function saveEdit() {
    if (selectedId == null) return;
    // Re-parent confirmation (§5) — see docs/pm-frontend-reference.md.
    if (editParent !== originalParent) {
      const proceed = confirm(
        `Move "${editName}" from "${originalParent || '(no parent)'}" to "${editParent || '(no parent)'}"?\n\nThis changes ${editName}'s own, real, structural position — everything reported under its old parent will no longer include it, and everything under its new parent will.`
      );
      if (!proceed) return;
    }
    saving = true;
    error = '';
    try {
      await supersedeEntity(selectedId, {
        name: editName,
        parent: editParent || null,
        relation: editRelation || null,
        accountnumber: editAccountnumber || null,
      });
      await load();
      const updated = entities.find((e) => e.id === selectedId);
      if (updated) select(updated);
    } catch (e) {
      error = e instanceof ApiError ? e.message : 'Could not save.';
    } finally {
      saving = false;
    }
  }

  async function removeSelected() {
    if (selectedId == null) return;
    if (!confirm(`Delete "${editName}"? This cannot be undone.`)) return;
    error = '';
    try {
      await revokeEntity(selectedId);
      selectedId = null;
      await load();
    } catch (e) {
      error = e instanceof ApiError ? e.message : 'Could not delete.';
    }
  }

  async function createNew() {
    if (!newName.trim()) return;
    // Duplicate-intent confirmation (§5) — see docs/pm-frontend-reference.md.
    if (possibleDuplicate) {
      const proceed = confirm(
        `"${translations.current[possibleDuplicate.name] ?? possibleDuplicate.name}" already exists${possibleDuplicate.parent_id != null ? ` (under "${nameFor(possibleDuplicate.parent_id)}")` : ''}. Did you mean to link to it instead, via Relation, rather than creating a new, separate entity?\n\nCreate "${newName}" as a new, separate entity anyway?`
      );
      if (!proceed) return;
    }
    creating = true;
    error = '';
    try {
      // Routes to createProvider/createCustomer, not plain createEntity — see docs/pm-frontend-reference.md.
      if (newParent === 'Accounts Payable' && !newRelation) {
        await createProvider(newName, 'Create Provider');
      } else if (newParent === 'Customers' && !newRelation) {
        await createCustomer(newName, 'Create Customer');
      } else {
        await createEntity({
          name: newName,
          parent: newParent || null,
          relation: newRelation || null,
          accountnumber: newAccountnumber || null,
        });
      }
      newName = '';
      newAccountnumber = '';
      insertingEntity = false;
      await load();
    } catch (e) {
      error = e instanceof ApiError ? e.message : 'Could not create.';
    } finally {
      creating = false;
    }
  }

  // The new-entity form's own, local Escape — stopPropagation so it never
  // also bubbles into +layout.svelte's global, hasUnsavedEdit-gated
  // handler (which must stay reserved for real edits to an existing,
  // persisted entity, per docs/pm-frontend-reference.md).
  function onNewEntityKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter') {
      e.preventDefault();
      createNew();
    } else if (e.key === 'Escape') {
      e.stopPropagation();
      closeInsertEntity();
      newName = '';
      newAccountnumber = '';
    }
  }

  // The Edit form's own Enter-to-save. Escape is deliberately left
  // unhandled here, so it bubbles up untouched into +layout.svelte's
  // existing, global hasUnsavedEdit warning — unchanged behavior.
  function onEditFormKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter') {
      e.preventDefault();
      saveEdit();
    }
  }
</script>

<svelte:head><title>{translations.current['Structured Editor'] ?? 'Structured Editor'}</title></svelte:head>

<fieldset class="page-title">
  <legend>{translations.current['Structured Editor'] ?? 'Structured Editor'}</legend>
  <p class="intro">{translations.current['Create, rename, reparent, or change the relation of any entity directly. Parent is the real hierarchy position; relation is the separate lateral reference (e.g. a category pointing at which report it belongs to).'] ?? 'Create, rename, reparent, or change the relation of any entity directly. Parent is the real hierarchy position; relation is the separate lateral reference (e.g. a category pointing at which report it belongs to).'}</p>
</fieldset>

{#if error}<p class="error">{error}</p>{/if}

{#if loading}
  <p>Loading…</p>
{:else}
  <div class="layout">
    <div
      class="card list"
      role="toolbar"
      tabindex="0"
      aria-describedby="editor-list-hint"
      aria-keyshortcuts="Insert Delete"
      onkeydown={handleListKeydown}
    >
      <table>
        <thead>
          <tr>
            <th>{translations.current['Name'] ?? 'Name'}</th>
            <th>{translations.current['Parent'] ?? 'Parent'}</th>
            <th>{translations.current['Relation'] ?? 'Relation'}</th>
          </tr>
        </thead>
        <tbody>
          {#each entities as e (e.id)}
            <tr
              tabindex="0"
              class:selected={selectedId === e.id}
              onclick={(ev) => selectRow(ev, e)}
              onkeydown={(ev) => { if (ev.key === 'Enter') selectRow(ev, e); }}
            >
              <td style="padding-left: {0.7 + e.depth * 0.9}rem">{translations.current[e.name] ?? e.name}</td>
              <td class="muted">{nameFor(e.parent_id)}</td>
              <td class="muted">{nameFor(e.relation_id)}</td>
            </tr>
          {/each}
        </tbody>
      </table>
      <p class="keyboard-hint" id="editor-list-hint">
        {translations.current['Insert adds a new entity. Delete removes the selected one.'] ?? 'Insert adds a new entity. Delete removes the selected one.'}
      </p>
    </div>

    <div class="side">
      {#if selectedId != null}
        <div class="card form-card" onkeydown={onEditFormKeydown}>
          <h3>{translations.current['Edit'] ?? 'Edit'}</h3>
          <fieldset>
            <legend>{translations.current['Name'] ?? 'Name'}</legend>
            <input bind:value={editName} disabled={saving} />
          </fieldset>
          <fieldset>
            <legend>{translations.current['Parent'] ?? 'Parent'}</legend>
            <select bind:value={editParent} disabled={saving}>
              <option value="">— none —</option>
              {#each parentableEntities as e}
                <option value={translations.current[e.name] ?? e.name}>{translations.current[e.name] ?? e.name}</option>
              {/each}
            </select>
          </fieldset>
          <fieldset>
            <legend>{translations.current['Relation'] ?? 'Relation'}</legend>
            <select bind:value={editRelation} disabled={saving}>
              <option value="">— none —</option>
              {#each parentableEntities as e}
                <option value={translations.current[e.name] ?? e.name}>{translations.current[e.name] ?? e.name}</option>
              {/each}
            </select>
          </fieldset>
          <fieldset>
            <legend>{translations.current['Account Number'] ?? 'Account number'}</legend>
            <input bind:value={editAccountnumber} placeholder="optional" disabled={saving} />
          </fieldset>
          <p class="keyboard-hint">
            {translations.current['Enter saves changes. Delete (on the list) removes this entity.'] ?? 'Enter saves changes. Delete (on the list) removes this entity.'}
          </p>
          {#if hierarchyLinksIn.length > 0}
            <p class="hint hierarchy-trail">
              <strong>{translations.current['Reached via a hierarchy link by:'] ?? 'Reached via a hierarchy link by:'}</strong>
              {#each hierarchyLinksIn as link}
                <br />"{link.entityName}" ({link.hierarchyName})
              {/each}
            </p>
          {/if}
        </div>

        <div class="card form-card">
          <h3>{translations.current['Contact details'] ?? 'Contact details'}</h3>
          {#key editName}
            <AddressList entityName={editName} />
            <PhoneList entityName={editName} />
            <ContactList entityName={editName} />
          {/key}
          <fieldset>
            <legend>{translations.current['Email'] ?? 'Email'}</legend>
            <input bind:value={contact.email} placeholder="optional" />
          </fieldset>
          <fieldset>
            <legend>{translations.current['Payment terms (days)'] ?? 'Payment terms (days)'}</legend>
            <input
              type="number"
              min="0"
              bind:value={contact.payment_terms_days}
              placeholder="e.g. 30 — leave blank if not yet set"
            />
          </fieldset>
          <p class="hint">
            0 means cash only (due on receipt). A real term (e.g. 30) means aging reports will bucket this account at
            30/60/90 days — the buckets are always 1x/2x/3x this number, since that's how account management practice
            actually varies per customer or provider.
          </p>
          <button class="btn" onclick={saveContact} disabled={savingContact}>
            {savingContact ? 'Saving…' : (translations.current['Save'] ?? 'Save')}
          </button>
        </div>
      {/if}

      {#if insertingEntity}
        <div class="card form-card" onkeydown={onNewEntityKeydown}>
          <h3>{translations.current['New'] ?? 'New'} entity</h3>
          <fieldset>
            <legend>{translations.current['Name'] ?? 'Name'}</legend>
            <input bind:value={newName} placeholder="e.g. Gamma LLC" disabled={creating} />
          </fieldset>
          {#if possibleDuplicate}
            <p class="hint hierarchy-trail">
              <strong>{translations.current['Already exists:'] ?? 'Already exists:'}</strong>
              "{translations.current[possibleDuplicate.name] ?? possibleDuplicate.name}"{possibleDuplicate.parent_id != null ? ` (${translations.current['under'] ?? 'under'} "${nameFor(possibleDuplicate.parent_id)}")` : ''} —
              {translations.current['did you mean to link to it via Relation instead?'] ?? 'did you mean to link to it via Relation instead?'}
            </p>
          {/if}
          <fieldset>
            <legend>{translations.current['Parent'] ?? 'Parent'}</legend>
            <select bind:value={newParent} disabled={creating}>
              <option value="">— none —</option>
              {#each parentableEntities as e}
                <option value={translations.current[e.name] ?? e.name}>{translations.current[e.name] ?? e.name}</option>
              {/each}
            </select>
          </fieldset>
          <fieldset>
            <legend>{translations.current['Relation'] ?? 'Relation'}</legend>
            <select bind:value={newRelation} disabled={creating}>
              <option value="">— none —</option>
              {#each parentableEntities as e}
                <option value={translations.current[e.name] ?? e.name}>{translations.current[e.name] ?? e.name}</option>
              {/each}
            </select>
          </fieldset>
          <fieldset>
            <legend>{translations.current['Account Number'] ?? 'Account number'}</legend>
            <input bind:value={newAccountnumber} placeholder="optional" disabled={creating} />
          </fieldset>
          <p class="keyboard-hint">
            {translations.current['Enter creates this entity. Escape cancels.'] ?? 'Enter creates this entity. Escape cancels.'}
          </p>
        </div>
      {/if}
    </div>
  </div>
{/if}

<style>
  .intro {
    color: var(--ink-soft);
    max-width: 70ch;
    margin-bottom: 1.2rem;
  }

  .layout {
    display: grid;
    grid-template-columns: 2fr 1fr;
    gap: 1.2rem;
    align-items: start;
  }

  @media (max-width: 800px) {
    .layout {
      grid-template-columns: 1fr;
    }
  }

  .list {
    max-height: 70vh;
    overflow-y: auto;
  }

  tbody tr {
    cursor: pointer;
  }

  tbody tr:hover {
    background: var(--paper-raised);
  }

  tbody tr.selected {
    background: rgba(169, 129, 47, 0.12);
  }

  .muted {
    color: var(--ink-soft);
  }

  .side {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .form-card {
    padding: 1.1rem 1.2rem 1.3rem;
    display: flex;
    flex-direction: column;
    gap: 0.7rem;
  }

  .form-card h3 {
    margin: 0;
  }

  .keyboard-hint {
    font-size: var(--font-size-small);
    color: var(--ink-soft);
    margin: 0.2rem 0 0;
  }

  .hint {
    font-size: var(--font-size-small);
    color: var(--ink-soft);
    margin: -0.4rem 0 0.2rem;
  }

  .hierarchy-trail {
    background: var(--paper-dim, #f2ede1);
    border-radius: 4px;
    padding: 0.5rem 0.7rem;
    margin-top: 0.2rem;
  }

  .hierarchy-trail strong {
    color: var(--brass-dark);
  }
</style>
