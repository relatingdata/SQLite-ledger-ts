import type { EntityNode } from './api';

export interface TreeItem {
  path: string;
  id: number;
  name: string;
  accountnumber: string | null;
  balance_minor: number | null;
}

// Converts the flat parent_id entity list to svelte-treeview's
// dot-separated path format — see docs/pm-frontend-reference.md.
export function toTreePaths(entities: EntityNode[]): TreeItem[] {
  const byParent = new Map<number | null, EntityNode[]>();
  for (const e of entities) {
    const key = e.parent_id;
    if (!byParent.has(key)) byParent.set(key, []);
    byParent.get(key)!.push(e);
  }
  for (const list of byParent.values()) {
    list.sort((a, b) => a.name.localeCompare(b.name));
  }

  const result: TreeItem[] = [];
  function walk(parentId: number | null, prefix: string) {
    const children = byParent.get(parentId) ?? [];
    children.forEach((child, i) => {
      const path = prefix ? `${prefix}.${i + 1}` : `${i + 1}`;
      result.push({
        path,
        id: child.id,
        name: child.name,
        accountnumber: child.accountnumber,
        balance_minor: child.balance_minor,
      });
      walk(child.id, path);
    });
  }
  walk(null, '');
  return result;
}
