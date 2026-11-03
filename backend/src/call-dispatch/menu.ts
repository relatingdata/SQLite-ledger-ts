// Converted from routes/menu.ts. getMenuTree's two-level sections->links
// shape is flattened to one row per link (a section with zero links gets
// one row with its link_* fields empty) - see ../routes/call.ts for how
// a 'table' result becomes real CSV bytes.
import { getMenuTree, setMenuOverride, deleteMenuOverride } from '../db.js';
import { CallError, requireRole, row, table, type BackendCall } from '../call-dispatch.js';

interface MenuRow {
  section_key: string;
  section_label: string;
  section_hidden: string;
  link_key: string;
  link_href: string;
  link_label: string;
  link_notImplemented: string;
  link_isSubheading: string;
  link_requiredRoles: string;
  link_hidden: string;
}
const MENU_HEADER: (keyof MenuRow)[] = [
  'section_key',
  'section_label',
  'section_hidden',
  'link_key',
  'link_href',
  'link_label',
  'link_notImplemented',
  'link_isSubheading',
  'link_requiredRoles',
  'link_hidden',
];

export const menuFunctions: Record<string, BackendCall> = {
  // Positional args: [0] businessName ('' = none). userId comes from the
  // authenticated user (req.user.id), never a positional arg - reads
  // stay open to any authenticated user, exactly as the old route did.
  getMenuTree: (v, user) => {
    const businessName = v[0] || undefined;
    const sections = getMenuTree({ businessName, userId: user?.id });
    const rows: MenuRow[] = [];
    for (const s of sections) {
      if (s.links.length === 0) {
        rows.push({ section_key: s.key, section_label: s.label, section_hidden: String(s.hidden), link_key: '', link_href: '', link_label: '', link_notImplemented: '', link_isSubheading: '', link_requiredRoles: '', link_hidden: '' });
        continue;
      }
      for (const l of s.links) {
        rows.push({
          section_key: s.key,
          section_label: s.label,
          section_hidden: String(s.hidden),
          link_key: l.key,
          link_href: l.href,
          link_label: l.label,
          link_notImplemented: String(l.notImplemented),
          link_isSubheading: String(l.isSubheading),
          link_requiredRoles: l.requiredRoles ? l.requiredRoles.join('|') : '',
          link_hidden: String(l.hidden),
        });
      }
    }
    return table(MENU_HEADER, rows);
  },

  // Positional args: [0] menuItemKey, [1] scope ('business'|'user'), [2]
  // scopeId, [3] overrideLabel ('' = null), [4] hidden ('true'|'false').
  // Per the route's own comment: these mutate ANY business/user's menu
  // visibility, so Administrator/Bookkeeper only, same as before.
  setMenuOverride: (v, user) => {
    requireRole(user, 'Administrator', 'Bookkeeper');
    const [menuItemKey, scope, scopeIdRaw, overrideLabel, hiddenRaw] = v;
    if (!menuItemKey || (scope !== 'business' && scope !== 'user') || !scopeIdRaw) {
      throw new CallError(400, 'menuItemKey, scope (business|user), and scopeId are required');
    }
    setMenuOverride(menuItemKey, scope, Number(scopeIdRaw), overrideLabel || null, hiddenRaw === 'true');
    return row('true');
  },
  deleteMenuOverride: (v, user) => {
    requireRole(user, 'Administrator', 'Bookkeeper');
    const [menuItemKey, scope, scopeIdRaw] = v;
    if (!menuItemKey || (scope !== 'business' && scope !== 'user') || !scopeIdRaw) {
      throw new CallError(400, 'menuItemKey, scope (business|user), and scopeId are required');
    }
    deleteMenuOverride(menuItemKey, scope, Number(scopeIdRaw));
    return row('true');
  },
};
