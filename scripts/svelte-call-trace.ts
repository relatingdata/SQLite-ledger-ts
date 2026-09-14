#!/usr/bin/env bun
// A real, direct, static trace of what each real frontend screen
// calls, and roughly when - per direct request, tracing execution
// through the real Svelte 5 source, not the compiled JS. A genuine,
// stated limit: this is static, not a runtime trace - Svelte's own
// reactive statements ($effect, $derived) mean some real execution
// doesn't happen as a plain, traceable function call the way this
// script can see; see docs/skill-pattern-recognition-to-tooling.md
// for the honest reasoning behind building this as a real, standing
// tool rather than checking pages by hand.

import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dir, '..', 'frontend', 'src', 'routes');

function findPages(dir: string, out: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) findPages(full, out);
    else if (entry.name === '+page.svelte') out.push(full);
  }
  return out;
}

const pages = findPages(root).sort();
console.log(`Real, static call trace for ${pages.length} real frontend pages.\n`);

for (const pagePath of pages) {
  const route = path.dirname(pagePath).slice(root.length) || '/';
  const content = fs.readFileSync(pagePath, 'utf-8');

  // Every real function imported from the real API client.
  const apiImportMatch = content.match(/import\s*\{([^}]+)\}\s*from\s*['"]\$lib\/api['"]/);
  if (!apiImportMatch) continue; // a real page with no real backend calls at all
  const apiFunctions = apiImportMatch[1]
    .split(',')
    .map((s) => s.trim().split(/\s+as\s+/)[0].replace(/^type\s+/, '').trim())
    .filter((s) => s && !s.startsWith('type'));

  // Real onMount block - a real, direct proxy for "runs on load."
  const onMountMatch = content.match(/onMount\s*\(\s*(?:async\s*)?\(\)\s*=>\s*\{([\s\S]*?)\n\s{2}\}\)/);
  const onMountBody = onMountMatch?.[1] ?? '';
  // A real, named function passed directly to onMount (onMount(loadAll)).
  const onMountNamedMatch = content.match(/onMount\((\w+)\)/);
  const onMountNamedFn = onMountNamedMatch?.[1];
  const namedFnBody = onMountNamedFn ? (content.match(new RegExp(`function ${onMountNamedFn}\\([^)]*\\)[^{]*\\{([\\s\\S]*?)\\n  \\}`))?.[1] ?? '') : '';

  const onLoad: string[] = [];
  const onInteraction: string[] = [];
  for (const fn of apiFunctions) {
    const pattern = new RegExp(`\\b${fn}\\(`);
    const calledOnLoad = pattern.test(onMountBody) || pattern.test(namedFnBody);
    const calledAnywhere = pattern.test(content);
    if (calledOnLoad) onLoad.push(fn);
    else if (calledAnywhere) onInteraction.push(fn);
  }

  if (onLoad.length === 0 && onInteraction.length === 0) continue;
  console.log(`${route}`);
  if (onLoad.length > 0) console.log(`  on load:        ${onLoad.join(', ')}`);
  if (onInteraction.length > 0) console.log(`  on interaction: ${onInteraction.join(', ')}`);
  console.log('');
}
