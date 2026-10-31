// The real, live, server-computed menu (GET /menu?business=...) — see
// docs/tui-design.md, scope item 3. Two levels: sections, then that
// section's own links. Escape climbs back up one level; on the
// section list, Escape/q quits (handled by App.tsx).
import React, { useEffect, useState } from 'react';
import { useInput } from 'ink';
import { Text } from 'ink';
import SelectInput from 'ink-select-input';
import { ApiError, getMenuTree, type MenuSectionRow } from '../api.js';
import { Panel } from '../components/Panel.js';
import { inkSoft } from '../theme.js';

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
  | 'customers';

// Which real menu-link hrefs this v1 test implementation actually
// knows how to open — matched on href (backend/src/db-seed.ts's own,
// real, hand-written route paths: '/post', '/reports/balance-sheet'),
// not on `key`, since `key` is a generated entity identifier with no
// documented stability guarantee, where href is the real, stable,
// hand-authored route path the web app itself navigates to. Every
// other real, live link in the menu is shown (it is the real, live
// menu, not a curated subset) but simply reports that it isn't wired
// up in this TUI yet, rather than silently vanishing.
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
};

export function Menu({ businessName, onOpenScreen }: { businessName: string; onOpenScreen: (screen: MenuScreenKey) => void }) {
  const [sections, setSections] = useState<MenuSectionRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeSection, setActiveSection] = useState<MenuSectionRow | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    getMenuTree(businessName)
      .then(setSections)
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Could not load the menu.'));
  }, [businessName]);

  useInput((_input, key) => {
    if (key.escape && activeSection) setActiveSection(null);
  });

  if (error) return <Panel title="Menu"><Text color="red">{error}</Text></Panel>;
  if (!sections) return <Panel title="Menu"><Text color={inkSoft}>Loading…</Text></Panel>;

  if (!activeSection) {
    return (
      <Panel title={`Menu — ${businessName}`} focused>
        <SelectInput
          items={sections.map((s) => ({ label: s.label, value: s.key }))}
          onSelect={(item) => {
            setNotice(null);
            setActiveSection(sections.find((s) => s.key === item.value) ?? null);
          }}
        />
        {notice && <Text color={inkSoft}>{notice}</Text>}
        <Text color={inkSoft} dimColor>
          ↑/↓ move · Enter open a section · q quit
        </Text>
      </Panel>
    );
  }

  // isSubheading rows are real, but purely structural — a label with no
  // href of its own (the web app renders them as plain section dividers,
  // never a clickable link) — so they're excluded from the selectable
  // list here, not from the real, live data itself.
  const selectableLinks = activeSection.links.filter((l) => !l.isSubheading);

  return (
    <Panel title={`Menu — ${businessName} — ${activeSection.label}`} focused>
      <SelectInput
        items={selectableLinks.map((l) => ({ label: l.notImplemented ? `${l.label} (not in the web app yet)` : l.label, value: l.key }))}
        onSelect={(item) => {
          const link = selectableLinks.find((l) => l.key === item.value);
          const known = link ? KNOWN_SCREENS[link.href] : undefined;
          if (known) {
            onOpenScreen(known);
          } else {
            setNotice(`"${link?.label}" is a real, live menu entry — this test TUI just doesn't have that screen built yet.`);
          }
        }}
      />
      {notice && <Text color={inkSoft}>{notice}</Text>}
      <Text color={inkSoft} dimColor>
        ↑/↓ move · Enter open · Escape back to sections
      </Text>
    </Panel>
  );
}
