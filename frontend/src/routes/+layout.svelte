<script lang="ts">
  // The app shell: menu, top-bar/sidebar section tracking, keyboard
  // nav, login/session gates, RTL, and the live clock — see
  // docs/pm-frontend-reference.md for the full design.
  import { onMount, onDestroy } from 'svelte';
  import '../lib/app.css';
  import '@keenmate/svelte-treeview/styles.css';
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';
  import { browser } from '$app/environment';
  import { getLocalizedText, apiLogout, getMenuTree, getLanguageDirection, checkVersion, getRecordingStatus, startRecording, stopRecording, type MenuSectionRow } from '$lib/api';
  import { session } from '$lib/state.svelte';
  import { auth, hasRole } from '$lib/state.svelte';
  import { translations } from '$lib/state.svelte';
  import { menuTree } from '$lib/state.svelte';
  import { hasUnsavedEdit } from '$lib/state.svelte';
  import type { Snippet } from 'svelte';

  let { children }: { children: Snippet } = $props();


  interface NavLink {
    href: string;
    label: string;
    notImplemented?: boolean;
    isSubheading?: boolean; // non-clickable grouping heading; href ignored — see docs/pm-frontend-reference.md
  }
  interface NavSection {
    key: string;
    label: string;
    links: NavLink[];
  }

  let rawMenuSections: MenuSectionRow[] = $state([]);
  async function loadMenu() {
    if (!session.current) return;
    try {
      rawMenuSections = await getMenuTree(session.current.businessName);
      menuTree.set(rawMenuSections);
    } catch {
      /* fall back to an empty menu rather than blocking the app entirely */
    }
  }
  $effect(() => {
    if (session.current) loadMenu();
  });
  // Defaults the active section to General Ledger — see docs/pm-frontend-reference.md.
  $effect(() => {
    if (!activeSectionKey || (rawMenuSections.length > 0 && !rawMenuSections.some((s) => s.key === activeSectionKey))) {
      const generalLedger = rawMenuSections.find((s) => s.label === 'General Ledger');
      if (generalLedger) activeSectionKey = generalLedger.key;
    }
  });

  // Recalculates activeSectionKey from the URL — see docs/pm-frontend-reference.md.
  $effect(() => {
    if ($page.url.pathname && rawMenuSections.length > 0) {
      let matching = rawMenuSections.find((s) => s.links.some((l) => l.href === $page.url.pathname));
      // /setup has no direct menu link of its own — see docs/pm-frontend-reference.md.
      if (!matching && $page.url.pathname === '/setup') {
        matching = rawMenuSections.find((s) => s.label === 'Configuration');
      }
      if (matching && matching.key !== activeSectionKey) activeSectionKey = matching.key;
    }
  });

  let sections = $derived(rawMenuSections
    .map((s) => ({
      key: s.key,
      label: translations.current[s.label] ?? s.label,
      links: s.links
        .filter((l) => !l.requiredRoles || (auth.current && hasRole(auth.current, ...(l.requiredRoles as [string, ...string[]]))))
        .map((l) => ({ href: l.href, label: translations.current[l.label] ?? l.label, notImplemented: l.notImplemented, isSubheading: l.isSubheading })),
    }))
    .filter((s) => s.links.length > 0) as NavSection[]);

  const ACTIVE_SECTION_KEY = 'nav-active-section';
  let activeSectionKey = $state('');

  function loadActiveSection() {
    if (!browser) return;
    try {
      const stored = localStorage.getItem(ACTIVE_SECTION_KEY);
      if (stored) activeSectionKey = stored;
    } catch {
      /* fine to fall back to the default */
    }
  }

  // Generic arrow-key focus helper — see docs/pm-frontend-reference.md.
  function moveFocusWithinContainer(e: KeyboardEvent, itemSelector: string, nextKey: string, prevKey: string, onMove?: (el: HTMLElement) => void) {
    if (e.key !== nextKey && e.key !== prevKey) return;
    const container = e.currentTarget as HTMLElement;
    const items = Array.from(container.querySelectorAll<HTMLElement>(itemSelector));
    const currentIndex = items.indexOf(document.activeElement as HTMLElement);
    if (currentIndex === -1) return;
    e.preventDefault();
    const nextIndex = e.key === nextKey ? currentIndex + 1 : currentIndex - 1;
    if (nextIndex >= 0 && nextIndex < items.length) {
      items[nextIndex].focus();
      onMove?.(items[nextIndex]);
    }
  }
  // Activates the newly-focused item on arrow-key move — see docs/pm-frontend-reference.md.
  function onTopBarKeydown(e: KeyboardEvent) {
    moveFocusWithinContainer(e, 'button.top-bar-item', 'ArrowRight', 'ArrowLeft', (el) => {
      const key = el.dataset.sectionKey;
      if (key) {
        // Re-focus after SvelteKit's post-navigation body refocus — see docs/pm-frontend-reference.md.
        Promise.resolve(onTopBarSectionClick(key)).then(() => el.focus());
      }
    });
  }
  function onSidebarKeydown(e: KeyboardEvent) {
    moveFocusWithinContainer(e, 'a', 'ArrowDown', 'ArrowUp', (el) => {
      const href = (el as HTMLAnchorElement).getAttribute('href');
      if (href) Promise.resolve(goto(href)).then(() => el.focus());
    });
  }

  // Esc returns focus to the sidebar, warning first on an unsaved edit — see docs/pm-frontend-reference.md.
  function onMainKeydown(e: KeyboardEvent) {
    if (e.key !== 'Escape') return;
    if (hasUnsavedEdit.current) {
      const discard = confirm('You have an unsaved edit. Discard it and go back to the menu?');
      if (!discard) return;
      hasUnsavedEdit.set(false);
    }
    const activeLink = document.querySelector<HTMLElement>('.section-links a.active') ?? document.querySelector<HTMLElement>('.section-links a');
    activeLink?.focus();
  }

  // Highlight-only, never navigates — see docs/pm-frontend-reference.md.
  function setActiveSectionHighlight(key: string) {
    activeSectionKey = key;
    if (browser) localStorage.setItem(ACTIVE_SECTION_KEY, key);
  }

  // Auto-navigates to the section's first link on a top-bar click — see docs/pm-frontend-reference.md.
  function onTopBarSectionClick(key: string) {
    setActiveSectionHighlight(key);
    const section = sections.find((s) => s.key === key);
    const firstRealLink = section?.links.find((l) => !l.isSubheading && !l.notImplemented);
    if (firstRealLink) {
      return goto(firstRealLink.href);
    }
    return Promise.resolve();
  }

  loadActiveSection();

  // See docs/pm-frontend-reference.md.
  let lastPathname = $state('');
  let lastSectionsAttempt = $state(-1);
  $effect(() => {
    if (browser && (($page.url.pathname !== lastPathname) || (sections.length > 0 && sections.length !== lastSectionsAttempt))) {
      lastPathname = $page.url.pathname;
      lastSectionsAttempt = sections.length;
      const owningSection = sections.find((s) => s.links.some((l) => l.href.split('?')[0] === lastPathname));
      if (owningSection) setActiveSectionHighlight(owningSection.key);
    }
  });

  // Login/session redirect gates — see docs/pm-frontend-reference.md.
  $effect(() => {
    if (browser && auth.current === null && $page.url.pathname !== '/login' && $page.url.pathname !== '/customer-terminal') {
      goto('/login');
    }
  });
  $effect(() => {
    if (browser && auth.current !== null && session.current === null && $page.url.pathname !== '/session' && $page.url.pathname !== '/login' && $page.url.pathname !== '/customer-terminal') {
      goto('/session');
    }
  });

  async function loadTranslations() {
    if (!session.current) return;
    try {
      translations.set(await getLocalizedText(session.current.languageName, session.current.businessName));
    } catch {
      /* fall back to English (empty map) rather than blocking the app */
    }
  }

  // RTL support — see docs/pm-frontend-reference.md.
  let textDirection = $state<'ltr' | 'rtl'>('ltr');
  async function loadTextDirection() {
    if (!session.current) return;
    try {
      const { direction } = await getLanguageDirection(session.current.languageName);
      textDirection = direction === 'RTL' ? 'rtl' : 'ltr';
    } catch {
      textDirection = 'ltr';
    }
  }

  // The live clock, hidden under automated tests — see docs/pm-frontend-reference.md.
  let now = $state(new Date());
  let clockInterval: ReturnType<typeof setInterval> | undefined;
  const resolvedLocale = new Intl.DateTimeFormat().resolvedOptions().locale;
  const isAutomatedTest = browser && navigator.webdriver;
  let liveClockText = $derived(`${new Intl.DateTimeFormat(undefined, {
    dateStyle: 'full',
    timeStyle: 'long',
  }).format(now)} (${resolvedLocale})`);

  let recordingActive = $state(false);
  let recordingBusy = $state(false);
  const isAdministrator = $derived(auth.current?.user.roles.includes('Administrator') ?? false);

  async function toggleRecording() {
    if (recordingBusy) return;
    recordingBusy = true;
    try {
      const result = recordingActive ? await stopRecording() : await startRecording();
      recordingActive = result.recording;
    } catch {
      /* a real, failed toggle (e.g. a stale state) leaves recordingActive as it was - the person can retry */
    } finally {
      recordingBusy = false;
    }
  }

  onMount(() => {
    loadTranslations();
    loadTextDirection();
    if (!isAutomatedTest) checkVersion();
    document.getElementById('splash')?.classList.add('hidden');
    setTimeout(() => document.getElementById('splash')?.remove(), 300);
    if (!isAutomatedTest) {
      clockInterval = setInterval(() => {
        now = new Date();
      }, 30000);
    }
    if (isAdministrator) {
      getRecordingStatus().then((r) => { recordingActive = r.recording; }).catch(() => {});
    }
  });
  onDestroy(() => {
    if (clockInterval) clearInterval(clockInterval);
  });
  $effect(() => {
    if (session.current) { loadTranslations(); loadTextDirection(); }
  });

  async function logout() {
    try {
      await apiLogout();
    } catch {
      /* proceed with clearing local state regardless — the token may already be invalid */
    }
    auth.clear();
    session.clear();
    goto('/login');
  }
