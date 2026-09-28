// Docs: docs/function-inventory.md § How it is generated
import ts from 'typescript';
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../', import.meta.url));
const OUT = join(ROOT, 'docs', 'function-inventory.md');
const checkMode = process.argv.includes('--check');
const explainIndex = process.argv.indexOf('--explain');
const explainName = explainIndex >= 0 ? process.argv[explainIndex + 1] : undefined;
const SKIP = new Set(['node_modules', '.git', '.svelte-kit', 'dist', 'data', 'test-results', 'playwright-report']);
const rel = (f: string): string => relative(ROOT, f).split(sep).join('/');

function walkFiles(dir: string, keep: (name: string) => boolean, out: string[] = []): string[] {
  let names: string[];
  try { names = readdirSync(dir).sort(); } catch { return out; }
  for (const name of names) {
    if (SKIP.has(name)) continue;
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walkFiles(full, keep, out);
    else if (keep(name)) out.push(full);
  }
  return out;
}
const tsFiles = (dirs: string[]): string[] => dirs.flatMap((d) => walkFiles(join(ROOT, d), (n) => n.endsWith('.ts') && !n.endsWith('.d.ts')));

type Area = 'production' | 'tests' | 'tooling';
const areaOf = (file: string): Area => {
  if (file.startsWith('backend/src/') || file.startsWith('frontend/src/lib/')) return 'production';
  if (file.startsWith('backend/test/') || file.startsWith('frontend/test/')) return 'tests';
  return 'tooling';
};

interface Use { file: string; enclosing: string; isCall: boolean }
interface Entry { name: string; simple: string; file: string; exported: boolean; prototype: string; symbol: ts.Symbol; uses: Use[]; svelte: Map<string, number> }
interface Scope { label: string; declPrefix: string; files: string[]; svelte: boolean }

const SCOPES: Scope[] = [
  { label: 'Backend', declPrefix: 'backend/src/', files: tsFiles(['backend/src', 'backend/test', 'backend/scripts', 'shared-fixtures', 'scripts']), svelte: false },
  { label: 'Frontend library', declPrefix: 'frontend/src/lib/', files: tsFiles(['frontend/src/lib', 'frontend/test']), svelte: true },
];

const OPTIONS: ts.CompilerOptions = {
  target: ts.ScriptTarget.ES2022,
  module: ts.ModuleKind.ESNext,
  moduleResolution: ts.ModuleResolutionKind.Bundler,
  allowImportingTsExtensions: true,
  noEmit: true,
  skipLibCheck: true,
  strict: false,
  esModuleInterop: true,
  resolveJsonModule: true,
};
const PRINT = ts.TypeFormatFlags.NoTruncation | ts.TypeFormatFlags.UseAliasDefinedOutsideCurrentScope;

const isFunctionValue = (n: ts.Node | undefined): boolean => !!n && (ts.isArrowFunction(n) || ts.isFunctionExpression(n));
const isExported = (n: ts.Node): boolean => (ts.getCombinedModifierFlags(n as ts.Declaration) & ts.ModifierFlags.Export) !== 0;

function enclosingName(node: ts.Node): string {
  for (let p: ts.Node | undefined = node.parent; p; p = p.parent) {
    if (ts.isFunctionDeclaration(p) && p.name) return p.name.text;
    if (ts.isMethodDeclaration(p) && ts.isIdentifier(p.name)) {
      const c = p.parent;
      const owner = ts.isClassDeclaration(c) && c.name ? c.name.text
        : ts.isObjectLiteralExpression(c) && ts.isVariableDeclaration(c.parent) && ts.isIdentifier(c.parent.name) ? c.parent.name.text : '';
      return owner ? `${owner}.${p.name.text}` : p.name.text;
    }
    if (ts.isArrowFunction(p) || ts.isFunctionExpression(p)) {
      const q = p.parent;
      if (ts.isVariableDeclaration(q) && ts.isIdentifier(q.name)) return q.name.text;
      if (ts.isPropertyAssignment(q) && ts.isIdentifier(q.name)) {
        const o = q.parent;
        const owner = ts.isObjectLiteralExpression(o) && ts.isVariableDeclaration(o.parent) && ts.isIdentifier(o.parent.name) ? `${o.parent.name.text}.` : '';
        return owner + q.name.text;
      }
    }
  }
  return '(module level)';
}

