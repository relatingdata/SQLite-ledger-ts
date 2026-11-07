// Generates docs/role-routes-matrix.md - a real Role x Call matrix,
// read directly from every real requireRole(...)/requireGlobalRole(...)
// call guarding a real BACKEND_FUNCTIONS entry.
//
// Per direct instruction: written while answering a real, asked
// question - does a "screens v roles" and "roles v users" cartesian
// product already exist in this project's own manuals? "Roles v
// users" already does, fully: a real, per-business User x Role
// Cartesian Product (docs/user-business-role-matrix-design.md,
// getUserRoleMatrix/setUserRoleInBusiness/unsetUserRoleInBusiness in
// backend/src/auth.ts), edited through a real checkbox grid on the
// Users screen. "Screens v roles" does not exist anywhere in this
// project, in any form - no screens.csv column, no doc table, no
// code. A true per-screen mapping is not a small, honest thing to
// fabricate here: one real screen often calls several real backend
// functions, each independently role-gated, and a screen with zero
// data-posting calls (most reports) genuinely has no role gate of its
// own at all.
// What IS real, and already fully enforced, is a Role x Call matrix -
// every real requireRole/requireGlobalRole call already names exactly
// which roles may call it. This script reads that real, enforced
// fact directly from source, the same, honest way screens-inventory
// reads real route files rather than hand-maintaining a table that
// would drift the moment a function's own guard changed.
//
// Rewritten for the ASCII-CSV call-dispatch protocol (task #239/#245
// deleted the old per-path Express routers this script used to read).
// Every real call now lives as one entry in a `BACKEND_FUNCTIONS`-typed
// object literal in backend/src/call-dispatch/*.ts
// (`key: (values, user, lineItems, token) => {...}`), merged into one
// map by backend/src/call-dispatch.ts. There is no middleware chain on
// this path - every gate is an explicit `requireAuth(user)`/
// `requireRole(user, ...)`/`requireGlobalRole(user, ...)` call as the
// first real statement of the entry's own body, so this script reads
// each entry's own first such call directly from source, the same
// deliberately-simple, line-oriented, no-AST-parse discipline the old
// version used (and generate-screens-inventory.ts still uses).
//
// Run via `make role-routes-matrix`.
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = fileURLToPath(new URL('../', import.meta.url));
const DISPATCH_DIR = join(REPO_ROOT, 'backend', 'src', 'call-dispatch');
const OUT = join(REPO_ROOT, 'docs', 'role-routes-matrix.md');

type Scope = 'business' | 'global';

interface GuardedCall {
  file: string;
  name: string;
  scope: Scope;
  roles: string[];
}

interface AuthOnlyCall {
  file: string;
  name: string;
}

interface PublicCall {
  file: string;
  name: string;
}

function findDispatchFiles(dir: string): string[] {
  return readdirSync(dir)
    .filter((f) => f.endsWith('.ts'))
    .map((f) => join(dir, f));
}

// Matches exactly how every real BACKEND_FUNCTIONS entry is written in
// this codebase: two-space indent, `name: (args) => {` or
// `name: async (args) => {` (the one real async entry, exportInvoicePdf).
const ENTRY_START_RE = /^ {2}(\w+): (?:async )?\(/;

// The entry's own first real guard call - an optional `const x = `
// binding (requireRole/requireGlobalRole both return the resolved user,
// which a few entries capture), then require(Global)?Role(user, 'A',
// 'B', ...) or requireAuth(user). Deliberately only the FIRST such call
// in an entry's body is read - every real entry in this codebase makes
// its gate the first statement, and a second, later requireX call (if
// any) only ever narrows further within a branch, never widens.
const GUARD_RE = /(?:const\s+\w+\s*=\s*)?require(Global)?Role\(user,\s*([^)]*)\)|(?:const\s+\w+\s*=\s*)?requireAuth\(user\)/;

function extractRoles(argsText: string): string[] {
  return [...argsText.matchAll(/'([^']*)'|"([^"]*)"/g)].map((mm) => mm[1] ?? mm[2]);
}

const guarded: GuardedCall[] = [];
const authOnly: AuthOnlyCall[] = [];
const fullyPublic: PublicCall[] = [];

