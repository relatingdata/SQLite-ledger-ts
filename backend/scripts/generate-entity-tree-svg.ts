// Generates a real, complete, vector (SVG) illustration of the entire
// live entity tree — every real (id, name, parent_id) triple, plus
// every real, labelled relationship link ("Belongs To Business",
// "Belongs To Division") overlaid as dashed edges. Real vector output
// (Graphviz -Tsvg), so it's directly importable into Excalidraw or
// Obsidian, per direct request, and scales without pixelation at any
// zoom level. Requires `dot` (graphviz) on PATH.
import { execFileSync } from 'child_process';
import { writeFileSync, mkdtempSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { db, getEntitiesWithRelationship } from '../src/db.js';

function esc(s: string): string {
  if (s.length > 50) s = s.slice(0, 47) + '...';
  return s.replace(/\\/g, '\\\\').replace(/"/g, "'").replace(/[\n\r]/g, ' ');
}

function main() {
  const entities = db.prepare(`SELECT id, name, parent_id FROM current_entities`).all() as { id: number; name: string; parent_id: number | null }[];
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

  const lines: string[] = [];
  lines.push('digraph EntityTree {');
  lines.push('  rankdir=LR;');
  lines.push('  graph [nodesep=0.05, ranksep=1.2, splines=line];');
  lines.push('  node [shape=box, style=filled, fillcolor="#f5f0e6", color="#8a6d3b", fontname="Helvetica", fontsize=9, margin=0.05];');
  lines.push('  edge [color="#999999", arrowsize=0.5];');
  for (const e of entities) lines.push(`  n${e.id} [label="${esc(e.name)}"];`);
  for (const e of entities) {
    if (e.parent_id != null && idToName.has(e.parent_id)) lines.push(`  n${e.parent_id} -> n${e.id};`);
  }
  const seen = new Set<string>();
  for (const rel of relPairs) {
    const key = `${rel.type}\u0000${rel.source}\u0000${rel.target}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const srcId = nameToId.get(rel.source);
    const tgtId = nameToId.get(rel.target);
    if (srcId != null && tgtId != null && srcId !== tgtId) {
      lines.push(`  n${srcId} -> n${tgtId} [style=dashed, color="#c0392b", fontcolor="#c0392b", fontsize=8, label="${esc(rel.type)}"];`);
    }
  }
  lines.push('}');

  const tmpDir = mkdtempSync(join(tmpdir(), 'entity-tree-'));
  const dotPath = join(tmpDir, 'entity_tree.dot');
  writeFileSync(dotPath, lines.join('\n'));

  const outPath = process.argv[2] ?? join(process.cwd(), 'entity_tree.svg');
  execFileSync('dot', ['-Tsvg', dotPath, '-o', outPath], { stdio: 'inherit' });
  console.log(`Wrote ${outPath} (${entities.length} entities, ${seen.size} labelled relationships)`);
}

main();
