<script lang="ts">
  import { onMount } from 'svelte';
  import { translations } from '$lib/state.svelte';
  import {
    getVocabularyWords,
    getLanguages,
    setTranslation,
    createEntity,
    setLanguageDirection,
    getLanguageDirection,
    ApiError,
    type VocabularyWord,
  } from '$lib/api';

  let words: VocabularyWord[] = $state([]);
  let languages: { id: number; name: string }[] = $state([]);
  let loading = $state(true);
  let error = $state('');
  let saving = $state('');

  let search = $state('');
  let selectedWord: VocabularyWord | null = $state(null);

  // Every real, direct edit made to the currently-selected word's own
  // translations — a real, local, plain object, one entry per real
  // language, kept separate from words itself so a real, in-progress
  // edit doesn't need to be re-derived on every keystroke.
  let editValues: Record<string, string> = $state({});

  let newLanguageName = $state('');
  let newLanguageDirection = $state<'LTR' | 'RTL'>('LTR');
  let addingLanguage = $state(false);

  let newWordName = $state('');
  let addingWord = $state(false);

  // Per direct instruction: real, direct RTL support for every real
  // language, Hebrew/Arabic included — one text-direction lookup per
  // real language, loaded once alongside the language list itself and
  // reused everywhere a translation input or a reference column is
  // shown, never a hardcoded special case for any one language.
  let languageDirections: Record<string, 'ltr' | 'rtl'> = $state({});
  async function loadLanguageDirections(langs: { id: number; name: string }[]) {
    const entries = await Promise.all(
      langs.map(async (l) => {
        try {
          const { direction } = await getLanguageDirection(l.name);
          return [l.name, direction === 'RTL' ? 'rtl' : 'ltr'] as const;
        } catch {
          return [l.name, 'ltr'] as const;
        }
      })
    );
    languageDirections = { ...languageDirections, ...Object.fromEntries(entries) };
  }

  // Per direct instruction: a real translator, working into a target
  // language they're producing, may be more fluent in some third,
  // already-translated language than in English — "reference" is
  // whichever real language they choose to read while they work,
  // falling back to the real, native English wording (now a genuine,
  // real translation row of its own, not merely implied) whenever the
  // chosen reference language doesn't have this particular word yet.
  let mode: 'single' | 'translate' = $state('single');
  let targetLanguage = $state('');
  let referenceLanguage = $state('English');

  function referenceTextFor(word: VocabularyWord): string {
    return word.translations[referenceLanguage] ?? word.translations['English'] ?? word.name;
  }

  // Keyed by concept name — only words the translator has actually,
  // genuinely touched this session get an entry; everything else
  // reads its own, real, current target text (or a real, fresh copy
  // of the reference text, per direct instruction, as a real,
  // editable starting point rather than a blank field) directly.
  let translateEdits: Record<string, string> = $state({});
  let translateSaving = $state('');

  function targetValueFor(word: VocabularyWord): string {
    return translateEdits[word.name] ?? word.translations[targetLanguage] ?? referenceTextFor(word);
  }

  async function saveTranslateRow(word: VocabularyWord) {
    if (!targetLanguage) return;
    const text = targetValueFor(word).trim();
    if (!text) return;
    translateSaving = word.name;
    error = '';
    try {
      await setTranslation(word.name, targetLanguage, text);
      word.translations[targetLanguage] = text;
      words = words;
      delete translateEdits[word.name];
      translateEdits = { ...translateEdits };
    } catch (e) {
      error = e instanceof ApiError ? e.message : 'Could not save.';
    } finally {
      translateSaving = '';
    }
  }

  async function addWord() {
    if (!newWordName.trim()) return;
    addingWord = true;
    error = '';
    try {
      await createEntity({ name: newWordName.trim(), parent: 'Vocabulary' });
      newWordName = '';
      words = await getVocabularyWords();
    } catch (e) {
      error = e instanceof ApiError ? e.message : 'Could not add word.';
    } finally {
      addingWord = false;
    }
  }

  async function load() {
    loading = true;
    error = '';
    try {
      [words, languages] = await Promise.all([getVocabularyWords(), getLanguages()]);
      await loadLanguageDirections(languages);
      if (!targetLanguage) targetLanguage = languages.find((l) => l.name !== 'English')?.name ?? '';
    } catch (e) {
      error = e instanceof ApiError ? e.message : 'Failed to load.';
    } finally {
      loading = false;
    }
  }

  onMount(load);

  let filteredWords = $derived(search.trim() ? words.filter((w) => w.name.toLowerCase().includes(search.trim().toLowerCase())) : words);
  // English is now a real, genuine translation target too, per direct
  // instruction — its own wording lives in a real translation row
  // under the real "English" Language, exactly like German or French,
  // not merely implied by a concept's own name any more. No special
  // case needed here any more either.
  let editableLanguages = $derived(languages);

  function select(word: VocabularyWord) {
    selectedWord = word;
    editValues = {};
    for (const lang of editableLanguages) {
      editValues[lang.name] = word.translations[lang.name] ?? '';
    }
  }

  async function saveTranslation(language: string) {
    if (!selectedWord) return;
    const text = editValues[language]?.trim();
    if (!text) return;
    saving = language;
    error = '';
    try {
      await setTranslation(selectedWord.name, language, text);
      // Real, direct, local update — reflects the real, just-saved
      // value immediately, without a real, full, separate reload.
      selectedWord.translations[language] = text;
      words = words;
    } catch (e) {
      error = e instanceof ApiError ? e.message : 'Could not save.';
    } finally {
      saving = '';
    }
  }

  async function addLanguage() {
    if (!newLanguageName.trim()) return;
    addingLanguage = true;
    error = '';
    try {
      await createEntity({ name: newLanguageName.trim(), parent: 'Languages' });
      await setLanguageDirection(newLanguageName.trim(), newLanguageDirection);
      newLanguageName = '';
      newLanguageDirection = 'LTR';
      languages = await getLanguages();
      await loadLanguageDirections(languages);
      if (selectedWord) select(selectedWord);
    } catch (e) {
      error = e instanceof ApiError ? e.message : 'Could not add language.';
    } finally {
      addingLanguage = false;
    }
  }