function isCallTarget(node: ts.Identifier): boolean {
  const p = node.parent;
  if ((ts.isCallExpression(p) || ts.isNewExpression(p)) && p.expression === node) return true;
  if (ts.isPropertyAccessExpression(p) && p.name === node) {
    const g = p.parent;
    return (ts.isCallExpression(g) || ts.isNewExpression(g)) && g.expression === p;
  }
  return false;
}

function isDeclarationName(node: ts.Identifier): boolean {
  const p = node.parent;
  if (ts.isBindingElement(p) && (p.name === node || p.propertyName === node)) return true;
  return (ts.isFunctionDeclaration(p) || ts.isVariableDeclaration(p) || ts.isMethodDeclaration(p) || ts.isPropertyAssignment(p) || ts.isClassDeclaration(p) || ts.isParameter(p)) && p.name === node;
}

function buildScope(scope: Scope): Entry[] {
  const program = ts.createProgram(scope.files, OPTIONS);
  const checker = program.getTypeChecker();
  const entries: Entry[] = [];
  const bySymbol = new Map<ts.Symbol, Entry>();
  const byDecl = new Map<ts.Node, Entry>();
  const entryFor = (sym: ts.Symbol | undefined): Entry | undefined => {
    if (!sym) return undefined;
    const direct = bySymbol.get(sym);
    if (direct) return direct;
    for (const d of sym.declarations ?? []) {
      const found = byDecl.get(d);
      if (found) return found;
    }
    return undefined;
  };

  const add = (name: string, node: ts.Node, nameNode: ts.Node, exported: boolean, file: string): void => {
    const symbol = checker.getSymbolAtLocation(nameNode);
    if (!symbol) return;
    const sigs = checker.getTypeOfSymbolAtLocation(symbol, node).getCallSignatures();
    const prototype = sigs.length
      ? sigs.map((s) => `${name}${checker.signatureToString(s, node, PRINT)}`.replace(/\s+/g, ' ')).join('\n')
      : `${name}(…)`;
    const entry: Entry = { name, simple: name.split('.').pop() ?? name, file, exported, prototype, symbol, uses: [], svelte: new Map() };
    entries.push(entry);
    bySymbol.set(symbol, entry);
    byDecl.set(node, entry);
  };

  for (const sf of program.getSourceFiles()) {
    const file = rel(sf.fileName);
    if (!file.startsWith(scope.declPrefix) || sf.isDeclarationFile) continue;
    for (const st of sf.statements) {
      if (ts.isFunctionDeclaration(st) && st.name) add(st.name.text, st, st.name, isExported(st), file);
      else if (ts.isClassDeclaration(st) && st.name) {
        for (const m of st.members) if (ts.isMethodDeclaration(m) && ts.isIdentifier(m.name)) add(`${st.name.text}.${m.name.text}`, m, m.name, isExported(st), file);
      } else if (ts.isVariableStatement(st)) {
        for (const d of st.declarationList.declarations) {
          if (!ts.isIdentifier(d.name)) continue;
          const init = d.initializer;
          if (isFunctionValue(init)) add(d.name.text, d, d.name, isExported(d), file);
          else if (init && ts.isObjectLiteralExpression(init)) {
            for (const m of init.properties) {
              if (ts.isMethodDeclaration(m) && ts.isIdentifier(m.name)) add(`${d.name.text}.${m.name.text}`, m, m.name, isExported(d), file);
              else if (ts.isPropertyAssignment(m) && ts.isIdentifier(m.name) && isFunctionValue(m.initializer)) add(`${d.name.text}.${m.name.text}`, m, m.name, isExported(d), file);
            }
          }
        }
      }
    }
  }

  const resolveSymbol = (node: ts.Identifier): ts.Symbol | undefined => {
    const p = node.parent;
    let sym = ts.isShorthandPropertyAssignment(p) ? checker.getShorthandAssignmentValueSymbol(p) : checker.getSymbolAtLocation(node);
    if (sym && (sym.flags & ts.SymbolFlags.Alias)) sym = checker.getAliasedSymbol(sym);
    const decl = sym?.declarations?.[0];
    if (decl && ts.isBindingElement(decl) && ts.isObjectBindingPattern(decl.parent)) {
      const holder = decl.parent.parent;
      const propName = decl.propertyName && ts.isIdentifier(decl.propertyName) ? decl.propertyName.text : ts.isIdentifier(decl.name) ? decl.name.text : undefined;
      if (propName && ts.isVariableDeclaration(holder) && holder.initializer) {
        let prop = checker.getTypeAtLocation(holder.initializer).getProperty(propName);
        if (prop && (prop.flags & ts.SymbolFlags.Alias)) prop = checker.getAliasedSymbol(prop);
        if (prop) sym = prop;
      }
    }
    return sym;
  };

  const wanted = new Set(entries.map((e) => e.simple));
  const audit = new Map<string, { matched: number; resolved: number; unresolved: number }>();
  for (const sf of program.getSourceFiles()) {
    if (sf.isDeclarationFile || !scope.files.some((f) => rel(f) === rel(sf.fileName))) continue;
    const file = rel(sf.fileName);
    const visit = (node: ts.Node): void => {
      if (ts.isIdentifier(node) && wanted.has(node.text)) {
        const p = node.parent;
        const skip = ts.isImportSpecifier(p) || ts.isExportSpecifier(p) || ts.isImportClause(p) || ts.isNamespaceImport(p) || isDeclarationName(node);
        if (!skip) {
          const a = audit.get(file) ?? { matched: 0, resolved: 0, unresolved: 0 };
          a.matched++;
          const sym = resolveSymbol(node);
          const entry = entryFor(sym);
          if (entry) {
            a.resolved++;
            const enclosing = enclosingName(node);
            if (!(enclosing === entry.name && file === entry.file)) entry.uses.push({ file, enclosing, isCall: isCallTarget(node) });
          } else a.unresolved++;
          audit.set(file, a);
        }
      }
      ts.forEachChild(node, visit);
    };
    visit(sf);
  }
  if (explainName) {
    console.log(`[${scope.label}] scanned ${audit.size} files. Name matches per file (matched / resolved to an inventory function):`);
    for (const [f, a] of [...audit.entries()].filter(([f]) => f.startsWith('backend/test') || f.includes('step-runner')).sort()) console.log(`    ${f}: ${a.matched} matched, ${a.resolved} resolved, ${a.unresolved} not`);
  }

  if (scope.svelte) attachSvelte(entries);
  return entries;
}