</script>

<div class="wallpaper" aria-hidden="true">
  <span>{translations.current['Better'] ?? 'Better'}</span>
  <span>{translations.current['Brighter'] ?? 'Brighter'}</span>
  <span>{translations.current['Multi-Ledger'] ?? 'Multi-Ledger'}</span>
  <span>version 0.0.0</span>
</div>

<div class="shell" dir={textDirection}>
  {#if auth.current && session.current}
    <div class="top-row">
      <div class="brand-box">
        <div class="brand">
          {#each (translations.current['Better Brighter Multi-Ledger'] ?? 'Better Brighter Multi-Ledger').split(' ') as word}
            <div class="brand-line">{word}</div>
          {/each}
        </div>
      </div>
      <fieldset class="top-bar">
        <legend>
          <span class="legend-left">
            {#if !isAutomatedTest}<span class="legend-segment"><span class="live-clock">{liveClockText}</span></span>{/if}
            <span class="legend-segment"><strong>{translations.current['User:'] ?? 'User:'}</strong> {auth.current.user.username} ({session.current.languageName})</span>
            <span class="legend-segment"><strong>{translations.current['Business:'] ?? 'Business:'}</strong> {session.current.businessName}</span>
            <span class="legend-segment"><strong>{translations.current['Ledger:'] ?? 'Ledger:'}</strong> {(() => { const l = session.current.ledgerName.startsWith(session.current.businessName) ? session.current.ledgerName.slice(session.current.businessName.length).trim() : session.current.ledgerName; return translations.current[l] ?? l; })()}</span>
          </span>
          <span class="legend-right">{#if isAdministrator}<button type="button" class="link" onclick={toggleRecording} disabled={recordingBusy} aria-pressed={recordingActive}>{recordingActive ? (translations.current['Recording: on'] ?? 'Recording: on') : (translations.current['Recording: off'] ?? 'Recording: off')}</button> - {/if}<a href="/account/password" class="link">{translations.current['Change password'] ?? 'Change password'}</a> - <button type="button" class="link" onclick={logout}>{translations.current['Log out'] ?? 'Log out'}</button></span>
        </legend>
        <div class="top-bar-inner">
          <div class="top-bar-items" role="toolbar" tabindex="0" aria-label={translations.current['Sections'] ?? 'Sections'} onkeydown={onTopBarKeydown}>
            {#each sections as section (section.key)}
              <button
                type="button"
                class="top-bar-item"
                class:active={activeSectionKey === section.key}
                data-section-key={section.key}
                onclick={() => onTopBarSectionClick(section.key)}
              >
                {section.label}
              </button>
            {/each}
          </div>
        </div>
      </fieldset>
    </div>
  {/if}

  <div class="lower">
    {#if auth.current && session.current}
      <aside class="sidebar">
        <nav>
          <!--
            A real, deliberate keyboard-navigable sidebar: each real
            link inside already has its own real, correct role and
            keyboard behavior; this div only captures Up/Down to move
            between them, the same, real pattern as the top-bar
            toolbar above. role="group" documents its real, semantic
            purpose but Svelte's linter still treats it as
            non-interactive on its own.
          -->
          <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
          <div role="group" aria-label={translations.current['Navigation'] ?? 'Navigation'} onkeydown={onSidebarKeydown}>
            {#each sections as section (section.key)}
              {#if section.key === activeSectionKey}
                <div class="section">
                  <div class="section-header-static">{section.label}</div>
                  <div class="section-links">
                    {#each section.links as link}
                      {#if link.isSubheading}
                        <div class="subheading">{link.label}</div>
                      {:else}
                        <a
                          href={link.href}
                          class:active={$page.url.pathname + $page.url.search === link.href}
                          class:not-implemented={link.notImplemented}
                          onclick={(e) => {
                            // Re-focus after navigation — see docs/pm-frontend-reference.md.
                            const el = e.currentTarget as HTMLElement;
                            Promise.resolve(goto(link.href)).then(() => el.focus());
                            e.preventDefault();
                          }}
                        >
                          {link.label}
                        </a>
                      {/if}
                    {/each}
                  </div>
                </div>
              {/if}
            {/each}
          </div>
        </nav>
      </aside>
    {/if}

    <div class="content-area">
      <!--
        main is a required, real, semantic landmark - giving it any
        other role would break real screen-reader landmark
        navigation, so this can't be "fixed" by changing its role.
        tabindex="-1" already keeps it out of the real tab order; the
        keydown handler only captures real, global keyboard shortcuts
        scoped to the main content region, never requiring main
        itself to be a real, interactive target.
      -->
      <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
      <main onkeydown={onMainKeydown} tabindex="-1">
        {@render children()}
      </main>
    </div>
  </div>
</div>

<style>
  .wallpaper {
    position: fixed;
    inset: 0;
    z-index: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 0.4rem;
    pointer-events: none;
    user-select: none;
    text-align: center;
    font-family: var(--font-display);
    color: var(--ink);
    opacity: 0.05;
  }

  .wallpaper span {
    font-size: 4.5rem;
    font-weight: 600;
    line-height: 1;
    white-space: nowrap;
  }

  .wallpaper span:last-child {
    font-size: 2rem;
    font-family: var(--font-mono);
    font-weight: 400;
    margin-top: 0.6rem;
  }

  .shell {
    display: flex;
    flex-direction: column;
    min-height: 100vh;
    position: relative;
    z-index: 1;
  }

  .top-row {
    display: flex;
    align-items: stretch;
    gap: 0.6rem;
    margin: 0.6rem 0.6rem 0;
  }

  .legend-left {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
  }

  .legend-segment {
    display: flex;
    align-items: center;
    gap: 0.3rem;
  }

  .legend-segment:not(:first-child)::before {
    content: "-";
    margin: 0 0.4rem;
    color: var(--ink-faint, #888);
  }

  .brand-box {
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    gap: 0.2rem;
    background: var(--paper);
    border: 1px solid var(--rule);
    border-radius: 8px;
    padding: 0.5rem 1rem;
    width: 220px;
    box-sizing: border-box;
    flex-shrink: 0;
  }

  .brand {
    text-align: center;
  }

  .brand-line {
    white-space: nowrap;
  }

  .top-bar {
    display: block;
    background: var(--paper);
    border: 1px solid var(--rule);
    border-radius: 8px;
    flex: 1;
    min-width: 0;
    flex-shrink: 0;
  }

  .top-bar-inner {
    display: flex;
    flex-direction: column;
  }

  .top-bar > legend {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    width: calc(100% - 2rem);
    margin-left: 0.6rem;
    padding: 0 0.6rem;
    font-size: var(--font-size-small);
    color: var(--ink-soft);
  }

  .brand {
    font-family: 'Source Serif 4', serif;
    font-size: var(--font-size-large);
    color: var(--brass-dark);
    padding: 0.7rem 0;
    white-space: nowrap;
  }

  .top-bar-items {
    display: flex;
    flex-wrap: wrap;
    flex: 1;
    padding: 0 1rem;
  }

  /* RTL mirroring: margin/padding/border only — see docs/pm-frontend-reference.md. */
  .shell[dir="rtl"] .sidebar {
    margin: 0.6rem 0.6rem 0.6rem 0;
  }
  .shell[dir="rtl"] .section-links a {
    padding: 0.35rem 2.1rem 0.35rem 1rem;
  }
  .shell[dir="rtl"] .section-links a.active {
    border-left: none;
    border-right: 3px solid var(--brass);
    padding-left: 2.1rem;
    padding-right: calc(2.1rem - 3px);
  }
  .shell[dir="rtl"] .subheading {
    padding: 0.5rem 2.1rem 0.25rem 1rem;
  }

  .top-bar-item {
    background: none;
    border: none;
    padding: 0.8rem 0.7rem;
    font-size: var(--font-size-base);
    font-weight: 600;
    color: var(--ink);
    cursor: pointer;
    white-space: nowrap;
  }

  .top-bar-item:hover {
    background: var(--paper-dim, #f2ede1);
  }

  .top-bar-item.active {
    color: var(--brass-dark);
  }

  .lower {
    display: flex;
    flex: 1;
    min-height: 0;
  }

  .sidebar {
    width: 220px;
    flex-shrink: 0;
    background: var(--paper);
    border: 1px solid var(--rule);
    border-radius: 8px;
    margin: 0.6rem 0 0.6rem 0.6rem;
    display: flex;
    flex-direction: column;
    padding: 1rem 0;
  }

  .sidebar nav {
    flex: 1;
    overflow-y: auto;
  }

  .section-header-static {
    padding: 0.3rem 1rem 0.6rem;
    font-size: var(--font-size-base);
    font-weight: 600;
    color: var(--ink-soft);
    text-transform: uppercase;
    letter-spacing: 0.03em;
  }

  .section-links {
    display: flex;
    flex-direction: column;
    padding-bottom: 0.3rem;
  }

  .section-links a {
    padding: 0.35rem 1rem 0.35rem 2.1rem;
    text-decoration: none;
    color: var(--ink-soft);
    font-size: var(--font-size-base);
  }

  .section-links a:hover {
    background: var(--paper-dim, #f2ede1);
    color: var(--ink);
  }

  .section-links a.active {
    background: var(--paper-dim, #f2ede1);
    border-left: 3px solid var(--brass);
    padding-left: calc(2.1rem - 3px);
    color: var(--ink);
    font-weight: 600;
  }

  .section-links a.not-implemented {
    font-style: italic;
    opacity: 0.7;
  }

  .subheading {
    padding: 0.5rem 1rem 0.25rem 2.1rem;
    font-size: var(--font-size-small);
    font-weight: 700;
    color: var(--ink-soft);
    text-transform: uppercase;
    letter-spacing: 0.05em;
    border-top: 1px solid var(--rule);
    margin-top: 0.2rem;
  }

  .content-area {
    flex: 1;
    min-width: 0;
    padding: 0.6rem 0.6rem 0.6rem;
    display: flex;
    flex-direction: column;
  }

  .content-area main {
    flex: 1;
    display: flex;
    flex-direction: column;
  }

  .link {
    background: none;
    border: none;
    color: var(--brass-dark);
    text-decoration: underline;
    cursor: pointer;
    font-size: var(--font-size-base);
    padding: 0;
  }


</style>
