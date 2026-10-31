// A small, real CLI for examining the live entity tree — the one thing
// this codebase never had: every existing caller of db.getEntityTree()
// (step-runner.ts's own VERIFY_REGISTRY, the web frontend's two tree
// screens) either does a one-off, hardcoded .find()/.some() lookup, or
// renders the WHOLE, unfiltered tree with no search or subtree
// narrowing at all. This script is read-only — it never calls a
// mutating db.ts function.
//
// Usage:
//   tsx scripts/inspect-entities.ts tree [--business NAME] [--root NAME] [--depth N]
//   tsx scripts/inspect-entities.ts search <substring> [--business NAME]
//   tsx scripts/inspect-entities.ts show <exact-name>
//
// See docs/pm-testing-e2e.md and docs/tui-design.md — "entity-tree
// inspection tool".
import * as db from '../src/db.js';

type Row = ReturnType<typeof db.getEntityTree>[number];

function loadTree(business?: string): Row[] {
  return db.getEntityTree(business || undefined);
}

function byId(rows: Row[]): Map<number, Row> {
  return new Map(rows.map((r) => [r.id, r]));
}

function childrenOf(rows: Row[], parentId: number | null): Row[] {
  return rows.filter((r) => r.parent_id === parentId).sort((a, b) => a.name.localeCompare(b.name));
}

function describeRow(r: Row): string {
  const bits: string[] = [];
  if (r.accountnumber) bits.push(`acct#${r.accountnumber}`);
  if (r.is_postable_account) bits.push('postable');
  if (r.balance_minor !== null) bits.push(`balance=${(r.balance_minor / 100).toFixed(2)}${r.currency ? ' ' + r.currency : ''}`);
  return bits.length ? `  [${bits.join(', ')}]` : '';
}

/** Prints a real subtree, rooted at `rootId` (or every parentless row
 * when omitted) — the same kind of recursive walk the web frontend's
 * own read-only tree screen does, but to a given depth and from a given
 * starting point, not always the whole tree. */
function printTree(rows: Row[], rootId: number | null, indent: string, depth: number, maxDepth: number): void {
  if (depth > maxDepth) return;
  for (const child of childrenOf(rows, rootId)) {
    console.log(`${indent}${child.name}${describeRow(child)}  (id=${child.id})`);
    printTree(rows, child.id, indent + '  ', depth + 1, maxDepth);
  }
}

function cmdTree(args: string[]): void {
  const business = flagValue(args, '--business');
  const rootName = flagValue(args, '--root');
  const maxDepth = flagValue(args, '--depth') ? Number(flagValue(args, '--depth')) : Infinity;
  const rows = loadTree(business);
  if (!rootName) {
    printTree(rows, null, '', 0, maxDepth);
    return;
  }
  const root = rows.find((r) => r.name === rootName);
  if (!root) {
    console.error(`No entity named "${rootName}" found${business ? ` under business "${business}"` : ''}.`);
    process.exitCode = 1;
    return;
  }
  console.log(`${root.name}${describeRow(root)}  (id=${root.id})`);
  printTree(rows, root.id, '  ', 1, maxDepth);
}

function cmdSearch(args: string[], needle: string): void {
  const business = flagValue(args, '--business');
  const rows = loadTree(business);
  const lower = needle.toLowerCase();
  const matches = rows.filter((r) => r.name.toLowerCase().includes(lower));
  if (matches.length === 0) {
    console.log(`No entity name contains "${needle}"${business ? ` under business "${business}"` : ''}.`);
    return;
  }
  const idMap = byId(rows);
  for (const m of matches) {
    const parentPath = pathTo(idMap, m.parent_id).join(' › ');
    console.log(`${m.name}${describeRow(m)}  (id=${m.id})${parentPath ? `\n  under: ${parentPath}` : ''}`);
  }
  console.log(`\n${matches.length} match(es).`);
}

function pathTo(idMap: Map<number, Row>, parentId: number | null): string[] {
  const path: string[] = [];
  let cur = parentId !== null ? idMap.get(parentId) : undefined;
  while (cur) {
    path.unshift(cur.name);
    cur = cur.parent_id !== null ? idMap.get(cur.parent_id) : undefined;
  }
  return path;
}

function cmdShow(name: string): void {
  const rows = loadTree(); // unscoped — a name may live outside any one business's own subtree (e.g. real, global Customers/Accounts Payable contacts)
  const idMap = byId(rows);
  const matches = rows.filter((r) => r.name === name);
  if (matches.length === 0) {
    console.log(`No entity named exactly "${name}" found.`);
    return;
  }
  for (const entity of matches) {
    console.log(`\n=== ${entity.name} (id=${entity.id}) ===`);
    console.log(describeRow(entity).trim() || '  (no account/balance fields)');
    const parentChain = pathTo(idMap, entity.parent_id);
    console.log(`Parent chain: ${parentChain.length ? parentChain.join(' › ') : '(none — top-level entity)'}`);
    const children = childrenOf(rows, entity.id);
    console.log(`Children (${children.length}):`);
    for (const c of children) console.log(`  - ${c.name}${describeRow(c)}`);
    // The generic "<entity> — <linkType>" convention setEntityLink uses
    // (Department/Manager tags, Division/Category hierarchy tags, the
    // Customers-container link records the Customers.tsx TUI screen's
    // own filter has to work around) — getEntityLinksPointingAt is the
    // one, real, existing primitive that already reconstructs this
    // naming invariant exactly, rather than a bare substring guess.
    const incomingLinks = db.getEntityLinksPointingAt(entity.name);
    console.log(`Incoming links (${incomingLinks.length}):`);
    for (const l of incomingLinks) console.log(`  - "${l.entityName}" — ${l.linkType}`);
  }
  if (matches.length > 1) console.log(`\nNote: ${matches.length} entities share this exact name (same name, different tree positions).`);
}

function flagValue(args: string[], flag: string): string | undefined {
  const i = args.indexOf(flag);
  return i === -1 ? undefined : args[i + 1];
}

function usage(): void {
  console.error(
    [
      'Usage:',
      '  tsx scripts/inspect-entities.ts tree [--business NAME] [--root NAME] [--depth N]',
      '  tsx scripts/inspect-entities.ts search <substring> [--business NAME]',
      '  tsx scripts/inspect-entities.ts show <exact-name>',
    ].join('\n')
  );
}

function main(): void {
  const [command, ...rest] = process.argv.slice(2);
  if (command === 'tree') return cmdTree(rest);
  if (command === 'search') {
    const needle = rest.find((a) => !a.startsWith('--'));
    if (!needle) { usage(); process.exitCode = 1; return; }
    return cmdSearch(rest, needle);
  }
  if (command === 'show') {
    const name = rest.find((a) => !a.startsWith('--'));
    if (!name) { usage(); process.exitCode = 1; return; }
    return cmdShow(name);
  }
  usage();
  process.exitCode = 1;
}

main();