function attachSvelte(entries: Entry[]): void {
  const byModuleAndName = new Map<string, Entry>();
  for (const e of entries) byModuleAndName.set(`${e.file.replace(/^frontend\/src\/lib\//, '').replace(/\.svelte\.ts$|\.ts$/, '')}::${e.name}`, e);
  for (const file of walkFiles(join(ROOT, 'frontend', 'src'), (n) => n.endsWith('.svelte'))) {
    const text = readFileSync(file, 'utf-8');
    const label = rel(file).replace(/^frontend\/src\//, '').replace(/\/\+page\.svelte$/, '').replace(/^lib\/components\//, '');
    for (const m of text.matchAll(/import\s*\{([^}]*)\}\s*from\s*['"]\$lib\/([^'"]+)['"]/g)) {
      const module = m[2].replace(/\.svelte$/, '');
      for (const raw of m[1].split(',')) {
        const name = raw.trim().replace(/^type\s+/, '').split(/\s+as\s+/)[0].trim();
        const entry = byModuleAndName.get(`${module}::${name}`) ?? byModuleAndName.get(`${module.replace(/\.svelte$/, '')}::${name}`);
        if (!entry) continue;
        const calls = (text.match(new RegExp(`\\b${name}\\s*\\(`, 'g')) ?? []).length;
        entry.svelte.set(label, calls);
      }
    }
  }
}

