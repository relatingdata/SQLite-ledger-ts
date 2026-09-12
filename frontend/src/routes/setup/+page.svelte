<script lang="ts">
  import { onMount } from 'svelte';
  import { translations } from '$lib/state.svelte';
  import { auth, hasRole } from '$lib/state.svelte';
  import { getLanguages, getDefaultLanguage, setDefaultLanguage as apiSetDefaultLanguage, ApiError } from '$lib/api';

  let languages: { id: number; name: string }[] = $state([]);
  let defaultLanguage = $state('');
  let savingDefault = $state(false);
  let defaultError = $state('');
  let defaultMessage = $state('');

  onMount(async () => {
    if (!hasRole(auth.current, 'Administrator')) return;
    try {
      [languages, { language: defaultLanguage }] = await Promise.all([
        getLanguages(),
        getDefaultLanguage().then((r) => ({ language: r.language ?? '' })),
      ]);
    } catch {
      /* non-fatal — the tile grid below still works without this */
    }
  });

  async function saveDefaultLanguage() {
    if (!defaultLanguage) return;
    savingDefault = true;
    defaultError = '';
    defaultMessage = '';
    try {
      await apiSetDefaultLanguage(defaultLanguage);
      defaultMessage = `Saved — new visitors to the login screen will default to ${defaultLanguage}.`;
    } catch (e) {
      defaultError = e instanceof ApiError ? e.message : 'Could not save.';
    } finally {
      savingDefault = false;
    }
  }

  let items = $derived([
    ...(hasRole(auth.current, 'Administrator', 'Developer')
      ? [
          {
            href: '/setup/tree',
            title: translations.current['Entity Tree'] ?? 'Entity Tree',
            description: 'The whole entity table, walked from its one root, in hierarchy order.',
          },
          {
            href: '/editor',
            title: translations.current['Structured Editor'] ?? 'Structured Editor',
            description: 'Create, rename, reparent, change the relation of, or delete any entity; assign account numbers.',
          },
        ]
      : []),
    ...(hasRole(auth.current, 'Administrator')
      ? [
          { href: '/setup/users', title: 'Users', description: 'Create accounts, assign roles, deactivate, reset passwords.' },
          { href: '/setup/periods', title: 'Accounting Periods', description: 'Close a period to block normal posting into it, or reopen one for a correction.' },
        ]
      : []),
  ]);
</script>

<svelte:head><title>{translations.current['Setup'] ?? 'Setup'}</title></svelte:head>

<fieldset class="page-title">
  <legend>{translations.current['Configuration'] ?? 'Configuration'}</legend>

  {#if hasRole(auth.current, 'Administrator') && languages.length > 0}
    <div class="card default-lang-card">
      <h3>{translations.current['System default language'] ?? 'System default language'}</h3>
      <p class="dim">What the login screen defaults to for anyone who hasn't visited before and picked their own preference.</p>
      {#if defaultError}<p class="error">{defaultError}</p>{/if}
      {#if defaultMessage}<p class="success">{defaultMessage}</p>{/if}
      <div class="row">
        <select bind:value={defaultLanguage}>
          {#each languages as l}<option value={translations.current[l.name] ?? l.name}>{translations.current[l.name] ?? l.name}</option>{/each}
        </select>
        <button class="btn" onclick={saveDefaultLanguage} disabled={savingDefault}>{savingDefault ? (translations.current['Saving'] ?? 'Saving…') : (translations.current['Save'] ?? 'Save')}</button>
      </div>
    </div>
  {/if}

  <div class="grid">
    {#each items as item}
      <a class="card tile" href={item.href}>
        <h3>{item.title}</h3>
        <p>{item.description}</p>
      </a>
    {/each}
  </div>
</fieldset>

<style>
  .grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
    gap: 1rem;
  }

  .tile {
    display: block;
    padding: 1.1rem 1.2rem;
    text-decoration: none;
    color: var(--ink);
  }

  .tile:hover {
    border-color: var(--brass);
  }

  .tile h3 {
    margin: 0 0 0.4rem;
    color: var(--brass-dark);
  }

  .tile p {
    margin: 0;
    font-size: var(--font-size-base);
    color: var(--ink-soft);
  }

  .default-lang-card {
    padding: 1rem 1.2rem;
    margin-bottom: 1.2rem;
    max-width: 480px;
  }

  .default-lang-card h3 {
    margin: 0 0 0.3rem;
  }

  .dim {
    color: var(--ink-soft);
    font-size: var(--font-size-base);
    margin: 0 0 0.7rem;
  }

  .row {
    display: flex;
    gap: 0.6rem;
    align-items: center;
  }

  .success {
    color: var(--credit);
  }
</style>
