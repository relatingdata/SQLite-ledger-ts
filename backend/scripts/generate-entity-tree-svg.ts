// Generates a real vector (SVG) illustration of the live entity tree —
// every real (id, name, parent_id) triple, plus every real, labelled
// relationship link ("Belongs To Business", "Belongs To Division")
// overlaid as dashed edges. Real vector output (Graphviz -Tsvg), so
// it's directly importable into Excalidraw or Obsidian, per direct
// request, and scales without pixelation at any zoom level. Requires
// `dot` (graphviz) on PATH.
//
// Usage:
//   tsx scripts/generate-entity-tree-svg.ts [outPath] [--sample N] [--business NAME] [--max-depth D]
//
// --sample N: instead of the whole tree, keep only the first N children
// of every real parent (richest-subtree-first — see sampleTree below —
// not alphabetical, so an actual populated collection wins over a
// near-empty housekeeping node that merely sorts earlier), plus one
// synthetic "… (K more)" node summarizing the rest. Applied recursively
// at every branching point, so "two samples of each type of object"
// (every set of siblings under one parent IS one type — all Items are
// siblings under "Items", all Locations under "Locations") falls out of
// one simple, generic rule rather than a type-specific list.
// --max-depth D: stops recursing past depth D below the root (root
// itself is depth 0) — keeps the sample a broad "one row per type"
// menu instead of a narrow, deep drill into whichever single subtree
// happens to be richest (Chart of Accounts/Vocabulary, in practice).
// --business NAME: scope to one real business (db.getEntityTree's own
// business-filtered walk) instead of the whole, global entity tree.
// Omit --sample for the full, exact tree (the original behavior).
import { execFileSync } from 'child_process';
import { writeFileSync, mkdtempSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { db, getEntitiesWithRelationship, getEntityTree } from '../src/db.js';

function esc(s: string): string {
  if (s.length > 50) s = s.slice(0, 47) + '...';
  return s.replace(/\\/g, '\\\\').replace(/"/g, "'").replace(/[\n\r]/g, ' ');
}

type EntityRow = { id: number; name: string; parent_id: number | null };

/** Keeps only the first `sampleN` children (by name) of every real
 * parent, recursively, adding one synthetic "… (K more)" node per
 * truncated parent. Synthetic nodes get negative ids (never collide with
 * a real sqlite rowid) and are always leaves. */
function sampleTree(
  entities: EntityRow[],
  sampleN: number,
  maxDepth: number = Infinity,
  sampleFromDepth: number = 1
): EntityRow[] {
  const idSet = new Set(entities.map((e) => e.id));
  const byParent = new Map<number | null, EntityRow[]>();
  for (const e of entities) {
    const list = byParent.get(e.parent_id) ?? [];
    list.push(e);
    byParent.set(e.parent_id, list);
  }
  // Richest-subtree-first, not alphabetical: a business's own real
  // domain collections (Items, Locations, Plant, Live Projects, ...)
  // should win the sample over a sparse housekeeping node ("Active
  // Ledger", "Bank Accounts") that merely happens to sort earlier —
  // "two samples of EACH type" means the types that actually have
  // members, not whichever name is alphabetically first. Direct child
  // count is enough: it's exactly the signal that distinguishes a real
  // collection from a near-empty node, without hand-naming any category.
  const directChildCount = new Map<number, number>();
  for (const [parentId, children] of byParent) {
    if (parentId !== null) directChildCount.set(parentId, children.length);
  }
  for (const list of byParent.values()) {
    list.sort((a, b) => (directChildCount.get(b.id) ?? 0) - (directChildCount.get(a.id) ?? 0) || a.name.localeCompare(b.name));
  }

  const kept: EntityRow[] = [];
  let nextSyntheticId = -1;

  function walk(parentId: number | null, depth: number) {
    if (depth > maxDepth) return;
    const children = byParent.get(parentId) ?? [];
    // Below sampleFromDepth, every real child is kept unsampled — e.g.
    // a business's own ~14 top-level category roots (Items, Locations,
    // Plant, Live Projects, ...) should ALL show up as real rows; only
    // each category's own members get sampled down to sampleN.
    const take = depth < sampleFromDepth ? children : children.slice(0, sampleN);
    for (const child of take) {
      kept.push(child);
      walk(child.id, depth + 1);
    }
    const remaining = children.length - take.length;
    if (remaining > 0) {
      kept.push({ id: nextSyntheticId--, name: `… (${remaining} more)`, parent_id: parentId });
    }
  }

  // The real roots of THIS set of entities: a parentless row (the whole,
  // unscoped tree's own case), or — for a --business-scoped tree, whose
  // own top node's real parent_id points OUTSIDE this set entirely (the
  // global "Businesses" entity, never included in a single business's
  // own scoped walk) — any row whose parent isn't itself present here.
  const roots = entities.filter((e) => e.parent_id === null || !idSet.has(e.parent_id));
  for (const root of roots.sort((a, b) => (directChildCount.get(b.id) ?? 0) - (directChildCount.get(a.id) ?? 0) || a.name.localeCompare(b.name))) {
    kept.push(root);
    walk(root.id, 1);
  }
  return kept;
}

function main() {
  const args = process.argv.slice(2);
  let outPath: string | undefined;
  let sampleN: number | undefined;
  let business: string | undefined;
  let maxDepth: number | undefined;
  let sampleFromDepth: number | undefined;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--sample') {
      sampleN = Number(args[++i]);
    } else if (args[i] === '--business') {
      business = args[++i];
    } else if (args[i] === '--max-depth') {
      maxDepth = Number(args[++i]);
    } else if (args[i] === '--sample-from-depth') {
      sampleFromDepth = Number(args[++i]);
    } else if (!outPath) {
      outPath = args[i];
    }
  }

  // Scoped to one business (db.getEntityTree's own, already-proven
  // business-filtered walk) when --business is given — otherwise every
  // real entity, same as the original, unscoped behavior.
  let entities: EntityRow[] = business
    ? getEntityTree(business).map((r) => ({ id: r.id, name: r.name, parent_id: r.parent_id }))
    : (db.prepare(`SELECT id, name, parent_id FROM current_entities`).all() as EntityRow[]);
  const fullCount = entities.length;
  if (sampleN !== undefined && Number.isFinite(sampleN) && sampleN > 0) {
    // Scoped to one business: depth 1 is that business's own category
    // roots (Items, Locations, Plant, ...) — keep every one of them
    // real, and only sample each category's own members (depth 2+),
    // unless the caller explicitly overrides this. Unscoped: sample
    // from the very top, same as the original behavior.
    const effectiveSampleFromDepth = sampleFromDepth ?? (business ? 2 : 1);
    entities = sampleTree(
      entities,
      sampleN,
      maxDepth !== undefined && Number.isFinite(maxDepth) && maxDepth > 0 ? maxDepth : Infinity,
      effectiveSampleFromDepth
    );
  }

  const idToName = new Map(entities.map((e) => [e.id, e.name]));
  const nameToId = new Map<string, number>();
  for (const e of entities) if (!nameToId.has(e.name)) nameToId.set(e.name, e.id);

  const relTypes = ['Belongs To Business', 'Belongs To Division'];
  const relPairs: { type: string; source: string; target: string }[] = [];
  for (const type of relTypes) {
    for (const pair of getEntitiesWithRelationship(type)) {
      relPairs.push({ type, ...pair });
    }
  }

  // A real sqlite rowid is always >= 1; a synthetic "... more" node
  // (sampleTree, above) always gets a negative id — "n-1" is not a
  // valid unquoted DOT identifier, so synthetic nodes get their own
  // "s<N>" prefix instead of "n<N>".
  function nodeId(id: number): string {
    return id < 0 ? `s${-id}` : `n${id}`;
  }

  const lines: string[] = [];
  lines.push('digraph EntityTree {');
  lines.push('  rankdir=LR;');
  lines.push('  graph [nodesep=0.05, ranksep=1.2, splines=line];');
  lines.push('  node [shape=box, style=filled, fillcolor="#f5f0e6", color="#8a6d3b", fontname="Helvetica", fontsize=9, margin=0.05];');
  lines.push('  edge [color="#999999", arrowsize=0.5];');
  for (const e of entities) {
    const style = e.id < 0 ? ', style="filled,dashed", fillcolor="#eeeeee", color="#999999", fontcolor="#777777"' : '';
    lines.push(`  ${nodeId(e.id)} [label="${esc(e.name)}"${style}];`);
  }
  for (const e of entities) {
    if (e.parent_id != null && idToName.has(e.parent_id)) {
      const edgeStyle = e.id < 0 ? ' [style=dotted, color="#999999"]' : '';
      lines.push(`  ${nodeId(e.parent_id)} -> ${nodeId(e.id)}${edgeStyle};`);
    }
  }
  const seen = new Set<string>();
  for (const rel of relPairs) {
    const key = `${rel.type}\u0000${rel.source}\u0000${rel.target}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const srcId = nameToId.get(rel.source);
    const tgtId = nameToId.get(rel.target);
    if (srcId != null && tgtId != null && srcId !== tgtId) {
      lines.push(`  ${nodeId(srcId)} -> ${nodeId(tgtId)} [style=dashed, color="#c0392b", fontcolor="#c0392b", fontsize=8, label="${esc(rel.type)}"];`);
    }
  }
  lines.push('}');

  const tmpDir = mkdtempSync(join(tmpdir(), 'entity-tree-'));
  const dotPath = join(tmpDir, 'entity_tree.dot');
  writeFileSync(dotPath, lines.join('\n'));

  const resolvedOutPath = outPath ?? join(process.cwd(), 'entity_tree.svg');
  execFileSync('dot', ['-Tsvg', dotPath, '-o', resolvedOutPath], { stdio: 'inherit' });
  const sampleNote = sampleN !== undefined ? ` — sampled to ${sampleN} per type from ${fullCount} real entities` : '';
  console.log(`Wrote ${resolvedOutPath} (${entities.length} nodes, ${seen.size} labelled relationships${sampleNote})`);
}

main();
