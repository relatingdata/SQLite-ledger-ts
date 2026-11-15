// The application's source as entities (src/source/): the converter from
// .svelte files to source trees, and writing those trees as entities. The
// LFE emitter that regenerates the files from the entities is checked by
// `make check-source-regenerates`.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { Core } from '../src/core/core.js';
import { svelteToTree, emitTree, writeTree, type SourceNode } from '../src/source/svelte-to-entities.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const frontend = path.join(here, '..', '..', 'frontend', 'src');

function svelteFiles(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    return e.isDirectory() ? svelteFiles(p) : e.name.endsWith('.svelte') ? [p] : [];
  });
}

function kinds(tree: SourceNode, out = new Set<string>()): Set<string> {
  out.add(tree.kind);
  for (const c of tree.children) kinds(c, out);
  return out;
}

test('every .svelte file in the frontend converts to a source tree that emits it back byte for byte', () => {
  const files = svelteFiles(frontend);
  assert.ok(files.length > 100);
  const seen = new Set<string>();
  for (const file of files) {
    const src = fs.readFileSync(file, 'utf-8');
    const tree = svelteToTree(src);
    assert.equal(emitTree(tree), src, path.relative(frontend, file));
    kinds(tree, seen);
  }
  for (const kind of ['Element', 'Attribute', 'Text', 'Expression', 'Block', 'Block Tag', 'Script', 'Statement', 'Style', 'Rule', 'Declaration']) {
    assert.ok(seen.has(kind), `no ${kind} anywhere in the frontend`);
  }
});

test('a component becomes elements, attributes, expressions, block tags, statements and style rules', () => {
  const src = `<script lang="ts">
  let n = $state(1);
</script>

{#if n > 1}<td class="num">{n}</td>{:else}<input bind:value={n} />{/if}

<style>
  .num { text-align: right; }
</style>
`;
  const tree = svelteToTree(src);
  assert.equal(emitTree(tree), src);
  const [script, , block, , style] = tree.children;
  assert.equal(script.kind, 'Script');
  assert.deepEqual(script.children.map((c) => c.kind), ['Attribute', 'Statement', 'Text']);
  assert.equal(script.children[0].rel.Name, 'lang');
  assert.equal(block.kind, 'Block');
  assert.equal(block.rel.Form, 'if');
  assert.deepEqual(block.children.map((c) => [c.kind, c.rel.Code ?? c.rel.Tag]), [
    ['Block Tag', '{#if n > 1}'], ['Element', 'td'], ['Block Tag', '{:else}'], ['Element', 'input'], ['Block Tag', '{/if}'],
  ]);
  const td = block.children[1];
  assert.deepEqual(td.children.map((c) => c.kind), ['Attribute', 'Expression']);
  assert.equal(td.children[1].rel.Code, 'n');
  const input = block.children[3];
  assert.equal(input.rel['Tag End'], ' /');
  assert.equal(input.children[0].rel.Name, 'bind:value');
  assert.equal(input.children[0].children[0].rel.Code, 'n');
  const rule = style.children.find((c) => c.kind === 'Rule')!;
  assert.equal(rule.rel.Selector, '.num');
  assert.deepEqual(rule.children.filter((c) => c.kind === 'Declaration').map((d) => [d.rel.Property, d.rel.Value]), [['text-align', 'right']]);
});

test('a source tree is written as entities: one thing per node, named by order keys, its properties as relations', () => {
  const file = path.join(os.tmpdir(), `sql-ledger-ts-source-${process.pid}.sqlite`);
  for (const suffix of ['', '-wal', '-shm']) fs.rmSync(file + suffix, { force: true });
  const core = new Core(file);
  const src = '<p class="intro">Hello {name}</p>\n';
  const source = core.ensurePath(core.at(['Application']).id, ['Source'], 0);
  const id = writeTree(core, source.id, 'Hello.svelte', svelteToTree(src), 0);
  assert.equal(core.kindOf(id), 'File');
  const [p, newline] = core.things(id);
  assert.deepEqual([p.name, newline.name], ['a0', 'a1']);
  assert.equal(core.kindOf(p.id), 'Element');
  assert.equal(core.value(p.id, 'Tag'), 'p');
  assert.equal(core.value(p.id, 'Closed'), 'yes');
  const [cls, text, expr] = core.things(p.id);
  assert.equal(core.value(cls.id, 'Name'), 'class');
  assert.equal(core.value(core.things(cls.id)[0].id, 'Raw'), 'intro');
  assert.equal(core.value(text.id, 'Raw'), 'Hello ');
  assert.equal(core.value(expr.id, 'Code'), 'name');
  core.close();
});