</script>

<svelte:head><title>{translations.current['Translations'] ?? 'Translations'}</title></svelte:head>

<fieldset class="page-title">
  <legend>{translations.current['Translations'] ?? 'Translations'}</legend>
  <p class="intro">
    {translations.current['Every real word or phrase this application uses, and its own, current translation into each real, existing language — add a new language below, or edit any word directly.'] ??
      'Every real word or phrase this application uses, and its own, current translation into each real, existing language — add a new language below, or edit any word directly.'}
  </p>
{#if error}<p class="error">{error}</p>{/if}

<fieldset class="mode-toggle">
  <legend>{translations.current['Mode'] ?? 'Mode'}</legend>
  <div class="mode-buttons">
    <button class="btn" class:selected={mode === 'single'} onclick={() => (mode = 'single')}>
      {translations.current['Edit one word'] ?? 'Edit one word'}
    </button>
    <button class="btn" class:selected={mode === 'translate'} onclick={() => (mode = 'translate')}>
      {translations.current['Translate between languages'] ?? 'Translate between languages'}
    </button>
  </div>
  {#if mode === 'translate'}
    <div class="translate-pickers">
      <fieldset>
        <legend>{translations.current['Reference language'] ?? 'Reference language'}</legend>
        <select bind:value={referenceLanguage}>
          {#each languages as lang}
            <option value={lang.name}>{translations.current[lang.name] ?? lang.name}</option>
          {/each}
        </select>
      </fieldset>
      <fieldset>
        <legend>{translations.current['Target language'] ?? 'Target language'}</legend>
        <select bind:value={targetLanguage}>
          {#each languages.filter((l) => l.name !== referenceLanguage) as lang}
            <option value={lang.name}>{translations.current[lang.name] ?? lang.name}</option>
          {/each}
        </select>
      </fieldset>
    </div>
  {/if}
</fieldset>

{#if loading}
  <p class="center-text">Loading…</p>
{:else if mode === 'translate'}
  <div class="layout">
    <div class="card word-list-card">
      <fieldset>
        <legend>{translations.current['Search'] ?? 'Search'}</legend>
        <input bind:value={search} placeholder="e.g. Vendor" />
      </fieldset>
      <p class="hint">{filteredWords.length} of {words.length} real words</p>
    </div>

    <div class="card translate-card">
      {#if !targetLanguage}
        <p class="hint">Choose a target language above to start translating into it.</p>
      {:else}
        <div class="translate-header">
          <span>{translations.current[referenceLanguage] ?? referenceLanguage}</span>
          <span>{translations.current[targetLanguage] ?? targetLanguage}</span>
        </div>
        <div class="translate-list">
          {#each filteredWords.slice(0, 200) as word}
            <div class="translate-row">
              <div class="reference-text" dir={languageDirections[referenceLanguage] ?? 'ltr'}>{referenceTextFor(word)}</div>
              <input
                class="target-text"
                dir={languageDirections[targetLanguage] ?? 'ltr'}
                value={targetValueFor(word)}
                oninput={(e) => (translateEdits = { ...translateEdits, [word.name]: (e.currentTarget as HTMLInputElement).value })}
              />
              <button class="btn" onclick={() => saveTranslateRow(word)} disabled={translateSaving === word.name}>
                {translateSaving === word.name ? 'Saving…' : (translations.current['Save'] ?? 'Save')}
              </button>
            </div>
          {/each}
          {#if filteredWords.length > 200}
            <p class="hint">…and {filteredWords.length - 200} more — narrow the search to see them.</p>
          {/if}
        </div>
      {/if}
    </div>

    <div class="card new-word-card">
      <h3>{translations.current['Add a new word'] ?? 'Add a new word'}</h3>
      <fieldset>
        <legend>{translations.current['Name'] ?? 'Name'}</legend>
        <input bind:value={newWordName} placeholder="e.g. Balance Sheet" />
      </fieldset>
      <button class="btn" onclick={addWord} disabled={addingWord}>
        {addingWord ? 'Adding…' : (translations.current['Add word'] ?? 'Add word')}
      </button>
    </div>

    <div class="card new-language-card">
      <h3>{translations.current['Add a new language'] ?? 'Add a new language'}</h3>
      <fieldset>
        <legend>{translations.current['Name'] ?? 'Name'}</legend>
        <input bind:value={newLanguageName} placeholder="e.g. Spanish" />
      </fieldset>
      <fieldset>
        <legend>{translations.current['Text Direction'] ?? 'Text Direction'}</legend>
        <select bind:value={newLanguageDirection}>
          <option value="LTR">{translations.current['Left to right (LTR)'] ?? 'Left to right (LTR)'}</option>
          <option value="RTL">{translations.current['Right to left (RTL)'] ?? 'Right to left (RTL)'}</option>
        </select>
      </fieldset>
      <button class="btn" onclick={addLanguage} disabled={addingLanguage}>
        {addingLanguage ? 'Adding…' : (translations.current['Add language'] ?? 'Add language')}
      </button>
    </div>
  </div>
{:else}
  <div class="layout">
    <div class="card word-list-card">
      <fieldset>
        <legend>{translations.current['Search'] ?? 'Search'}</legend>
        <input bind:value={search} placeholder="e.g. Vendor" />
      </fieldset>
      <p class="hint">{filteredWords.length} of {words.length} real words</p>
      <div class="word-list">
        {#each filteredWords.slice(0, 200) as word}
          <button class="word-row" class:selected={selectedWord?.name === word.name} onclick={() => select(word)}>
            {translations.current[word.name] ?? word.name}
          </button>
        {/each}
        {#if filteredWords.length > 200}
          <p class="hint">…and {filteredWords.length - 200} more — narrow the search to see them.</p>
        {/if}
      </div>
    </div>

    <div class="card edit-card">
      {#if !selectedWord}
        <p class="hint">Select a word on the left to see and edit its own, real translations.</p>
      {:else}
        <h3>{translations.current[selectedWord.name] ?? selectedWord.name}</h3>
        {#each editableLanguages as lang}
          <fieldset>
            <legend>{translations.current[lang.name] ?? lang.name}</legend>
            <div class="translation-row">
              <input bind:value={editValues[lang.name]} dir={languageDirections[lang.name] ?? 'ltr'} />
              <button class="btn" onclick={() => saveTranslation(lang.name)} disabled={saving === lang.name}>
                {saving === lang.name ? 'Saving…' : (translations.current['Save'] ?? 'Save')}
              </button>
            </div>
          </fieldset>
        {/each}
      {/if}
    </div>

    <div class="card new-word-card">
      <h3>{translations.current['Add a new word'] ?? 'Add a new word'}</h3>
      <fieldset>
        <legend>{translations.current['Name'] ?? 'Name'}</legend>
        <input bind:value={newWordName} placeholder="e.g. Balance Sheet" />
      </fieldset>
      <button class="btn" onclick={addWord} disabled={addingWord}>
        {addingWord ? 'Adding…' : (translations.current['Add word'] ?? 'Add word')}
      </button>
    </div>

    <div class="card new-language-card">
      <h3>{translations.current['Add a new language'] ?? 'Add a new language'}</h3>
      <fieldset>
        <legend>{translations.current['Name'] ?? 'Name'}</legend>
        <input bind:value={newLanguageName} placeholder="e.g. Spanish" />
      </fieldset>
      <fieldset>
        <legend>{translations.current['Text Direction'] ?? 'Text Direction'}</legend>
        <select bind:value={newLanguageDirection}>
          <option value="LTR">{translations.current['Left to right (LTR)'] ?? 'Left to right (LTR)'}</option>
          <option value="RTL">{translations.current['Right to left (RTL)'] ?? 'Right to left (RTL)'}</option>
        </select>
      </fieldset>
      <button class="btn" onclick={addLanguage} disabled={addingLanguage}>
        {addingLanguage ? 'Adding…' : (translations.current['Add language'] ?? 'Add language')}
      </button>
    </div>
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
  .layout {
    display: flex;
    flex-wrap: wrap;
    gap: 1rem;
    justify-content: center;
    align-items: flex-start;
  }
  .mode-toggle {
    max-width: 70ch;
    margin: 0 auto 1.2rem;
    padding: 0.8rem 1rem;
  }
  .mode-buttons {
    display: flex;
    gap: 0.5rem;
  }
  .mode-buttons .btn.selected {
    background: var(--brass, #c9a24b);
    color: white;
  }
  .translate-pickers {
    display: flex;
    gap: 1rem;
    margin-top: 0.8rem;
    flex-wrap: wrap;
  }
  .translate-card {
    width: 100%;
    max-width: 900px;
    padding: 1rem 1.2rem;
  }
  .translate-header {
    display: grid;
    grid-template-columns: 1fr 1fr auto;
    gap: 0.6rem;
    font-weight: bold;
    padding: 0 0 0.4rem 0;
    color: var(--ink-soft);
  }
  .translate-list {
    max-height: 600px;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .translate-row {
    display: grid;
    grid-template-columns: 1fr 1fr auto;
    gap: 0.6rem;
    align-items: center;
  }
  .reference-text {
    padding: 0.4rem 0.5rem;
    background: var(--paper-dim, #f2ede1);
    border-radius: 4px;
    line-height: 1.3;
  }
  .target-text {
    width: 100%;
  }
  .word-list-card {
    width: 320px;
    padding: 1rem;
  }
  .word-list {
    max-height: 500px;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  .word-row {
    text-align: left;
    background: none;
    border: none;
    padding: 0.4rem 0.5rem;
    border-radius: 4px;
    cursor: pointer;
    font-size: var(--font-size-base);
    line-height: 1.3;
  }
  .word-row:hover {
    background: var(--paper-dim, #f2ede1);
  }
  .word-row.selected {
    background: var(--brass, #c9a24b);
    color: white;
  }
  .edit-card {
    width: 420px;
    padding: 1.1rem 1.2rem 1.3rem;
  }
  .edit-card h3 {
    margin-top: 0;
  }
  .translation-row {
    display: flex;
    gap: 0.5rem;
  }
  .translation-row input {
    flex: 1;
  }
  .new-language-card {
    width: 260px;
    padding: 1.1rem 1.2rem 1.3rem;
  }
  .new-language-card h3 {
    margin-top: 0;
  }
  .hint {
    font-size: var(--font-size-small);
    color: var(--ink-soft);
  }
</style>
