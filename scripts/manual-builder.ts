// Shared assembly logic behind both of this project's own, real,
// Markdown-source, pandoc-built manuals - the lean, current-state
// Programmer's Manual (build-programmer-manual.ts) and the full,
// unabridged Historical Design & Decision Log
// (build-historical-manual.ts), which preserves everything the
// Programmer's Manual no longer includes. One, real concatenation
// pipeline; only the file list and output name differ per manual.
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const DOCS = fileURLToPath(new URL('../docs/', import.meta.url));

export type Parts = [string, string[]][];

// Plain-text stand-ins for glyphs the default LaTeX fonts do not support
// (confirmed by a real failed build), so the intended meaning survives.
const REPLACEMENTS: [string, string][] = [
  ['✅', '[done]'],
  ['❌', '[not done]'],
  ['🔜', '[soon]'],
  ['🔧', '[in progress]'],
  ['─', '-'],
  ['│', '|'],
  ['├', '|'],
  ['└', '`'],
  ['┘', "'"],
  ['┌', '.'],
  ['≤', '<='],
  ['◄', '<'],
  ['┐', '.'],
  ['┤', '|'],
];

function fixGlyphs(text: string): string {
  for (const [bad, good] of REPLACEMENTS) text = text.split(bad).join(good);
  return text;
}

// Bump every heading down one level so each document's own "# Title" becomes
// a chapter nested under its "Part" (book-class convention, as in the User
// Manual where "#" is chapter-level).
function bumpHeadings(text: string): string {
  return text.split('\n').map((line) => (line.startsWith('#') ? '#' + line : line)).join('\n');
}

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

export function buildManual(outFile: string, frontmatterFile: string, parts: Parts): void {
  const out = join(DOCS, outFile);
  const pieces: string[] = [readText(join(DOCS, frontmatterFile))];
  for (const [partTitle, files] of parts) {
    pieces.push(`\n\\clearpage\n\n# ${partTitle}\n\n`);
    for (const fname of files) {
      const path = join(DOCS, fname);
      if (!existsSync(path)) {
        console.log(`WARNING: missing ${fname}`);
        continue;
      }
      pieces.push('\n\\clearpage\n\n');
      pieces.push(fixGlyphs(bumpHeadings(readText(path))));
      pieces.push('\n');
    }
  }
  const full = pieces.join('');
  writeFileSync(out, full, 'utf-8');
  console.log(`Wrote ${out} (${lineCount(full)} lines)`);
}
