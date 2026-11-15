// Extracts the application's configuration from what exists today and
// writes it as entities, in ASCII, to application/application.entities.
//
//   extract-application-config.ts <out.entities>
//
// Nothing here is stored as source code. What is extracted:
//
//   Calls        every backend call: from the step runner's screens
//                (shared-fixtures/screens.csv, read only) with its
//                parameters in field order and their types, and from the
//                frontend's API module (frontend/src/lib/api.ts) with the
//                client function that makes it and the arguments it passes
//   Components   each shared component (frontend/src/lib/components)
//   Screens      each page (frontend/src/routes), by route
//
// For a component or a screen: its title, the components it uses with
// their props, the calls it makes, and in document order its headings,
// fields (what they bind, control, type, placeholder, label), actions
// (label, handler) and table columns. Labels are vocabulary keys, the same
// words the existing translation entities hold.

import { readFileSync, readdirSync, statSync, writeFileSync } from 'fs';
import { join, relative, dirname } from 'path';
import { fileURLToPath } from 'url';
import { parse } from 'svelte/compiler';
import ts from 'typescript';
import { Store, type Node } from '../src/core/store.js';
import { dumpEntitiesText } from '../src/entities/entities-text.js';

const here = dirname(fileURLToPath(import.meta.url));
const repo = join(here, '..', '..');
const BY = 0;

// --- a small writer over the store ------------------------------------------

class Writer {
  store = new Store(':memory:');
  private seq = new Map<number, number>();
  root = this.store.create('Root', null, BY);
  active = this.store.create('Active', this.root.id, BY);
  application = this.store.create('Application', this.root.id, BY);
  kinds = this.store.create('Kinds', this.application.id, BY);
  private kindIds = new Map<string, number>();

  kind(name: string, ordered = false): void {
    const k = this.store.create(name, this.kinds.id, BY);
    if (ordered) this.point(k.id, 'Ordered', this.active.id);
    this.kindIds.set(name, k.id);
  }
  folder(name: string, parent = this.application.id): Node {
    return this.store.child(parent, name) ?? this.store.create(name, parent, BY);
  }
  /** A thing; under an ordered parent its name is the next order key. */
  thing(parent: number, kind: string, name?: string): Node {
    const key = name ?? this.nextKey(parent);
    const n = this.store.create(key, parent, BY);
    this.point(n.id, 'Kind', this.kindIds.get(kind)!);
    return n;
  }
  private nextKey(parent: number): string {
    const i = this.seq.get(parent) ?? 0;
    this.seq.set(parent, i + 1);
    return 'k' + String(i).padStart(4, '0');
  }
  value(id: number, relation: string, value: string | undefined): void {
    if (value === undefined || value === '') return;
    const r = this.store.create(relation, id, BY);
    const v = this.store.create(value, r.id, BY);
    this.store.point(r.id, v.id, BY);
  }
  point(id: number, relation: string, target: number): void {
    const r = this.store.create(relation, id, BY);
    this.store.point(r.id, target, BY);
  }
}

const w = new Writer();
for (const [k, ordered] of [
  ['Call', true], ['Parameter', false], ['Component', true], ['Screen', true], ['Use', false],
  ['Heading', false], ['Field', false], ['Action', false], ['Column', false],
] as const) w.kind(k, ordered);
const callsFolder = w.folder('Calls');
const calls = new Map<string, Node>();
const call = (name: string) => calls.get(name) ?? (calls.set(name, w.thing(callsFolder.id, 'Call', name)), calls.get(name)!);

// --- calls, from the step runner's screens (read only) ---------------------------

function csvRows(text: string): Record<string, string>[] {
  const lines = text.split('\n').filter((l) => l.length > 0);
  const split = (line: string) => {
    const out: string[] = [];
    let cur = '';
    let q = false;
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (q) {
        if (c === '"' && line[i + 1] === '"') (cur += '"'), i++;
        else if (c === '"') q = false;
        else cur += c;
      } else if (c === '"') q = true;
      else if (c === ',') out.push(cur), (cur = '');
      else cur += c;
    }
    out.push(cur);
    return out;
  };
  const head = split(lines[0]);
  return lines.slice(1).map((l) => Object.fromEntries(split(l).map((v, i) => [head[i], v])));
}

