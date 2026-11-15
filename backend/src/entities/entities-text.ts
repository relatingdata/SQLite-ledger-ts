// The entities as ASCII text, and back. This is the form the application's
// configuration is kept in git (application/application.entities); the
// format is specified in the Programmer's Manual, "Application
// Configuration as Entities":
//
//   one line per entity, indented one space per level
//   NAME, or - for an ordered child (its order key is assigned on load)
//   :KIND           its Kind relation, to /Root/Application/Kinds/KIND
//   >PATH           what the entity itself points at
//   KEY=VALUE       a relation to a value of its own
//   KEY>PATH        a relation to another entity
//
// An entity's things are ordered when it, or its kind, has the relation
// Ordered>/Root/Active. Names, keys, values and path segments are bare
// words ([A-Za-z0-9_.+$@-]) or JSON strings with everything outside
// printable ASCII escaped. Only the current state is written: no history,
// nothing hidden.

import { generateKeyBetween } from 'fractional-indexing';
import type { Store, Node } from '../core/store.js';

// --- writing ---------------------------------------------------------------

const BARE = /^[A-Za-z0-9_.+$@-]+$/;

function token(s: string): string {
  if (BARE.test(s) && s !== '-') return s;
  return JSON.stringify(s).replace(/[\u007f-￿]/g, (c) => '\\u' + c.charCodeAt(0).toString(16).padStart(4, '0'));
}

export function dumpEntitiesText(store: Store): string {
  const kids = (id: number) => store.children(id);
  const childNamed = (id: number, name: string) => store.child(id, name);
  const target = (n: Node) => (n.relation === null ? undefined : store.get(n.relation));
  const root = store.child(null, 'Root');
  if (!root) return '';
  const active = store.child(root.id, 'Active');
  const kinds = (() => {
    const app = store.child(root.id, 'Application');
    return app && store.child(app.id, 'Kinds');
  })();
  const isActive = (n: Node | undefined) => !!n && !!active && n.id === active.id;
  const rel = (id: number, name: string) => {
    const c = childNamed(id, name);
    return c ? target(c) : undefined;
  };
  const hidden = (id: number) => isActive(rel(id, 'Hidden'));
  const kindOf = (id: number) => rel(id, 'Kind');
  const thing = (id: number) => !!childNamed(id, 'Kind');
  const ordered = (id: number) => isActive(rel(id, 'Ordered')) || (!!kindOf(id) && isActive(rel(kindOf(id)!.id, 'Ordered')));
  const path = (n: Node): string => (n.parent === null ? '' : path(store.get(n.parent))) + '/' + token(n.name);
  const byName = (a: Node, b: Node) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0);

  const inline = (c: Node): boolean => {
    if (thing(c.id) || hidden(c.id) || c.relation === null) return false;
    const cs = kids(c.id);
    if (cs.length === 0) return true;
    return cs.length === 1 && cs[0].id === c.relation && kids(cs[0].id).length === 0 && cs[0].relation === null;
  };

  const out: string[] = [];
  const write = (n: Node, depth: number, inOrdered: boolean) => {
    if (hidden(n.id)) return;
    const children = [...kids(n.id)].sort(byName);
    const inl = children.filter(inline);
    const rest = children.filter((c) => !inl.includes(c));
    let line = ' '.repeat(depth) + (inOrdered && thing(n.id) ? '-' : token(n.name));
    const kindRel = inl.find((c) => c.name === 'Kind' && kinds && target(c)!.parent === kinds.id);
    if (kindRel) line += ' :' + token(target(kindRel)!.name);
    if (n.relation !== null) line += ' >' + path(store.get(n.relation));
    for (const c of inl) {
      if (c === kindRel) continue;
      const t = target(c)!;
      line += ' ' + token(c.name) + (t.parent === c.id ? '=' + token(t.name) : '>' + path(t));
    }
    out.push(line);
    const inner = ordered(n.id);
    for (const c of rest) write(c, depth + 1, inner);
  };
  write(root, 0, false);
  return out.join('\n') + '\n';
}

// --- reading ---------------------------------------------------------------

type Token = { str: string } | 'colon' | 'eq' | 'gt' | 'slash';

function tokenise(text: string): Token[][] {
  const groups: Token[][] = [[]];
  let i = 0;
  while (i < text.length) {
    const ch = text[i];
    if (ch === ' ') (groups.push([]), (i += 1));
    else if (ch === ':') (groups.at(-1)!.push('colon'), (i += 1));
    else if (ch === '=') (groups.at(-1)!.push('eq'), (i += 1));
    else if (ch === '>') (groups.at(-1)!.push('gt'), (i += 1));
    else if (ch === '/') (groups.at(-1)!.push('slash'), (i += 1));
    else if (ch === '"') {
      let j = i + 1;
      while (text[j] !== '"') j += text[j] === '\\' ? 2 : 1;
      groups.at(-1)!.push({ str: JSON.parse(text.slice(i, j + 1)) });
      i = j + 1;
    } else {
      let j = i;
      while (j < text.length && !' :=>/"'.includes(text[j])) j += 1;
      groups.at(-1)!.push({ str: text.slice(i, j) });
      i = j;
    }
  }
  return groups.filter((g) => g.length > 0);
}

const words = (tokens: Token[]) => tokens.filter((t): t is { str: string } => typeof t === 'object').map((t) => t.str);

/** Writes the entities described by `text` into an empty store. */
export function loadEntitiesText(store: Store, text: string, by = 0): number {
  if (store.child(null, 'Root')) throw new Error('The store is not empty.');
  const links: [number, string[]][] = [];
  const stack: { depth: number; id: number; lastKey: string | null }[] = [];
  let made = 0;
  store.tx(() => {
    for (const line of text.split('\n')) {
      if (line === '') continue;
      const depth = line.length - line.trimStart().length;
      while (stack.length > 0 && stack.at(-1)!.depth >= depth) stack.pop();
      const parent = stack.at(-1);
      const [head, ...rest] = tokenise(line.slice(depth));
      let name = (head[0] as { str: string }).str;
      if (name === '-' && parent) name = parent.lastKey = generateKeyBetween(parent.lastKey, null);
      const node = store.create(name, parent ? parent.id : null, by);
      made += 1;
      for (const group of rest) {
        if (group[0] === 'colon') {
          links.push([store.create('Kind', node.id, by).id, ['Root', 'Application', 'Kinds', ...words(group)]]);
          made += 1;
        } else if (group[0] === 'gt') {
          links.push([node.id, words(group)]);
        } else if (group[1] === 'eq') {
          const relation = store.create((group[0] as { str: string }).str, node.id, by);
          const value = store.create((group[2] as { str: string }).str, relation.id, by);
          store.point(relation.id, value.id, by);
          made += 2;
        } else {
          links.push([store.create((group[0] as { str: string }).str, node.id, by).id, words(group.slice(2))]);
          made += 1;
        }
      }
      stack.push({ depth, id: node.id, lastKey: null });
    }
    for (const [id, path] of links) {
      let at = store.child(null, path[0]);
      for (const n of path.slice(1)) at = at && store.child(at.id, n);
      if (!at) throw new Error(`No entity at /${path.join('/')}.`);
      store.point(id, at.id, by);
    }
  });
  return made;
}
