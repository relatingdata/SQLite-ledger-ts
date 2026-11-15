// Brings .svelte files into the entities under Application/Source.
//
//   source-import.ts --fresh <application.sqlite> <dir>...   build the database from scratch
//   source-import.ts <application.sqlite> <dir>...           absorb files changed on disk
//
// Every .svelte file under each <dir> is converted to a source tree,
// checked to emit back to exactly the same bytes, and written under
// Application/Source/<path>: one Folder entity per directory, one File
// entity per file, whose Digest relation is the SHA-256 of its text.
//
// Absorbing is for the time before the source tree editor exists, when a
// file may still be edited by hand: a file whose digest differs is retired
// (renamed, marked Hidden, kept in the history) and written again; a file
// no longer on disk is retired; unchanged files are not touched. Nothing is
// ever deleted.

import { createHash } from 'crypto';
import { readdirSync, readFileSync, rmSync, statSync } from 'fs';
import { join, relative, resolve } from 'path';
import { Core } from '../src/core/core.js';
import type { Node } from '../src/core/store.js';
import { svelteToTree, emitTree, writeTree, type SourceNode } from '../src/source/svelte-to-entities.js';

const IMPORT_USER = 0;

function svelteFiles(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir).sort()) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) out.push(...svelteFiles(path));
    else if (name.endsWith('.svelte')) out.push(path);
  }
  return out;
}

function count(tree: SourceNode): number {
  return 1 + tree.children.reduce((n, c) => n + count(c), 0);
}

function digest(text: string): string {
  return createHash('sha256').update(text, 'utf-8').digest('hex');
}

/** Every visible File entity under a folder, keyed by its path. */
function filesUnder(core: Core, folder: Node, prefix: string, out: Map<string, Node>): Map<string, Node> {
  for (const child of core.things(folder.id)) {
    if (core.is(child.id, 'Hidden')) continue;
    const path = prefix ? `${prefix}/${child.name}` : child.name;
    if (core.kindOf(child.id) === 'Folder') filesUnder(core, child, path, out);
    else if (core.kindOf(child.id) === 'File') out.set(path, child);
  }
  return out;
}

function retire(core: Core, file: Node): void {
  core.store.rename(file.id, `${file.name} (retired #${file.id})`, IMPORT_USER);
  core.relate(file.id, 'Hidden', true, IMPORT_USER);
}

function main(): void {
  const args = process.argv.slice(2);
  const fresh = args[0] === '--fresh';
  const [dbPath, ...dirs] = fresh ? args.slice(1) : args;
  if (!dbPath || dirs.length === 0) throw new Error('Usage: source-import.ts [--fresh] <application.sqlite> <dir>...');
  const root = resolve(process.cwd(), '..');

  const texts = new Map<string, string>();
  const trees = new Map<string, SourceNode>();
  let failed = 0;
  for (const file of dirs.flatMap((d) => svelteFiles(resolve(d)))) {
    const path = relative(root, file);
    const src = readFileSync(file, 'utf-8');
    try {
      const tree = svelteToTree(src);
      if (emitTree(tree) !== src) throw new Error('emits different bytes');
      trees.set(path, tree);
      texts.set(path, src);
    } catch (err) {
      failed += 1;
      console.error(`✗ ${path}: ${err instanceof Error ? err.message : err}`);
    }
  }
  if (failed > 0) throw new Error(`${failed} files could not be converted exactly; nothing was written.`);

  if (fresh) for (const suffix of ['', '-wal', '-shm']) rmSync(dbPath + suffix, { force: true });
  const core = new Core(dbPath);
  let written = 0;
  let retired = 0;
  let nodes = 0;
  core.store.tx(() => {
    const source = core.ensurePath(core.at(['Application']).id, ['Source'], IMPORT_USER);
    const existing = filesUnder(core, source, '', new Map());
    for (const [path, tree] of trees) {
      const sum = digest(texts.get(path)!);
      const old = existing.get(path);
      existing.delete(path);
      if (old && core.value(old.id, 'Digest') === sum) continue;
      if (old) (retire(core, old), (retired += 1));
      const parts = path.split('/');
      let folder = source.id;
      for (const dir of parts.slice(0, -1)) folder = core.thing(dir, folder, 'Folder', IMPORT_USER).id;
      const id = writeTree(core, folder, parts.at(-1)!, tree, IMPORT_USER);
      core.relate(id, 'Digest', sum, IMPORT_USER);
      written += 1;
      nodes += count(tree);
    }
    // Files under the imported directories that are gone from disk.
    const scopes = dirs.map((d) => relative(root, resolve(d)));
    for (const [path, file] of existing) {
      if (scopes.some((s) => path.startsWith(s + '/'))) (retire(core, file), (retired += 1));
    }
  });
  const rows = (core.store.db.prepare('SELECT COUNT(*) AS n FROM entities').get() as { n: number }).n;
  core.close();
  console.log(`${fresh ? 'Imported' : 'Absorbed'} ${trees.size} files: ${written} written (${nodes} source nodes), ${retired} retired, ${trees.size - written} unchanged; ${rows} entity rows in ${dbPath}.`);
}

main();
