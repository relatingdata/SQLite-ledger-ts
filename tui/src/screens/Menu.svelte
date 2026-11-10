<script lang="ts" module>
  export type MenuScreenKey =
    | 'general-journal'
    | 'balance-sheet'
    | 'new-business-wizard'
    | 'business-structure'
    | 'purchase'
    | 'cash-purchase'
    | 'purchase-order'
    | 'payment'
    | 'ar-sale'
    | 'cash-sale'
    | 'customers'
    | 'pos'
    | 'items-bom'
    | 'transfer-items';

  // Which real menu-link hrefs this TUI actually knows how to open —
  // matched on href (the real, stable, hand-authored route path),
  // never on `key` (a generated identifier with no stability
  // guarantee). Every other real, live link is still shown; it just
  // reports it isn't wired up yet rather than vanishing.
  const KNOWN_SCREENS: Record<string, MenuScreenKey> = {
    '/post': 'general-journal',
    '/reports/balance-sheet': 'balance-sheet',
    '/setup/new-business': 'new-business-wizard',
    '/setup/business-structure': 'business-structure',
    '/arap/ap-purchase': 'purchase',
    '/arap/cash-purchase': 'cash-purchase',
    '/arap/ap-payment': 'payment',
    '/stock/po': 'purchase-order',
    '/arap/ar-sale': 'ar-sale',
    '/arap/cash-sale': 'cash-sale',
    '/contacts?focus=customers': 'customers',
    '/pos': 'pos',
    '/items': 'items-bom',
    '/stock/transfer': 'transfer-items',
  };
</script>

<script lang="ts">
  import { Text } from 'sveltui';
  import { keyboard } from 'sveltui';
  import { onDestroy } from 'svelte';
  import { ApiError, getMenuTree, type MenuSectionRow } from '../api.ts';
  import Panel from '../components/Panel.svelte';
  import SelectList from '../components/SelectList.svelte';
  import { inkSoft } from '../theme.ts';

  let { businessName, onOpenScreen }: { businessName: string; onOpenScreen: (screen: MenuScreenKey) => void } = $props();

  let sections: MenuSectionRow[] | null = $state(null);
  let error: string | null = $state(null);
  let activeSection: MenuSectionRow | null = $state(null);
  let notice: string | null = $state(null);

  getMenuTree(businessName)
    .then((rows) => (sections = rows))
    .catch((err) => (error = err instanceof ApiError ? err.message : 'Could not load the menu.'));

  const unsubscribeBack = keyboard.onKey('Escape', () => {
    if (activeSection) activeSection = null;
  });
  onDestroy(unsubscribeBack);

  const selectableLinks = $derived(activeSection ? activeSection.links.filter((l) => !l.isSubheading) : []);
</script>

{#if error}
  <Panel title="Menu"><Text text={error} color="red" /></Panel>
{:else if !sections}
  <Panel title="Menu"><Text text="Loading…" color={inkSoft} /></Panel>
{:else if !activeSection}
  <Panel title={`Menu — ${businessName}`} focused>
    <SelectList
      items={sections.map((s) => ({ label: s.label, value: s.key }))}
      onSelect={(item) => {
        notice = null;
        activeSection = sections!.find((s) => s.key === item.value) ?? null;
      }}
    />
    {#if notice}<Text text={notice} color={inkSoft} />{/if}
    <Text text="↑/↓ move · Enter open a section · q quit" color={inkSoft} dim />
  </Panel>
{:else}
  <Panel title={`Menu — ${businessName} — ${activeSection.label}`} focused>
    <SelectList
      items={selectableLinks.map((l) => ({ label: l.notImplemented ? `${l.label} (not in the web app yet)` : l.label, value: l.key }))}
      onSelect={(item) => {
        const link = selectableLinks.find((l) => l.key === item.value);
        const known = link ? KNOWN_SCREENS[link.href] : undefined;
        if (known) {
          onOpenScreen(known);
        } else {
          notice = `"${link?.label}" is a real, live menu entry — this TUI just doesn't have that screen built yet.`;
        }
      }}
    />
    {#if notice}<Text text={notice} color={inkSoft} />{/if}
    <Text text="↑/↓ move · Enter open · Escape back to sections" color={inkSoft} dim />
  </Panel>
{/if}
