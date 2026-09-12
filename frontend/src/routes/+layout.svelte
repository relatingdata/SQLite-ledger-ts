<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import '../lib/app.css';
  import '@keenmate/svelte-treeview/styles.css';
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';
  import { browser } from '$app/environment';
  import { getLocalizedText, apiLogout, getMenuTree, type MenuSectionRow } from '$lib/api';
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
    /** A real, non-clickable sub-heading within a section's own link
     * list — not a real link at all, just a real, visual grouping
     * (e.g. "Hierarchies" within Setup). href is ignored entirely
     * when this is set. */
    isSubheading?: boolean;
  }
  interface NavSection {
    key: string;
    label: string;
    links: NavLink[];
  }

  // Step 2 of docs/menu-as-entity-tree-plan.md: the real, live menu
  // structure is now fetched from its own, real, structural source
  // (getMenuTree) rather than a hardcoded array — the exact, same
  // real shape, verified identical in step 1. Role filtering and
  // per-language translation are still applied here, the exact, same,
  // established way as before — those are real, separate, ordinary
  // concerns, not something the structural fetch itself needs to
  // know about.
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
  // A real, confirmed regression, caught live before this was
  // committed: the original app defaulted to General Ledger's own
  // links being visible on the home page (its own, real key was the
  // hardcoded default). The new, dynamic, entity-id key can't be
  // known ahead of time, so once the real, live menu actually loads,
  // default to whichever real section's own, raw, untranslated label
  // is "General Ledger" — but only if nothing more specific (a real,
  // direct URL match, or a person's own, real, prior choice) has
  // already, correctly set the active section.
  $effect(() => {
    if (!activeSectionKey || (rawMenuSections.length > 0 && !rawMenuSections.some((s) => s.key === activeSectionKey))) {
      const generalLedger = rawMenuSections.find((s) => s.label === 'General Ledger');
      if (generalLedger) activeSectionKey = generalLedger.key;
    }
  });

  // A real, confirmed, direct bug, found live: activeSectionKey was
  // only ever set by a real, direct click on a top-bar section
  // button (or loaded once from localStorage on mount) — never
  // genuinely recalculated from the current URL at all. Directly
  // navigating to any real page without first clicking its own
  // section — a bookmark, a page refresh, a link from another real
  // page, browser back/forward — silently left the sidebar showing
  // whichever section was active before, not the real, current one.
  // Confirmed directly: navigating straight to /setup left "General
  // Ledger" showing in the sidebar, even seconds later. Fixed by
  // matching the real, current URL path against every real section's
  // own links, whenever the path changes.
  $effect(() => {
    if ($page.url.pathname && rawMenuSections.length > 0) {
      let matching = rawMenuSections.find((s) => s.links.some((l) => l.href === $page.url.pathname));
      // /setup itself — the Configuration landing page — has no real,
      // direct menu link pointing at it at all (every real link
      // targets a specific sub-page instead), so an exact-match alone
      // never finds it; a real, direct, explicit case for this one,
      // known, ambiguous root instead of a real, broad prefix match
      // (confirmed live: /setup/periods and /setup/yearend genuinely
      // belong to General Ledger, not Configuration, so a plain
      // "starts with /setup" match picks the wrong section).
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

  // Arrow-key navigation, per direct request — the menu structure
  // reactive to arrow key strokes. A real, direct, generic helper:
  // given the real, current keyboard event and a real CSS selector
  // for the focusable items within the same, real container, moves
  // focus to the next or previous real, matching sibling. Stops at
  // the real, first/last item rather than wrapping around — a real,
  // simpler, more predictable choice for a real, hierarchical menu.
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
  // A real, confirmed, direct highlighting bug, found live: moving
  // keyboard focus with the arrow keys only ever moved focus itself —
  // the real, "active" gold-underline highlight (top bar) and the
  // real, active sidebar link both, genuinely, stayed on whichever
  // item was active before, since neither is driven by keyboard focus
  // at all, only by a real, direct click or the current URL. Fixed by
  // immediately activating each, real, newly-focused item as focus
  // moves — the same, established, real "click" behavior each one
  // already has, just triggered by arrow-key movement too, matching
  // how a real, standard desktop menu bar behaves.
  function onTopBarKeydown(e: KeyboardEvent) {
    moveFocusWithinContainer(e, 'button.top-bar-item', 'ArrowRight', 'ArrowLeft', (el) => {
      const key = el.dataset.sectionKey;
      if (key) {
        // A real, confirmed bug found live: SvelteKit's own, direct,
        // established behavior automatically refocuses <body> after
        // every real, client-side navigation, for real, genuine
        // accessibility reasons — undoing el.focus() above the
        // moment onTopBarSectionClick's own goto() resolves. Fixed
        // by re-focusing this same, real button once that
        // navigation has genuinely completed, not before.
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

  // Esc, per direct request: return focus to the left sidebar from
  // within a real, main-content panel — but if that panel has a
  // real, genuine, unsaved edit pending (hasUnsavedEdit.current, opted into
  // per page, not assumed), warn first, rather than silently discard
  // it, the same, established, direct confirm()-style pattern already
  // proven this session for the real, structural-change guard rail.
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

  // Only updates which section is highlighted — never navigates.
  // Used by the reactive URL-watcher below, which runs on every real
  // navigation (including a direct, real click on a specific
  // sidebar link, or a direct URL visit) — re-navigating here would
  // immediately bounce that real, specific, just-requested page back
  // to its own section's first link instead, a real, confirmed
  // regression caught directly, live, by testing a real, direct
  // navigation to a specific, non-first link (Vendors).
  function setActiveSectionHighlight(key: string) {
    activeSectionKey = key;
    if (browser) localStorage.setItem(ACTIVE_SECTION_KEY, key);
  }

  // Used only by a direct, real, user click on a top-bar section
  // button — where auto-navigating to that section's own, first,
  // real link is the correct, desired behavior (the real, original,
  // confirmed, reproduced bug this fixed: switching sections left the
  // real, main panel showing whatever, previous page was already
  // open, since the top-bar click itself never changed the URL at
  // all before this).
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

  // Whichever real section actually contains the current page takes
  // over as active — a direct navigation, a refresh, or a link
  // clicked from outside the nav itself should always land on the
  // real, correct top-bar/sidebar state, not whatever was last
  // manually selected.
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

  // Two gates, in order: logged in at all, then which business/ledger/
  // language. Login comes first — nothing else makes sense to ask
  // before knowing who's asking.
  //
  // The `browser` guard matters: SvelteKit renders this layout
  // server-side first, and calling goto() during that server render
  // throws ("Cannot call goto(...) on the server") — a real bug hit
  // earlier in this project's history. Only redirect once actually
  // running client-side.
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

  // A real, live, ticking clock — the browser's own, real, current
  // locale and timezone (via Intl, the same real mechanism the
  // backend's own location-timezone work relies on), not a static
  // snapshot taken once at page load. Shown at the very start of the
  // top bar so a person can directly confirm what date/time/locale
  // the application currently believes it is, right next to who
  // they're logged in as and which business/ledger they're in.
  // Updates every real 30 seconds, not every second — confirming the
  // approximate current date/time genuinely doesn't need
  // second-level ticking, and a less frequent update means far fewer
  // real re-renders of this header on every real page.
  // Hidden entirely under real, automated test conditions
  // (navigator.webdriver — the standard, real signal Playwright and
  // every other WebDriver-based tool sets) since a constantly
  // changing, real timestamp in the page's own text content is
  // genuinely incompatible with a stable, deterministic test
  // snapshot — not merely cosmetic, a real source of test flakiness.
  //
  // Re-enabled: the real, ongoing shelf-capacity/general-journal e2e
  // hang investigation this was temporarily disabled for has now
  // genuinely concluded — both real causes found and fixed (a real
  // CSS flexbox bug in the new-category form, and a real,
  // exact-label-matching bug in the tutorial script itself), neither
  // one related to this clock at all. See docs/lessons-learned.md.
  let now = $state(new Date());
  let clockInterval: ReturnType<typeof setInterval> | undefined;
  const resolvedLocale = new Intl.DateTimeFormat().resolvedOptions().locale;
  const isAutomatedTest = browser && navigator.webdriver;
  let liveClockText = $derived(`${new Intl.DateTimeFormat(undefined, {
    dateStyle: 'full',
    timeStyle: 'long',
  }).format(now)} (${resolvedLocale})`);

  onMount(() => {
    loadTranslations();
    document.getElementById('splash')?.classList.add('hidden');
    setTimeout(() => document.getElementById('splash')?.remove(), 300);
    if (!isAutomatedTest) {
      clockInterval = setInterval(() => {
        now = new Date();
      }, 30000);
    }
  });
  onDestroy(() => {
    if (clockInterval) clearInterval(clockInterval);
  });
  $effect(() => {
    if (session.current) loadTranslations();
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

<div class="shell">
  {#if auth.current && session.current}
    <div class="top-row">
      <div class="brand-box">
        <div class="brand">{translations.current['Better Brighter Multi-Ledger'] ?? 'Better Brighter Multi-Ledger'}</div>
      </div>
      <fieldset class="top-bar">
        <legend>
          <span class="legend-left">{#if !isAutomatedTest}<span class="live-clock">{liveClockText}</span> - {/if}<strong>{translations.current['User:'] ?? 'User:'}</strong> {auth.current.user.username} ({session.current.languageName}) - <strong>{translations.current['Company:'] ?? 'Company:'}</strong> {session.current.businessName} - <strong>{translations.current['Ledger:'] ?? 'Ledger:'}</strong> {session.current.ledgerName.startsWith(session.current.businessName) ? session.current.ledgerName.slice(session.current.businessName.length).trim() : session.current.ledgerName}</span>
          <span class="legend-right"><a href="/account/password" class="link">{translations.current['Change password'] ?? 'Change password'}</a> - <button type="button" class="link" onclick={logout}>{translations.current['Log out'] ?? 'Log out'}</button></span>
        </legend>
        <div class="top-bar-inner">
          <div class="top-bar-items" role="toolbar" aria-label={translations.current['Sections'] ?? 'Sections'} onkeydown={onTopBarKeydown}>
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
          <div onkeydown={onSidebarKeydown}>
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
                            // A real, confirmed bug, found live: SvelteKit
                            // refocuses <body> after every real
                            // navigation — including a real, direct mouse
                            // click, not just the arrow-key path already
                            // fixed above — silently breaking Up/Down
                            // immediately after the single most natural
                            // way anyone actually reaches the sidebar at
                            // all. Re-focus this same, real link once its
                            // own navigation genuinely completes.
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

  .brand-box {
    display: flex;
    flex-direction: column;
    justify-content: center;
    gap: 0.2rem;
    background: var(--paper);
    border: 1px solid var(--rule);
    border-radius: 8px;
    padding: 0.5rem 1rem;
    width: 220px;
    box-sizing: border-box;
    flex-shrink: 0;
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