function describeUses(entry: Entry): string[] {
  const lines: string[] = [];
  for (const area of ['production', 'tests', 'tooling'] as Area[]) {
    const uses = entry.uses.filter((u) => areaOf(u.file) === area);
    if (uses.length === 0) continue;
    if (area !== 'production') {
      const files = [...new Set(uses.map((u) => u.file))];
      const calls = uses.filter((u) => u.isCall).length;
      lines.push(`${area}: ${calls} call(s)${uses.length > calls ? ` and ${uses.length - calls} reference(s)` : ''} in ${files.length} file(s)`);
      continue;
    }
    const byFile = new Map<string, Map<string, { calls: number; values: number }>>();
    for (const u of uses) {
      const f = byFile.get(u.file) ?? new Map();
      const e = f.get(u.enclosing) ?? { calls: 0, values: 0 };
      if (u.isCall) e.calls++; else e.values++;
      f.set(u.enclosing, e);
      byFile.set(u.file, f);
    }
    const parts = [...byFile.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([file, encl]) => {
      const items = [...encl.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([n, c]) => `${n} ${c.calls ? `×${c.calls}` : ''}${c.values ? `${c.calls ? ' ' : ''}(as a value)` : ''}`.trim());
      return `${file.replace(/^(backend|frontend)\/src\/(lib\/)?/, '')} (${items.length > 6 ? `${items.slice(0, 6).join(', ')}, and ${items.length - 6} more` : items.join(', ')})`;
    });
    lines.push(`production: ${parts.length > 8 ? `${parts.slice(0, 8).join('; ')}; and ${parts.length - 8} more file(s)` : parts.join('; ')}`);
  }
  if (entry.svelte.size > 0) {
    const pages = [...entry.svelte.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([p, n]) => `${p} ×${n}`);
    lines.push(`Svelte pages (by name in the file's imports): ${pages.length > 8 ? `${pages.slice(0, 8).join(', ')}, and ${pages.length - 8} more` : pages.join(', ')}`);
  }
  return lines;
}

const out: string[] = [];
out.push('# Function Inventory — every function, its exact prototype, and where it is called from');
out.push('');
out.push('Generated by `scripts/generate-function-inventory.ts` (`make function-inventory`). **Never hand-edited.** `make check-function-inventory` fails if this file is out of date, and it is part of `make verify-fresh`.');
out.push('');
out.push('## How it is generated');
out.push('');
out.push('It uses the TypeScript compiler, not a text search. A prototype is printed by the type checker, so a complex return type is complete. A caller is found by resolving each reference to the *actual* function through imports and re-exports, so two functions that share a name are never confused, and a function passed as a value (Express middleware, for example) is found too. Each entry has no line number on purpose: the file changes only when a prototype or a caller changes, not whenever code above it moves.');
out.push('');
out.push('**Scope.** Every top-level function and method in `backend/src` and `frontend/src/lib`, including those that are not exported, and the methods of exported objects and classes (`Entity.create`). Functions nested inside other functions are internal and not listed. Callers are searched in the whole backend (source, tests, scripts, fixtures) or the frontend library and its tests.');
out.push('');
out.push('**Limits, stated plainly.**');
out.push('');
out.push('- A route handler is an anonymous callback, so its calls show under the file as `(module level)`, not under a handler name.');
out.push('- The compiler does not read `.svelte` files. For the frontend library, Svelte callers are found by matching names imported from `$lib` and are labelled as such.');
out.push('- The frontend reaches the backend over HTTP, so a frontend wrapper and the backend function it calls are separate entries with no link between them.');
out.push('- A function reached only through dynamic access, or through a value typed `any`, would not be found.');
out.push('- SQL triggers, views and functions are not included.');
out.push('');
out.push('<!-- generated:start -->');
out.push('');

