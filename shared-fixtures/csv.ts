// A real, minimal, dependency-free CSV reader/writer, per direct,
// absolute instruction: plain ASCII files, unicode escaped as \uXXXX
// (JavaScript-style), never raw UTF-8 bytes, never JSON. Shared
// identically by backend scripts and e2e Playwright tests - both are
// plain Node/TypeScript, so one real file, one real import path,
// works for both.

export function escapeAscii(text: string): string {
  return Array.from(text)
    .map((ch) => {
      const code = ch.codePointAt(0)!;
      if (code < 128) return ch;
      return '\\u{' + code.toString(16) + '}';
    })
    .join('');
}

export function unescapeAscii(text: string): string {
  return text.replace(/\\u\{([0-9a-fA-F]+)\}/g, (_, hex) => String.fromCodePoint(parseInt(hex, 16)));
}

function splitCsvLine(line: string): string[] {
  const fields: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"' && line[i + 1] === '"') {
        current += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        current += ch;
      }
    } else {
      if (ch === '"') inQuotes = true;
      else if (ch === ',') {
        fields.push(current);
        current = '';
      } else current += ch;
    }
  }
  fields.push(current);
  return fields;
}

function csvField(value: string): string {
  const escaped = escapeAscii(value);
  if (escaped.includes(',') || escaped.includes('"') || escaped.includes('\n')) {
    return '"' + escaped.replace(/"/g, '""') + '"';
  }
  return escaped;
}

/** Reads a real, plain-ASCII CSV file (header row + data rows) into
 * an array of real, plain objects keyed by the header names, with
 * every unicode escape sequence decoded back to a real string. */
export function readCsv(text: string): Record<string, string>[] {
  const lines = text.split('\n').filter((l) => l.trim().length > 0);
  if (lines.length === 0) return [];
  const headers = splitCsvLine(lines[0]).map((h) => h.trim());
  return lines.slice(1).map((line) => {
    const fields = splitCsvLine(line);
    const row: Record<string, string> = {};
    headers.forEach((h, i) => {
      row[h] = unescapeAscii(fields[i] ?? '');
    });
    return row;
  });
}

/** Writes an array of real, plain objects to a real, plain-ASCII CSV
 * string, escaping every non-ASCII character as it goes. */
export function writeCsv(rows: Record<string, string>[], headers: string[]): string {
  const lines = [headers.join(',')];
  for (const row of rows) {
    lines.push(headers.map((h) => csvField(row[h] ?? '')).join(','));
  }
  return lines.join('\n') + '\n';
}