const screensCsv = csvRows(readFileSync(join(repo, 'shared-fixtures', 'screens.csv'), 'utf-8'));
const byScreen = new Map<string, Record<string, string>[]>();
for (const r of screensCsv) byScreen.set(r.screen_name, [...(byScreen.get(r.screen_name) ?? []), r]);
for (const rows of byScreen.values()) {
  const fn = rows.find((r) => r.api_function)?.api_function;
  if (!fn || call(fn).id !== calls.get(fn)!.id || w.store.child(calls.get(fn)!.id, 'k0000')) continue;
  const c = call(fn);
  for (const r of [...rows].filter((r) => r.field_name).sort((a, b) => Number(a.position) - Number(b.position))) {
    const p = w.thing(c.id, 'Parameter');
    w.value(p.id, 'Name', r.field_name);
    w.value(p.id, 'Type', r.field_type);
  }
}

// --- calls, from the frontend's API module -----------------------------------------

const apiSrc = readFileSync(join(repo, 'frontend', 'src', 'lib', 'api.ts'), 'utf-8');
const apiFile = ts.createSourceFile('api.ts', apiSrc, ts.ScriptTarget.Latest, true);
const clientToCall = new Map<string, string>();
for (const st of apiFile.statements) {
  if (!ts.isVariableStatement(st) || !st.modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword)) continue;
  for (const d of st.declarationList.declarations) {
    if (!ts.isIdentifier(d.name) || !d.initializer) continue;
    let found: { name: string; args?: ts.Expression } | undefined;
    const visit = (n: ts.Node) => {
      if (found) return;
      if (ts.isCallExpression(n) && ts.isIdentifier(n.expression) && /^call/.test(n.expression.text) && n.arguments[0] && ts.isStringLiteral(n.arguments[0])) {
        found = { name: n.arguments[0].text, args: n.arguments[1] };
        return;
      }
      ts.forEachChild(n, visit);
    };
    visit(d.initializer);
    if (!found) continue;
    clientToCall.set(d.name.text, found.name);
    const c = call(found.name);
    w.value(c.id, 'Client', d.name.text);
    if (!w.store.child(c.id, 'k0000') && found.args && ts.isArrayLiteralExpression(found.args)) {
      for (const a of found.args.elements) {
        const p = w.thing(c.id, 'Parameter');
        w.value(p.id, 'Name', a.getText(apiFile));
      }
    }
  }
}

// --- components and screens, from the Svelte source -----------------------------

