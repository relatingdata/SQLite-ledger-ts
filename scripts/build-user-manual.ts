// Assembles the User Manual (docs/user-manual.md) from its chapter documents,
// mirroring build-programmer-manual.ts: direct concatenation, front matter
// first, then the chapters in order.
//
// Run via `make manual`. Replaces build-user-manual.py (this project ships
// no Python).
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const DOCS = fileURLToPath(new URL('../docs/', import.meta.url));
const OUT = join(DOCS, 'user-manual.md');

// Reference (how the application works), Tutorial (a start-to-finish
// walkthrough), then appendix and back matter.
const PARTS: [string, string[]][] = [
  ['Reference', [
    'user-manual-ch0-how-it-started.md',
    'user-manual-ch1-introduction.md',
    'user-manual-ch2-configuration.md',
  ]],
  ['Tutorial', ['user-manual-ch3-tutorial.md']],
  ['Appendix --- Every Screen in the Application', [
    'user-manual-appendix-screens.md',
    'user-manual-appendix-step-runner.md',
  ]],
  ['Back Matter', [
    'user-manual-glossary.md',
    'user-manual-contributors-suggestions-notes.md',
  ]],
];

// Reads a file the way Python's text mode did: universal newlines.
function readText(path: string): string {
  return readFileSync(path, 'utf-8').replace(/\r\n?/g, '\n');
}

// Same count as Python's len(str.splitlines()).
function lineCount(text: string): number {
  if (text === '') return 0;
  const pieces = text.split(/\r\n|[\n\r\v\f\x1c\x1d\x1e\x85\u2028\u2029]/);
  if (pieces[pieces.length - 1] === '') pieces.pop();
  return pieces.length;
}

const pieces: string[] = [readText(join(DOCS, 'user-manual-frontmatter.md'))];
for (const [, files] of PARTS) {
  for (const fname of files) {
    const path = join(DOCS, fname);
    if (!existsSync(path)) {
      console.log(`WARNING: missing ${fname}`);
      continue;
    }
    pieces.push(readText(path));
  }
}

const full = pieces.join('');
writeFileSync(OUT, full, 'utf-8');
console.log(`Wrote ${OUT} (${lineCount(full)} lines)`);
