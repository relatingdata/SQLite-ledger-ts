<script lang="ts">
  import { onMount } from 'svelte';
  import { browser } from '$app/environment';
  import { goto } from '$app/navigation';
  import { apiLogin, getLanguages, getLocalizedText, getDefaultLanguage, getLanguageDirection, ApiError } from '$lib/api';
  import { auth, translations } from '$lib/state.svelte';
  import Form from '$lib/components/Form.svelte';

  const DISPLAY_LANGUAGE_KEY = 'display-language';

  // The real brand name itself, never line-broken mid-phrase — a
  // real, direct, non-breaking space between each word, regardless
  // of which real, translated language wraps around it, without
  // forcing the whole sentence onto one line (which would risk a
  // real overflow on a narrow, real screen instead).
  let welcomeMessage = $derived(
    (translations.current['Welcome to Better Brighter Multi-Ledger — please log in.'] ?? 'Welcome to Better Brighter Multi-Ledger — please log in.').replace(
      'Better Brighter Multi-Ledger',
      'Better\u00A0Brighter\u00A0Multi\u2011Ledger'
    )
  );

  let languages: { id: number; name: string }[] = $state([]);
  let displayLanguage = $state('');

  // Display only — this just changes what language the login form's
  // own labels show in, entirely separate from choosing a business/
  // ledger, which needs an actual session and comes after logging in.
  //
  // Priority: a person's own previously-chosen preference (if they've
  // been here before and picked something) beats the system default;
  // the system default beats a hardcoded English fallback for anyone
  // new. The system default has to live somewhere reachable before
  // login exists at all, since this screen itself needs it — see
  // getDefaultLanguage/setDefaultLanguage in db.ts for where.
  onMount(async () => {
    try {
      languages = await getLanguages();
      const stored = browser ? localStorage.getItem(DISPLAY_LANGUAGE_KEY) : null;
      const systemDefault = stored ? null : (await getDefaultLanguage()).language;
      displayLanguage =
        (stored && languages.some((l) => l.name === stored) ? stored : null) ??
        (systemDefault && languages.some((l) => l.name === systemDefault) ? systemDefault : null) ??
        languages.find((l) => l.name === 'English')?.name ??
        '';
      if (displayLanguage) await applyDisplayLanguage();
    } catch {
      /* language list is a nicety, not required to log in — fall back to English silently */
    }
  });

  let textDirection = $state<'ltr' | 'rtl'>('ltr');

  async function applyDisplayLanguage() {
    if (browser) localStorage.setItem(DISPLAY_LANGUAGE_KEY, displayLanguage);
    try {
      translations.set(displayLanguage === 'English' ? {} : await getLocalizedText(displayLanguage));
    } catch {
      translations.set({});
    }
    try {
      const { direction } = await getLanguageDirection(displayLanguage);
      textDirection = direction === 'RTL' ? 'rtl' : 'ltr';
    } catch {
      textDirection = 'ltr';
    }
  }

  let loginValues = $state({ username: '', password: '' });

  async function submit(values: Record<string, string | number | string[]>) {
    const username = String(values.username);
    const password = String(values.password);
    if (!username || !password) {
      throw new Error(translations.current['Username And Password Required'] ?? 'Username and password are both required.');
    }
    try {
      const { token, user } = await apiLogin(username, password);
      auth.set({ token, user });
    } catch (e) {
      throw e instanceof ApiError ? new Error(e.message) : new Error(translations.current['Could Not Log In'] ?? 'Could not log in.');
    }
    goto('/session');
  }
</script>

<svelte:head><title>{translations.current['Log in'] ?? 'Log in'}</title></svelte:head>

<div class="app-frame" dir={textDirection}>
  <div class="app-frame-title">Better Brighter Multi-Ledger</div>
  <div class="wrap">
    <fieldset class="card-legend form">
    <legend>{translations.current['Log in'] ?? 'Log in'}</legend>
    <p class="intro">{welcomeMessage}</p>
    {#if languages.length > 0}
      <fieldset>
        <legend>{translations.current['Language'] ?? 'Language'}</legend>
        <select bind:value={displayLanguage} onchange={applyDisplayLanguage}>
          {#each languages as l}<option value={l.name}>{translations.current[l.name] ?? l.name}</option>{/each}
        </select>
      </fieldset>
    {/if}
    <Form
      fields={[
        { name: 'username', label: translations.current['Username'] ?? 'Username', type: 'text', autocomplete: 'username' },
        { name: 'password', label: translations.current['Password'] ?? 'Password', type: 'password', autocomplete: 'current-password' },
      ]}
      bind:values={loginValues}
      onSubmit={submit}
      submitLabel={translations.current['Log in'] ?? 'Log in'}
      savingLabel={translations.current['Logging in…'] ?? 'Logging in…'}
    />
  </fieldset>
  </div>
</div>

<style>
  .app-frame {
    min-height: 95vh;
    border: 1px solid var(--rule);
    border-radius: 12px;
    margin: 0.5rem;
    position: relative;
    display: flex;
    justify-content: center;
    align-items: center;
  }

  .app-frame-title {
    position: absolute;
    top: 1rem;
    left: 1.2rem;
    font-family: var(--font-display);
    font-weight: 700;
    font-size: var(--font-size-large);
    color: var(--ink);
  }

  /* Real, direct RTL mirroring, per direct request: absolute
     left/right positioning does not automatically flip with dir="rtl"
     the way text-align or flex-direction do, so this needs its own,
     explicit override. */
  .app-frame[dir="rtl"] .app-frame-title {
    left: auto;
    right: 1.2rem;
  }

  .wrap {
    display: flex;
    justify-content: center;
    align-items: center;
    min-height: 80vh;
  }

  .form {
    padding: 1.6rem 1.8rem;
    display: flex;
    flex-direction: column;
    gap: 1rem;
    width: 320px;
  }
</style>
