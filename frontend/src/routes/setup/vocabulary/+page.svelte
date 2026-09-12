<script lang="ts">
  import { onMount } from 'svelte';
  import { session } from '$lib/state.svelte';
  import { auth } from '$lib/state.svelte';
  import { translations } from '$lib/state.svelte';
  import {
    getConceptsWithAlternates,
    setVocabularyPreference,
    deleteVocabularyPreference,
    getEntityTree,
    ApiError,
    type ConceptWithAlternates,
    type EntityNode,
  } from '$lib/api';

  let concepts: ConceptWithAlternates[] = [];
  let loading = true;
  let error = '';
  let saving = '';

  // The real, current business's own real, structural entity id —
  // needed as the real, direct scope_id for a real, business-level
  // preference. Resolved once, from the already-available entity
  // tree, rather than adding a real, new, separate endpoint just for
  // this one, real lookup.
  let businessId: number | null = null;

  // A real, direct, per-concept selection state — defaults to
  // whichever real, alternate word this business already, currently
  // sees (resolved via translations.current, the exact, same, real, live
  // source every other page already reads), so the form opens
  // already, correctly reflecting the real, current choice, not a
  // blank one.
  let selected: Record<string, string> = {};

  async function load() {
    loading = true;
    error = '';
    try {
      const [loadedConcepts, tree] = await Promise.all([getConceptsWithAlternates(), getEntityTree()]);
      concepts = loadedConcepts;
      businessId = tree.find((e: EntityNode) => e.name === session.current?.businessName)?.id ?? null;
      for (const c of concepts) {
        // The real, currently-effective word, for this real concept,
        // as this business already sees it today — resolved from
        // translations.current against the real, known defaultAlternate
        // (the one, real, stable key any real preference actually
        // overwrites), then matched back to whichever real alternate
        // currently produces that same, real, resolved text.
        const currentlyShown = translations.current[c.defaultAlternate] ?? c.defaultAlternate;
        selected[c.headerAccountName] = c.alternates.find((a) => (translations.current[a] ?? a) === currentlyShown) ?? c.defaultAlternate;
      }
      selected = selected;
    } catch (e) {
      error = e instanceof ApiError ? e.message : 'Failed to load.';
    } finally {
      loading = false;
    }
  }

  onMount(load);

  async function save(concept: ConceptWithAlternates) {
    if (businessId == null) return;
    saving = concept.headerAccountName;
    error = '';
    try {
      // Choosing the real, original default word back is a real,
      // direct "reset to default" — removing the preference entirely,
      // rather than leaving a real, redundant override row saying
      // the same thing the default already would.
      if (selected[concept.headerAccountName] === concept.defaultAlternate) {
        await deleteVocabularyPreference(concept.defaultAlternate, 'business', businessId);
      } else {
        await setVocabularyPreference(concept.defaultAlternate, 'business', businessId, selected[concept.headerAccountName]);
      }
      // A real, live, direct confirmation this actually took: reload
      // the real, current translations, the exact, same, real way the
      // whole app already does on login/business change.
      window.location.reload();
    } catch (e) {
      error = e instanceof ApiError ? e.message : 'Could not save.';
      saving = '';
    }
  }
</script>

<svelte:head><title>{translations.current['Vocabulary'] ?? 'Vocabulary'}</title></svelte:head>

<fieldset class="page-title">
  <legend>{translations.current['Vocabulary'] ?? 'Vocabulary'}</legend>
  <p class="intro">
    {translations.current['Some real, business concepts already have more than one, real, valid English name — pick which one this business prefers to see everywhere, not just in the menu.'] ??
      'Some real, business concepts already have more than one, real, valid English name — pick which one this business prefers to see everywhere, not just in the menu.'}
  </p>
{#if error}<p class="error">{error}</p>{/if}

{#if loading}
  <p class="center-text">Loading…</p>
{:else if concepts.length === 0}
  <p class="empty">{translations.current['No real concept currently has more than one, known, alternate name.'] ?? 'No real concept currently has more than one, known, alternate name.'}</p>
{:else}
  <div class="cards">
    {#each concepts as concept}
      <div class="card concept-card">
        <h3>{concept.headerAccountName}</h3>
        <p class="hint">
          {translations.current['Known, real, alternate words for this concept:'] ?? 'Known, real, alternate words for this concept:'}
          {concept.alternates.join(', ')}
        </p>
        <fieldset>
          <legend>{translations.current['This business prefers:'] ?? 'This business prefers:'}</legend>
          <select value={selected[concept.headerAccountName]} onchange={(e) => { selected[concept.headerAccountName] = e.currentTarget.value; selected = selected; }}>
            {#each concept.alternates as alternate}
              <option value={alternate}>{translations.current[alternate] ?? alternate}</option>
            {/each}
          </select>
        </fieldset>
        <button class="btn" onclick={() => save(concept)} disabled={saving === concept.headerAccountName}>
          {saving === concept.headerAccountName ? 'Saving…' : (translations.current['Save'] ?? 'Save')}
        </button>
      </div>
    {/each}
  </div>
{/if}

</fieldset>
<style>
  .center-text {
    text-align: center;
  }
  .intro {
    color: var(--ink-soft);
    max-width: 70ch;
    margin: 0 auto 1.2rem;
    text-align: center;
  }
  .empty {
    text-align: center;
    color: var(--ink-soft);
    font-style: italic;
  }
  .cards {
    display: flex;
    flex-wrap: wrap;
    gap: 1rem;
    justify-content: center;
  }
  .concept-card {
    padding: 1.1rem 1.2rem 1.3rem;
    width: 320px;
    display: flex;
    flex-direction: column;
    gap: 0.6rem;
  }
  .concept-card h3 {
    margin: 0;
  }
  .hint {
    font-size: var(--font-size-small);
    color: var(--ink-soft);
    margin: 0;
  }
</style>