const summary: string[] = [];
const sections: string[] = [];
const uncalled: string[] = [];
for (const scope of SCOPES) {
  const entries = buildScope(scope);
  if (explainName) {
    for (const e of entries.filter((x) => x.name === explainName)) {
      console.log(`${scope.label}: ${e.name} in ${e.file}${e.exported ? ' (exported)' : ''}`);
      console.log(`  ${e.uses.length} reference(s) found in ${new Set(e.uses.map((u) => u.file)).size} file(s):`);
      for (const u of e.uses) console.log(`    ${u.file}  ${u.enclosing}  ${u.isCall ? 'call' : 'value'}`);
      if (e.svelte.size > 0) console.log(`  Svelte pages (text match on imports): ${[...e.svelte.entries()].map(([p, n]) => `${p} ×${n}`).join(', ')}`);
    }
    continue;
  }
  const exportedCount = entries.filter((e) => e.exported).length;
  const withProduction = entries.filter((e) => e.uses.some((u) => areaOf(u.file) === 'production') || e.svelte.size > 0).length;
  const onlyOthers = entries.filter((e) => !e.uses.some((u) => areaOf(u.file) === 'production') && e.svelte.size === 0 && e.uses.length > 0).length;
  const none = entries.filter((e) => e.uses.length === 0 && e.svelte.size === 0);
  summary.push(`- **${scope.label}:** ${entries.length} functions (${exportedCount} exported); ${withProduction} are called from production code; ${onlyOthers} only from tests or tooling; ${none.length} from nowhere the compiler could find.`);
  uncalled.push(`### ${scope.label}: functions with no callers found`, '');
  uncalled.push('Candidates to review, not proof of dead code: a function may be reached in a way the limits above cannot see.', '');
  const byFile = new Map<string, string[]>();
  for (const e of none) byFile.set(e.file, [...(byFile.get(e.file) ?? []), `${e.name}${e.exported ? '' : ' (not exported)'}`]);
  if (byFile.size === 0) uncalled.push('None.', '');
  for (const [file, names] of [...byFile.entries()].sort((a, b) => a[0].localeCompare(b[0]))) uncalled.push(`- \`${file}\`: ${names.map((n) => `\`${n}\``).join(', ')}`);
  uncalled.push('');

  sections.push(`## ${scope.label}`, '');
  const files = [...new Set(entries.map((e) => e.file))].sort();
  for (const file of files) {
    sections.push(`### \`${file}\``, '');
    for (const e of entries.filter((x) => x.file === file)) {
      sections.push(`**\`${e.name}\`**${e.exported ? ' *(exported)*' : ''}`, '', '```', e.prototype, '```', '');
      const uses = describeUses(e);
      sections.push(uses.length ? `Called from: ${uses.join(' · ')}` : 'Called from: nowhere the compiler could find.', '');
    }
  }
}

if (explainName) process.exit(0);
out.push('## Summary', '', ...summary, '', ...uncalled, ...sections);
out.push('<!-- generated:end -->');
const content = out.join('\n') + '\n';

if (checkMode) {
  const current = existsSync(OUT) ? readFileSync(OUT, 'utf-8') : '';
  if (current === content) {
    console.log('docs/function-inventory.md is current.');
    process.exit(0);
  }
  console.error('FAIL: docs/function-inventory.md is out of date. Run "make function-inventory" and commit the result.');
  process.exit(1);
}
writeFileSync(OUT, content, 'utf-8');
console.log(`Wrote ${OUT}`);
for (const line of summary) console.log(line.replace(/\*\*/g, ''));
