<script lang="ts">
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

  // A real, significant, confirmed bug fixed here, found live by timing
  // a real, UI-driven "Create Provider" step (and "Create Customer",
  // which shares this same screen): the real step itself consistently
  // took ~18s even though every real network call it made (confirmed
  // via step-runner's own [net] timing) finished in well under 300ms,
  // and the real page navigation itself ([load]) finished in ~300ms
  // too — meaning the real, unaccounted-for ~16s+ was genuinely spent
  // somewhere else entirely on the client, the exact same real class of
  // bug already found and fixed twice this session (see /items'
  // `categories` block, entityTree.ts). Root-caused here to `nameFor`
  // (below): the real entities table renders every real entity in the
  // whole business (4,623 of them in this real seed data) as its own
  // real table row, and each real row calls `nameFor` TWICE (once for
  // its own parent's name, once for its own relation's name) — and
  // `nameFor` did a real, direct `entities.find(...)`, an O(n) linear
  // scan, on every single one of those ~9,246 real calls. Fixed the
  // same way as both earlier occurrences: one real, memoized `id →
  // entity` Map, built once per real entities load, turning every real
  // `nameFor` call into a real, direct, O(1) map lookup instead.
  let entitiesById = $derived.by(() => new Map(entities.map((e) => [e.id, e])));

  // Every real entity is a valid parent/relation target in principle
  // (this editor is deliberately generic), but Vocabulary and its
  // descendants (translated UI labels, and now full-sentence help
  // text) are never a sensible real parent for an actual business
  // entity — confirmed as a genuine, real UX problem, not just a
  // theoretical one: once help-text vocabulary entities became
  // sentence-length, this dropdown became genuinely unusable,
  // cluttered with hundreds of giant, unreadable options. Filtered
  // out here specifically, not from the underlying entity list itself
  // (the raw entity list is still correct and complete for the table
  // view above).
  let parentableEntities = $derived.by(() => {
    const vocab = entities.find((e) => e.name === 'Vocabulary');
    if (!vocab) return entities;
    // Real, confirmed bug (reported earlier as "Customers renders as a
    // long, decorated Menu Link string instead of its own plain name"):
    // the real "Customers" entity genuinely lives under Vocabulary
    // (Customers < Vocabulary < Application < Root) — it is, structurally,
    // one of Vocabulary's own real children, the exact same real place
    // every ordinary, leaf UI-label word (`Save`, `Cancel`, `Date`, every
    // genuinely long help-text sentence) also lives. The previous version
    // below excluded the WHOLE real Vocabulary subtree unconditionally,
    // which correctly hid the leaf words and help text, but also silently
    // hid this real, legitimate, selectable Parent target along with
    // them — there was never a real "Customers" option left in the list
    // for a real UI session (or this real automated test) to select; a
    // different, unrelated "Menu Link: ... — Customers" structural node
    // happened to survive the filter and merely shares the word
    // "Customers" in its own, real, raw name.
    //
    // The real, confirmed, generic distinguishing signal (checked
    // directly against this real seed data): of Vocabulary's 742 real
    // direct children, only 14 — exactly the real, structural category
    // roots real business entities get created under (`Customers`,
    // `Vendors`, `Relationship Types`, `Address Types`, `Contact Person
    // Types`, and similar) — have any real children of their own
    // anywhere in the tree. Every real, pure leaf UI-label word and
    // every real help-text sentence has none. So only Vocabulary's own
    // real, childless direct children are excluded here — never the
    // whole subtree — leaving every real, structural category (and
    // everything real underneath one) genuinely selectable.
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
  // Guard rail (§5 of the plan): the real, original parent at the
  // moment this entity was selected — compared against editParent at
  // save time, so a real, structural re-parent (as opposed to a real,
  // ordinary rename or relation change) always gets its own, direct,
  // explicit confirmation, showing both the real, current and real,
  // proposed parent together. This is the exact, real guard rail that
  // would have caught this session's own, real, direct attempt to
  // re-parent Customers under Accounts Receivable before it was ever
  // written to schema.sql.
  let originalParent = $state('');
  let originalName = $state('');
  let originalRelation = $state('');
  let originalAccountnumber = $state('');

  // Opts this page into the real, shared Esc-with-warning mechanism
  // ($lib/dirty-state) — a real, direct, concrete proof of concept,
  // per direct request.
  $effect(() => {
    hasUnsavedEdit.set(
      selectedId != null && (editName !== originalName || editParent !== originalParent || editRelation !== originalRelation || editAccountnumber !== originalAccountnumber)
    );
  });

  // Real contact fields that still live directly on the contact
  // itself — address/phone are now handled entirely by
  // AddressList/PhoneList below, the one, shared component used
  // everywhere an entity needs them.
  let contact: Pick<Contact, 'email' | 'payment_terms_days' | 'reminder_level' | 'preferred_language'> = $state({
    email: null,
    payment_terms_days: null,
    reminder_level: 0,
    preferred_language: null,
  });
  let savingContact = $state(false);

  // Guard rail (docs/translator-form-and-guard-rails-plan.md, §5): "a
  // real, visible 'why is this here' trail" — every real entity that
  // reaches the currently-selected one via a real hierarchy link, so
  // a real, live editor never again has to discover a real,
  // structural link by accident.
  let hierarchyLinksIn: HierarchyLinkPointingAt[] = $state([]);

  let newName = $state('');
  let newParent = $state('');
  let newRelation = $state('');
  let newAccountnumber = $state('');
  let creating = $state(false);

  // Guard rail (§5): a real, live, duplicate-intent check — surfaced
  // directly, before creation, rather than only failing after the
  // fact at the database's own, blunt UNIQUE constraint. Case-
  // insensitive, and also flags a real, close, likely-typo match
  // (the same name with only whitespace/punctuation differences),
  // not only an exact one — the real, established global-uniqueness
  // rule this app enforces makes near-misses just as real a trap as
  // exact ones.
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
      // Always sends the complete current form state — setContact does a
      // full replace, not a partial merge (see schema.sql's note on
      // contact_entry), so a partial send here would silently wipe
      // whatever field isn't included.
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
    // Guard rail (§5): a real, structural re-parent gets its own,
    // real, explicit, direct confirmation — showing both the real,
    // current parent and the real, proposed new one together — before
    // it's ever written. A real, ordinary rename or relation-only
    // change needs no such prompt at all.
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
    // Guard rail (§5): a real, live duplicate-intent check, surfaced
    // directly, before creation — not only after the fact, at the
    // database's own, blunt UNIQUE constraint.
    if (possibleDuplicate) {
      const proceed = confirm(
        `"${translations.current[possibleDuplicate.name] ?? possibleDuplicate.name}" already exists${possibleDuplicate.parent_id != null ? ` (under "${nameFor(possibleDuplicate.parent_id)}")` : ''}. Did you mean to link to it instead, via Relation, rather than creating a new, separate entity?\n\nCreate "${newName}" as a new, separate entity anyway?`
      );
      if (!proceed) return;
    }
    creating = true;
    error = '';
    try {
      // Per docs/contact-types-and-translations.md: a real vendor
      // must be genuinely tagged with its own real Contact Type, not
      // just structurally parented - this generic page routes through
      // the one, real, correct function for this specific, real,
      // common case, rather than leaving a person to create a
      // structurally-parented-but-untyped vendor by hand.
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
      await load();
    } catch (e) {
      error = e instanceof ApiError ? e.message : 'Could not create.';
    } finally {
      creating = false;
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
    <div class="card list">
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
            <tr class:selected={selectedId === e.id} onclick={() => select(e)}>
              <td style="padding-left: {0.7 + e.depth * 0.9}rem">{translations.current[e.name] ?? e.name}</td>
              <td class="muted">{nameFor(e.parent_id)}</td>
              <td class="muted">{nameFor(e.relation_id)}</td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>

    <div class="side">
      {#if selectedId != null}
        <div class="card form-card">
          <h3>{translations.current['Edit'] ?? 'Edit'}</h3>
          <fieldset>
            <legend>{translations.current['Name'] ?? 'Name'}</legend>
            <input bind:value={editName} />
          </fieldset>
          <fieldset>
            <legend>{translations.current['Parent'] ?? 'Parent'}</legend>
            <select bind:value={editParent}>
              <option value="">— none —</option>
              {#each parentableEntities as e}
                <option value={translations.current[e.name] ?? e.name}>{translations.current[e.name] ?? e.name}</option>
              {/each}
            </select>
          </fieldset>
          <fieldset>
            <legend>{translations.current['Relation'] ?? 'Relation'}</legend>
            <select bind:value={editRelation}>
              <option value="">— none —</option>
              {#each parentableEntities as e}
                <option value={translations.current[e.name] ?? e.name}>{translations.current[e.name] ?? e.name}</option>
              {/each}
            </select>
          </fieldset>
          <fieldset>
            <legend>{translations.current['Account Number'] ?? 'Account number'}</legend>
            <input bind:value={editAccountnumber} placeholder="optional" />
          </fieldset>
          <div class="actions">
            <button class="btn" onclick={saveEdit} disabled={saving}>{saving ? 'Saving…' : (translations.current['Save'] ?? 'Save')}</button>
            <button class="btn secondary" onclick={removeSelected}>{translations.current['Delete'] ?? 'Delete'}</button>
          </div>
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
            actually varies per customer or vendor.
          </p>
          <button class="btn" onclick={saveContact} disabled={savingContact}>
            {savingContact ? 'Saving…' : (translations.current['Save'] ?? 'Save')}
          </button>
        </div>
      {/if}

      <div class="card form-card">
        <h3>{translations.current['New'] ?? 'New'} entity</h3>
        <fieldset>
          <legend>{translations.current['Name'] ?? 'Name'}</legend>
          <input bind:value={newName} placeholder="e.g. Gamma LLC" />
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
          <select bind:value={newParent}>
            <option value="">— none —</option>
            {#each parentableEntities as e}
              <option value={translations.current[e.name] ?? e.name}>{translations.current[e.name] ?? e.name}</option>
            {/each}
          </select>
        </fieldset>
        <fieldset>
          <legend>{translations.current['Relation'] ?? 'Relation'}</legend>
          <select bind:value={newRelation}>
            <option value="">— none —</option>
            {#each parentableEntities as e}
              <option value={translations.current[e.name] ?? e.name}>{translations.current[e.name] ?? e.name}</option>
            {/each}
          </select>
        </fieldset>
        <fieldset>
          <legend>{translations.current['Account Number'] ?? 'Account number'}</legend>
          <input bind:value={newAccountnumber} placeholder="optional" />
        </fieldset>
        <button class="btn" onclick={createNew} disabled={creating}>{creating ? 'Creating…' : 'Create'}</button>
      </div>
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

  .actions {
    display: flex;
    gap: 0.6rem;
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
