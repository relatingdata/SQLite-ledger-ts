*A Claude Code skill for this project — lives at `/mnt/skills/user/sql-ledger-ui-conventions/SKILL.md`, reproduced here so it's part of this manual's own, single, complete source. Description: the real, established Svelte/CSS UI conventions for the sql-ledger-ts application — top menu, side menu, page/panel titles, field/fieldset outlines, tables, buttons, tags, and colors. Use whenever building or modifying any page, form, or component in frontend/src for this project.*


# sql-ledger-ts UI Conventions

This documents the real, working CSS and Svelte structure already established across this application — not a proposed design system, a description of what's actually built and where. Every pattern below has a real, existing example in the codebase; cite the file when unsure, don't guess.

## Where things live

- **Global styles**: `frontend/src/lib/app.css` — CSS variables, `.card`, `fieldset`, tables, buttons, `.intro`/`.heading-wrap`, `fieldset.page-title`/`fieldset.card-legend`. Anything that should look the same on every page belongs here, not duplicated per-component.
- **Layout shell** (top menu, side menu, overall page frame): `frontend/src/routes/+layout.svelte` — its own `<style>` block, scoped to that file, since this structure genuinely only exists once.
- **Per-page/component styles**: each `+page.svelte`/component's own `<style>` block, for things genuinely specific to that one screen (e.g. `.storage-tag`, `.lines-table` in `CashTransaction.svelte`).

## Color palette and fonts (CSS variables, `app.css`)

```css
--ink: #1e2430;          /* primary text */
--ink-soft: #5a6472;     /* secondary/muted text, labels */
--paper: #ffffff;        /* card/input backgrounds */
--paper-raised: #f7f8fa; /* page background */
--paper-dim: #f9f5ec;    /* tinted boxes - intro text, hover states */
--stripe: #eaf2f8;       /* alternating table row shading */
--rule: #e2e5ea;         /* light borders */
--rule-strong: #c7ccd4;  /* input borders, stronger dividers */
--brass: #a9812f;        /* primary accent - active states, buttons */
--brass-dark: #8a6a24;   /* accent hover/darker, links */
--debit: #b1442e;        /* debit amounts, errors */
--credit: #1d4e8f;       /* credit amounts */
--danger-bg: #fbeae7;
--font-body: 'Inter', system-ui, sans-serif;
--font-display: 'Source Serif 4', Georgia, serif;  /* headings, legends */
--font-mono: 'IBM Plex Mono', monospace;
```

Always reference these variables — never hardcode a hex color that already has a variable, so a future palette change stays global.

## Top menu (the section bar)

Structure (`+layout.svelte`): a `.top-row` containing a fixed-width `.brand-box` (the app name) and a `fieldset.top-bar` that spans the rest of the width. The `fieldset`'s own `<legend>` holds the live user/company/ledger status line on the left and Change Password/Log Out on the right (`.legend-left`/`.legend-right`) — a real, native fieldset/legend straddling the top border, not a separately-positioned absolute element.

Below the legend, `.top-bar-items` is a `role="toolbar"` row of `.top-bar-item` buttons, one per top-level section (General Ledger, Accounts Receivable, etc.), each toggled via `class:active`. Keyboard nav (arrow keys) is wired via `onkeydown={onTopBarKeydown}` on the toolbar div — reuse this handler, don't write a new one.

```svelte
<fieldset class="top-bar">
  <legend>
    <span class="legend-left">...status text...</span>
    <span class="legend-right">...actions...</span>
  </legend>
  <div class="top-bar-inner">
    <div class="top-bar-items" role="toolbar" onkeydown={onTopBarKeydown}>
      {#each sections as section}
        <button class="top-bar-item" class:active={...} onclick={...}>{section.label}</button>
      {/each}
    </div>
  </div>
</fieldset>
```

## Side menu (the section's own links)

Structure: `<aside class="sidebar"><nav>...</nav></aside>`, sitting beside `.content-area` inside a flex `.lower` row. Within it: a `.section-header-static` label, then `.section-links` — a flat column of `<a>` tags, one per screen in that section. `.subheading` divides groups of links within one section (uppercase, small, bordered on top). The active link gets `class:active` (a left brass border + tinted background + bold), matching `.top-bar-item.active`'s own brass accent.

Keyboard nav (arrow keys within the sidebar) is wired via `onkeydown={onSidebarKeydown}` — reuse it. A real, confirmed browser quirk already fixed here: SvelteKit refocuses `<body>` after every navigation, breaking arrow-key nav immediately after a mouse click — the fix (re-focusing the clicked link once navigation resolves) is already in `+layout.svelte`; don't remove it.

## Page/panel titles — the fieldset-legend pattern

**This is the single most load-bearing convention in the whole app.** A page or panel's own title is never a floating heading above a box — it's a real, native `<fieldset>`/`<legend>` pair, where the legend straddles the fieldset's own top border (the classic "+-Business------+" bordered-box look), because a fieldset genuinely, natively does this with zero custom positioning CSS.

Two established variants (both in `app.css`):

