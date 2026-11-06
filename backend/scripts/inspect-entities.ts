// A small, real CLI for examining the live entity tree — the one thing
// this codebase never had: every existing caller of db.getEntityTree()
// (step-runner.ts's own VERIFY_REGISTRY, the web frontend's two tree
// screens) either does a one-off, hardcoded .find()/.some() lookup, or
// renders the WHOLE, unfiltered tree with no search or subtree
// narrowing at all. This script is read-only — it never calls a
// mutating db.ts function.
//
// Usage:
//   tsx scripts/inspect-entities.ts tree [--business NAME] [--root NAME] [--depth N] [--format text|lisp]
//   tsx scripts/inspect-entities.ts search <substring> [--business NAME]
//   tsx scripts/inspect-entities.ts show <exact-name>
//   tsx scripts/inspect-entities.ts verify-formats [--business NAME] [--root NAME] [--depth N]
//
// --format lisp: the same real tree, pretty-printed as an indented Lisp
// s-expression (one node per `(name :key val ...)` form, nested exactly
// as the entity graph nests) instead of the default indented-text form —
// useful alongside this engagement's own Kaappi/Scheme entity-driver work,
// where the tree's real, eventual home is a Lisp process.
//
// verify-formats: a permanent regression check, not a one-off script —
// renders the SAME rows through the real printTree/printLispTree
// functions (the identical code `tree` itself calls, captured instead of
// printed), parses both outputs back into a flat (name, depth, order)
// sequence, and asserts the two sequences are identical. This is the
// actual, standing proof that --format text and --format lisp are two
// renderings of one query result rather than two independent data paths
// that might silently drift apart after a future edit.
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
 * starting point, not always the whole tree.
 *
 * `sink` defaults to `console.log` for real CLI output, but `verify-formats`
 * passes a capturing sink instead — same walk, same node ordering, just
 * collected into an array rather than printed, so the regression check
 * exercises this exact function rather than a reimplementation of it. */
function printTree(rows: Row[], rootId: number | null, indent: string, depth: number, maxDepth: number, sink: (line: string) => void = console.log): void {
  if (depth > maxDepth) return;
  for (const child of childrenOf(rows, rootId)) {
    sink(`${indent}${child.name}${describeRow(child)}  (id=${child.id})`);
    printTree(rows, child.id, indent + '  ', depth + 1, maxDepth, sink);
  }
}