for (const file of findDispatchFiles(DISPATCH_DIR).sort()) {
  const lines = readFileSync(file, 'utf-8').split('\n');
  const rel = relative(REPO_ROOT, file).split('/').join('/');
  const starts: { line: number; name: string }[] = [];
  for (let i = 0; i < lines.length; i++) {
    const m = ENTRY_START_RE.exec(lines[i]);
    if (m) starts.push({ line: i, name: m[1] });
  }
  for (let i = 0; i < starts.length; i++) {
    const bodyStart = starts[i].line;
    const bodyEnd = i + 1 < starts.length ? starts[i + 1].line : lines.length;
    const body = lines.slice(bodyStart, bodyEnd).join('\n');
    const m = GUARD_RE.exec(body);
    const name = starts[i].name;
    if (!m) {
      fullyPublic.push({ file: rel, name });
    } else if (m[1] === undefined && m[2] === undefined) {
      // requireAuth(user) matched (the whole alternative has no capture groups of its own)
      authOnly.push({ file: rel, name });
    } else {
      guarded.push({ file: rel, name, scope: m[1] === 'Global' ? 'global' : 'business', roles: extractRoles(m[2]) });
    }
  }
}

const roleNames = [...new Set(guarded.flatMap((r) => r.roles))].sort();

const out: string[] = [];
out.push('# Role × Call Matrix');
out.push('');
out.push(
  'Every real `BACKEND_FUNCTIONS` entry guarded by `requireRole(...)`/`requireGlobalRole(...)`, grouped by the ' +
    'real role(s) that may call it — read directly from source, never hand-maintained. This is the ' +
    'real, enforced half of "screens v roles": a "screens v roles" matrix does not exist anywhere in ' +
    'this project (no screens.csv column, no doc table, no code) and is not a small, honest thing to ' +
    'fabricate here — one real screen often calls several, independently role-gated backend functions, ' +
    'and most report screens call none at all. "Roles v users" already exists, fully built: a real, ' +
    'per-business User × Role Cartesian Product (see `docs/user-business-role-matrix-design.md`), ' +
    'edited through a real checkbox grid on the Users screen. Generated directly from source by ' +
    '`scripts/generate-role-routes-matrix.ts` (`make role-routes-matrix`) — never hand-edited.',
);
out.push('');
out.push(
  'Every real call goes through one generic endpoint (`POST /api/call`, see `backend/src/routes/call.ts`) — ' +
    'there is no per-call Express route or middleware chain to read a guard off of. Instead, every real ' +
    'guard is an explicit `requireAuth(user)`/`requireRole(user, ...)`/`requireGlobalRole(user, ...)` call ' +
    'as the first real statement of the call\'s own entry in `backend/src/call-dispatch/*.ts` — this table ' +
    'reads that first call directly. "Global" roles are checked across the whole account '  +
    '(`requireGlobalRole`); "Business" roles are checked against the caller\'s role in their currently ' +
    'selected business (`requireRole`, the per-business role matrix).',
);
out.push('');

for (const role of roleNames) {
  out.push(`## ${role}`);
  out.push('');
  out.push('| Call | Scope | Source File | Also requires |');
  out.push('|---|---|---|---|');
  for (const r of guarded.filter((rt) => rt.roles.includes(role)).sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0))) {
    const also = r.roles.filter((x) => x !== role);
    out.push(`| ${r.name} | ${r.scope === 'global' ? 'Global' : 'Business'} | ${r.file} | ${also.length ? also.join(', ') : '—'} |`);
  }
  out.push('');
}

out.push('## Every real call with no role guard, only `requireAuth` (open to any logged-in caller)');
out.push('');
out.push('| Call | Source File |');
out.push('|---|---|');
for (const r of authOnly.sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0))) {
  out.push(`| ${r.name} | ${r.file} |`);
}
out.push('');

out.push('## Every real call with no auth check at all (genuinely public — e.g. login, customer self-registration, pre-login translations)');
out.push('');
out.push('| Call | Source File |');
out.push('|---|---|');
for (const r of fullyPublic.sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0))) {
  out.push(`| ${r.name} | ${r.file} |`);
}
out.push('');

out.push(
  `**${guarded.length} real, role-guarded call(s)** across ${roleNames.length} real role(s); ` +
    `**${authOnly.length} call(s)** requiring only a logged-in user; **${fullyPublic.length} fully public call(s)**.`,
);

writeFileSync(OUT, out.join('\n') + '\n', 'utf-8');
console.log(`Wrote ${OUT} (${guarded.length} guarded, ${authOnly.length} auth-only, ${fullyPublic.length} public)`);