- **`fieldset.page-title`** — for a whole page's own title, with the page's real content living directly inside it (not wrapped separately). Use this for every top-level `+page.svelte`.
- **`fieldset.card-legend`** — for a smaller, standalone card (e.g. Login, Choose Business) that isn't a full page.

```svelte
<fieldset class="page-title">
  <legend>{translations.current[title] ?? title}</legend>
  <p class="intro">{translations.current[intro] ?? intro}</p>
  <!-- page content directly here, not in a nested wrapper -->
</fieldset>
```

The `.intro` paragraph directly under either variant gets its own nested, tinted box (border + `--paper-dim` background) — genuinely confined to the instructions text itself, never bleeding the tint onto the whole panel. Don't recreate this by hand; `fieldset.page-title > .intro`/`fieldset.card-legend > .intro` in `app.css` already handle it.

If a page has no descriptive intro text at all, `.heading-wrap`/`.heading-wrap h2` gives a plain lifted, boxed heading instead (used sparingly — the fieldset-legend pattern above is preferred for anything with real content).

## Field outlines and titles — the same fieldset-legend pattern, one level down

Every individual field (a labeled input, select, or textarea) is *also* a `<fieldset>`/`<legend>` pair — the same real mechanism as page titles, just smaller and unstyled-background:

```svelte
<fieldset>
  <legend>{translations.current['Date'] ?? 'Date'}</legend>
  <input type="date" bind:value={transdate} />
</fieldset>
```

`app.css`'s global `fieldset` rule makes every input/select/textarea nested directly inside a fieldset borderless and full-width (the fieldset's own border is the field's visual boundary, not the input's), and `fieldset:focus-within` gives the whole fieldset a brass border on focus — never style focus on the input itself.

Group related fields horizontally with `.row-2`/`.row-3` (flex rows, `flex: 1` on each child fieldset) — see any of `CashTransaction.svelte`, `ar-sale`, `ap-purchase`, `post` for real examples of 2- and 3-across field rows.

## Tables (line items, reports, lists)

Global `table`/`th`/`td` styles in `app.css` already give collapsed borders, alternating-row shading (`tbody tr:nth-child(even)`, the "green-bar paper" look), and consistent padding — don't redeclare these per-page. A page-specific line-items table (e.g. `.lines-table` in `CashTransaction.svelte`) only needs to override spacing/margin, not re-declare border/stripe behavior.

- `.num`/`.num-input` — right-aligned numeric cells and inputs (`width: 6rem`).
- `.amount-debit`/`.amount-credit` — colored via `--debit`/`--credit` variables, never a hardcoded color.

## Tags (status/category indicators inline in a table)

The established shape (`.storage-tag` in `CashTransaction.svelte`, reused identically in `ar-sale`/`ap-purchase`): a small, `inline-block`, padded, rounded pill with a semantic background/text color pairing per state, distinct from the brass accent used for interactive elements.

```css
.storage-tag {
  display: inline-block;
  padding: 0.1rem 0.5rem;
  border-radius: 4px;
  font-size: 0.75rem;
  font-weight: 600;
}
.storage-tag.cold { background: #e3f0fb; color: #1e5f8f; }
.storage-tag.shelf { background: #f5efe3; color: #8a6a2a; }
```

A new status dimension needing its own tag should follow this exact shape — same padding/radius/font-size, a new semantically-paired color combination.

## Buttons

`.btn` (primary, brass background, white text) and `.btn.secondary` (paper background, ink text, `--rule-strong` border) are global. `.btn.small` overrides padding/font-size for compact inline buttons (e.g. a line-item's own remove button). Never invent a third button style without a real, distinct semantic reason.

## Translation wrapping — required on every user-visible string

Every piece of literal UI text is wrapped `translations.current['Exact English Text'] ?? 'Exact English Text'` — the key is the literal, exact English string itself, and the fallback is the same string repeated. This is not optional decoration; it's how the whole i18n system resolves a translated string when one exists, and falls back safely to English when it doesn't. Any new label, button, legend, or intro text needs this wrapping from the moment it's written, not added later.

```svelte
<legend>{translations.current['Date'] ?? 'Date'}</legend>
```

## Building a new form/page: the real checklist

1. Wrap the whole page in `<fieldset class="page-title">` with a `<legend>` for the title and a `.intro` paragraph if there's explanatory text.
2. Wrap every field in its own `<fieldset><legend>...</legend><input/select/textarea/></fieldset>`.
3. Group related fields with `.row-2`/`.row-3` for horizontal layout.
4. Wrap every literal string in `translations.current[...] ?? ...`.
5. Reuse `.btn`/`.btn.secondary`/`.btn.small` for actions — don't invent new button CSS.
6. If the page has a line-items table, follow `CashTransaction.svelte`'s `.lines-table`/`.num`/`.num-input` shape.
7. Use CSS variables from `app.css` for every color — never a bare hex value that already has a variable.
8. Check `app.css` first before writing any new global-feeling style (a border, a tinted box, a table rule) — it may already exist.