const WORD = /translations\.current\[\s*(['"])((?:(?!\1).)*)\1\s*\]/;

/** The vocabulary key or plain words an expression or text shows. */
function words(code: string): string {
  const m = WORD.exec(code);
  return m ? m[2] : '';
}

function label(nodes: any[], src: string): string {
  for (const n of nodes) {
    if (n.type === 'Text' && n.data.trim()) return n.data.trim().replace(/\s+/g, ' ');
    if (n.type === 'ExpressionTag') {
      const k = words(src.slice(n.start, n.end));
      if (k) return k;
    }
    if (n.fragment) {
      const inner = label(n.fragment.nodes, src);
      if (inner) return inner;
    }
  }
  return '';
}

function attr(el: any, name: string, src: string): string | undefined {
  const a = el.attributes.find((x: any) => x.name === name && x.type === 'Attribute');
  if (!a || a.value === true) return a ? 'true' : undefined;
  return src.slice(a.start, a.end).replace(/^[^=]*=/, '').replace(/^["']|["']$/g, '');
}

function describe(owner: Node, src: string, file: string): void {
  const ast: any = parse(src, { modern: true });
  // Calls: what it imports from the API module and actually uses.
  const used = new Set<string>();
  const script = ast.instance?.content;
  if (script) {
    for (const st of script.body) {
      if (st.type === 'ImportDeclaration' && st.source.value === '$lib/api') {
        for (const s of st.specifiers) if (clientToCall.has(s.local.name)) used.add(clientToCall.get(s.local.name)!);
      }
    }
  }
  for (const fn of [...used].sort()) w.point(owner.id, `Calls ${fn}`, call(fn).id);

  // A field's label is the text of the legend or label of the nearest
  // element around it that has one.
  const ownLabel = (n: any): string => {
    const holder = (n.fragment?.nodes ?? []).find((c: any) => c.type === 'RegularElement' && (c.name === 'legend' || c.name === 'label'));
    return holder ? label(holder.fragment.nodes, src) : n.name === 'label' ? label(n.fragment.nodes, src) : '';
  };
  const walk = (nodes: any[], legend: string) => {
    for (const n of nodes) {
      if (n.type === 'SvelteHead') {
        const title = n.fragment.nodes.find((x: any) => x.type === 'TitleElement');
        if (title) w.value(owner.id, 'Title', label(title.fragment.nodes, src));
        continue;
      }
      if (n.type === 'Component' && /^[A-Z]/.test(n.name)) {
        const u = w.thing(owner.id, 'Use');
        w.point(u.id, 'Component', componentNode(n.name).id);
        for (const a of n.attributes) {
          if (a.type !== 'Attribute') continue;
          w.value(u.id, `Prop ${a.name}`, a.value === true ? 'true' : src.slice(a.start, a.end).replace(/^[^=]*=/, '').replace(/^["']|["']$/g, ''));
        }
      }
      if (n.type === 'RegularElement') {
        const name = n.name;
        if (name === 'legend' || /^h[1-4]$/.test(name)) {
          const text = label(n.fragment.nodes, src);
          if (text) w.value(w.thing(owner.id, 'Heading').id, 'Text', text);
        }
        if (name === 'input' || name === 'select' || name === 'textarea') {
          const bind = n.attributes.find((a: any) => a.type === 'BindDirective');
          const f = w.thing(owner.id, 'Field');
          w.value(f.id, 'Control', name);
          w.value(f.id, 'Bind', bind ? src.slice(bind.expression.start, bind.expression.end) : undefined);
          w.value(f.id, 'Type', attr(n, 'type', src));
          w.value(f.id, 'Placeholder', attr(n, 'placeholder', src));
          w.value(f.id, 'Label', legend);
        }
        if (name === 'button') {
          const click = n.attributes.find((a: any) => a.name === 'onclick');
          const a = w.thing(owner.id, 'Action');
          w.value(a.id, 'Label', label(n.fragment.nodes, src));
          w.value(a.id, 'Handler', click && click.value !== true ? src.slice(click.start, click.end).replace(/^onclick=\{|\}$/g, '') : undefined);
        }
        if (name === 'th') {
          const text = label(n.fragment.nodes, src);
          if (text) w.value(w.thing(owner.id, 'Column').id, 'Label', text);
        }
      }
      const inner = n.type === 'RegularElement' ? ownLabel(n) || legend : legend;
      for (const key of ['fragment', 'consequent', 'alternate', 'body', 'fallback', 'pending', 'then', 'catch']) {
        if (n[key]?.nodes) walk(n[key].nodes, inner);
      }
    }
  };
  walk(ast.fragment.nodes, '');
  w.value(owner.id, 'Source', file);
}

const componentsFolder = w.folder('Components');
const components = new Map<string, Node>();
function componentNode(name: string): Node {
  if (!components.has(name)) components.set(name, w.thing(componentsFolder.id, 'Component', name));
  return components.get(name)!;
}

function files(dir: string): string[] {
  return readdirSync(dir).sort().flatMap((n) => {
    const p = join(dir, n);
    return statSync(p).isDirectory() ? files(p) : [p];
  });
}

const frontend = join(repo, 'frontend', 'src');
for (const f of files(join(frontend, 'lib', 'components')).filter((f) => f.endsWith('.svelte'))) {
  const name = f.split('/').at(-1)!.replace(/\.svelte$/, '');
  describe(componentNode(name), readFileSync(f, 'utf-8'), relative(repo, f));
}
const screensFolder = w.folder('Screens');
for (const f of files(join(frontend, 'routes')).filter((f) => f.endsWith('/+page.svelte'))) {
  const route = '/' + relative(join(frontend, 'routes'), dirname(f)).replace(/^\.?$/, '');
  describe(w.thing(screensFolder.id, 'Screen', route === '/' ? '/' : route), readFileSync(f, 'utf-8'), relative(repo, f));
}

const out = process.argv[2] ?? join(repo, 'application', 'application.entities');
const text = dumpEntitiesText(w.store);
writeFileSync(out, text);
const count = (w.store.db.prepare('SELECT COUNT(*) AS n FROM entities').get() as { n: number }).n;
console.log(`Wrote ${out}: ${calls.size} calls, ${components.size} components, ${files(join(frontend, 'routes')).filter((f) => f.endsWith('/+page.svelte')).length} screens; ${count} entities, ${text.length} bytes.`);
