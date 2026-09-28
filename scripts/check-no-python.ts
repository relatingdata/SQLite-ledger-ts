// Fails if this project contains any Python: a .py file anywhere, or a build
// file (Makefile, package.json, shell script, TypeScript source) that invokes
// python. The project ships no Python - everything necessary is a TypeScript
// script behind a named Makefile target.
//
// Documentation that merely mentions Python (release notes, history) is
// reported as a warning, not a failure: it is prose, not a script.
//
// Run via `make check-no-python`; part of `make verify-fresh`.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../', import.meta.url));
const SKIP_DIRS = new Set(['node_modules', '.git', '.svelte-kit', 'dist', 'data', 'manual-images', 'test-results', 'playwright-report']);
const SELF = 'scripts/check-no-python.ts';
const BUILD_FILE = /(^|\/)(Makefile|package\.json)$|\.(ts|js|sh|yml|yaml)$/;
// The word python/python3 as a command or name - but not inside a hyphenated
// identifier such as the target name "check-no-python".
const PYTHON_WORD = /(?<![-\w])python3?(?![-\w])/i;
// A line that is only a comment cannot invoke anything.
const COMMENT_LINE = /^\s*(#|\/\/|\*|\/\*)/;

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (SKIP_DIRS.has(name)) continue;
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full, out);
    else out.push(full);
  }
  return out;
}

const pyFiles: string[] = [];
const invocations: string[] = [];
const docMentions: string[] = [];

for (const file of walk(ROOT)) {
  const rel = relative(ROOT, file).split(sep).join('/');
  if (rel.endsWith('.py')) pyFiles.push(rel);
  if (rel === SELF) continue;
  if (BUILD_FILE.test(rel)) {
    readFileSync(file, 'utf-8').split('\n').forEach((line, i) => {
      if (!COMMENT_LINE.test(line) && PYTHON_WORD.test(line)) invocations.push(`${rel}:${i + 1}: ${line.trim().slice(0, 120)}`);
    });
  } else if (rel.endsWith('.md') && rel !== 'docs/programmer-manual.md' && rel !== 'docs/user-manual.md') {
    readFileSync(file, 'utf-8').split('\n').forEach((line, i) => {
      if (PYTHON_WORD.test(line) || /\.py\b/.test(line)) docMentions.push(`${rel}:${i + 1}: ${line.trim().slice(0, 150)}`);
    });
  }
}

if (docMentions.length > 0) {
  console.log(`Note: ${docMentions.length} documentation line(s) mention Python (prose only, not failing):`);
  for (const m of docMentions) console.log(`   ${m}`);
}

if (pyFiles.length === 0 && invocations.length === 0) {
  console.log('No Python files and no Python invocations in the project.');
} else {
  if (pyFiles.length > 0) {
    console.error(`\nFAIL: ${pyFiles.length} Python file(s) - this project ships no Python:`);
    for (const f of pyFiles) console.error(`   ${f}`);
  }
  if (invocations.length > 0) {
    console.error(`\nFAIL: ${invocations.length} build-file line(s) invoking python:`);
    for (const l of invocations) console.error(`   ${l}`);
  }
  process.exit(1);
}