// A bare Lisp symbol can't contain unescaped whitespace/parens/quotes —
// quoted as a real Scheme string literal when it needs that, rather than
// pretending every entity name is a bare symbol.
function lispAtom(name: string): string {
  if (/^[A-Za-z0-9_+\-*/.!?<>=]+$/.test(name)) return name;
  return `"${name.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
}

function lispKeys(r: Row): string {
  const bits: string[] = [];
  if (r.accountnumber) bits.push(`:acct ${lispAtom(r.accountnumber)}`);
  if (r.is_postable_account) bits.push(':postable #t');
  if (r.balance_minor !== null) bits.push(`:balance ${(r.balance_minor / 100).toFixed(2)}${r.currency ? ` :currency ${lispAtom(r.currency)}` : ''}`);
  return bits.length ? ` ${bits.join(' ')}` : '';
}

/** Same recursive walk as printTree, but emitting one Lisp s-expression
 * node per entity — `(name :key val ... child1 child2 ...)` — instead of
 * indented plain text. Same `sink` convention as printTree, for the same
 * reason (verify-formats captures instead of printing). */
function printLispTree(rows: Row[], rootId: number | null, indent: string, depth: number, maxDepth: number, sink: (line: string) => void = console.log): void {
  if (depth > maxDepth) return;
  for (const child of childrenOf(rows, rootId)) {
    const grandchildren = depth < maxDepth ? childrenOf(rows, child.id) : [];
    if (grandchildren.length === 0) {
      sink(`${indent}(${lispAtom(child.name)}${lispKeys(child)})`);
    } else {
      sink(`${indent}(${lispAtom(child.name)}${lispKeys(child)}`);
      printLispTree(rows, child.id, indent + '  ', depth + 1, maxDepth, sink);
      sink(`${indent} )`);
    }
  }
}

/** Renders the full `tree` output for one format into an array of lines,
 * instead of printing it — the exact same logic `cmdTree` runs (same
 * wrapper handling for the no-`--root` and `--root NAME` cases), factored
 * out so `cmdTree` and `cmdVerifyFormats` share one real code path rather
 * than `verify-formats` re-deriving its own copy of what `tree` does. */
function renderTreeLines(rows: Row[], rootName: string | undefined, maxDepth: number, format: 'text' | 'lisp'): string[] {
  const lines: string[] = [];
  const sink = (line: string) => lines.push(line);
  const walk = format === 'lisp' ? printLispTree : printTree;
  if (!rootName) {
    if (format === 'lisp') sink('(entity-tree');
    walk(rows, null, format === 'lisp' ? '  ' : '', 0, maxDepth, sink);
    if (format === 'lisp') sink(')');
    return lines;
  }
  const root = rows.find((r) => r.name === rootName);
  if (!root) return lines; // caller already validated existence when it matters (cmdTree); verify-formats treats an empty result as "nothing to compare"
  if (format === 'lisp') {
    const children = childrenOf(rows, root.id);
    if (children.length === 0 || maxDepth < 1) {
      sink(`(${lispAtom(root.name)}${lispKeys(root)})`);
    } else {
      sink(`(${lispAtom(root.name)}${lispKeys(root)}`);
      printLispTree(rows, root.id, '  ', 1, maxDepth, sink);
      sink(' )');
    }
    return lines;
  }
  sink(`${root.name}${describeRow(root)}  (id=${root.id})`);
  printTree(rows, root.id, '  ', 1, maxDepth, sink);
  return lines;
}

/** Parses `--format text` output back into a flat (name, depth) sequence,
 * in on-screen order — depth read from indentation (2 spaces per level),
 * name read up to the first "  (id=" or "  [...]" suffix `describeRow`/
 * the id tag may add. */
function parseTextSequence(lines: string[]): { name: string; depth: number }[] {
  return lines
    .filter((l) => l.trim())
    .map((line) => {
      const indent = line.match(/^ */)![0].length;
      const name = line.trim().split('  (id=')[0].replace(/\s*\[[^\]]*\]$/, '').trim();
      return { name, depth: indent / 2 };
    });
}

/** Parses `--format lisp` output back into a flat (name, depth) sequence,
 * in on-screen order — depth read from paren nesting, name read as the
 * first atom or quoted string after each `(`. The one synthetic,
 * non-entity wrapper form (`(entity-tree ...)`, only present when no
 * `--root` was given) is discounted so depth lines up with the text
 * form's own, wrapper-free depth-0 top level. */
function parseLispSequence(lines: string[]): { name: string; depth: number }[] {
  const raw = lines.join('\n');
  const seq: { name: string; depth: number }[] = [];
  let depth = -1; // pre-increment on '(' below brings the first real node to depth 0
  let sawWrapper = false;
  let i = 0;
  while (i < raw.length) {
    const ch = raw[i];
    if (ch === '(') {
      depth++;
      i++;
      let name = '';
      if (raw[i] === '"') {
        i++;
        while (raw[i] !== '"') { name += raw[i] === '\\' ? raw[++i] : raw[i]; i++; }
        i++;
      } else {
        while (i < raw.length && /[^\s()]/.test(raw[i])) { name += raw[i]; i++; }
      }
      if (name === 'entity-tree' && depth === 0) { sawWrapper = true; continue; }
      seq.push({ name, depth: sawWrapper ? depth - 1 : depth });
    } else if (ch === ')') {
      depth--;
      i++;
    } else {
      i++;
    }
  }
  return seq;
}

function cmdTree(args: string[]): void {
  const business = flagValue(args, '--business');
  const rootName = flagValue(args, '--root');
  const maxDepth = flagValue(args, '--depth') ? Number(flagValue(args, '--depth')) : Infinity;
  const format = flagValue(args, '--format') ?? 'text';
  if (format !== 'text' && format !== 'lisp') {
    console.error(`--format must be "text" or "lisp", got "${format}".`);
    process.exitCode = 1;
    return;
  }
  const rows = loadTree(business);
  if (rootName && !rows.find((r) => r.name === rootName)) {
    console.error(`No entity named "${rootName}" found${business ? ` under business "${business}"` : ''}.`);
    process.exitCode = 1;
    return;
  }
  for (const line of renderTreeLines(rows, rootName, maxDepth, format)) console.log(line);
}

/** Permanent regression check (not a one-off): confirms --format text and
 * --format lisp render the exact same (name, depth) sequence, in the
 * exact same order, for the exact same real rows — by calling the real
 * `tree` rendering path (via renderTreeLines, which both cmdTree and this
 * use) twice, once per format, and diffing the parsed results. Exits
 * non-zero with every mismatch listed if the two formats ever disagree —
 * e.g. if a future edit to one of printTree/printLispTree's recursive
 * walks drifts out of sync with the other. */
function cmdVerifyFormats(args: string[]): void {
  const business = flagValue(args, '--business');
  const rootName = flagValue(args, '--root');
  const maxDepth = flagValue(args, '--depth') ? Number(flagValue(args, '--depth')) : Infinity;
  const rows = loadTree(business);
  if (rootName && !rows.find((r) => r.name === rootName)) {
    console.error(`No entity named "${rootName}" found${business ? ` under business "${business}"` : ''}.`);
    process.exitCode = 1;
    return;
  }
  const textSeq = parseTextSequence(renderTreeLines(rows, rootName, maxDepth, 'text'));
  const lispSeq = parseLispSequence(renderTreeLines(rows, rootName, maxDepth, 'lisp'));
  console.log(`text nodes: ${textSeq.length}, lisp nodes: ${lispSeq.length}`);
  if (textSeq.length !== lispSeq.length) {
    console.error('MISMATCH: different node counts.');
    process.exitCode = 1;
    return;
  }
  let mismatches = 0;
  for (let k = 0; k < textSeq.length; k++) {
    if (textSeq[k].name !== lispSeq[k].name || textSeq[k].depth !== lispSeq[k].depth) {
      console.error(`MISMATCH at index ${k}: text=${JSON.stringify(textSeq[k])} lisp=${JSON.stringify(lispSeq[k])}`);
      mismatches++;
    }
  }
  if (mismatches > 0) {
    console.error(`${mismatches} mismatch(es) found.`);
    process.exitCode = 1;
    return;
  }
  console.log('EQUIVALENT: identical (name, depth) sequence in identical order.');
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
      '  tsx scripts/inspect-entities.ts tree [--business NAME] [--root NAME] [--depth N] [--format text|lisp]',
      '  tsx scripts/inspect-entities.ts search <substring> [--business NAME]',
      '  tsx scripts/inspect-entities.ts show <exact-name>',
      '  tsx scripts/inspect-entities.ts verify-formats [--business NAME] [--root NAME] [--depth N]',
    ].join('\n')
  );
}

function main(): void {
  const [command, ...rest] = process.argv.slice(2);
  if (command === 'tree') return cmdTree(rest);
  if (command === 'verify-formats') return cmdVerifyFormats(rest);
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
