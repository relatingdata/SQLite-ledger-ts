// Generates docs/role-routes-matrix.md - a real Role x Route matrix,
// read directly from every real requireRole(...)/requireGlobalRole(...)
// call guarding a backend route.
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
// fabricate here: one real screen often calls several real routes,
// each independently role-gated, and a screen with zero data-posting
// routes (most reports) genuinely has no role gate of its own at all.
// What IS real, and already fully enforced, is a Role x Route matrix -
// every real requireRole/requireGlobalRole call already names exactly
// which roles may call it. This script reads that real, enforced
// fact directly from source, the same, honest way screens-inventory
// reads real route files rather than hand-maintaining a table that
// would drift the moment a route's own guard changed.
//
// Run via `make role-routes-matrix`.
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = fileURLToPath(new URL('../', import.meta.url));
const ROUTES_DIR = join(REPO_ROOT, 'backend', 'src', 'routes');
const OUT = join(REPO_ROOT, 'docs', 'role-routes-matrix.md');

interface GuardedRoute {
  file: string;
  method: string;
  path: string;
  roles: string[];
}

function findRouteFiles(dir: string): string[] {
  return readdirSync(dir)
    .filter((f) => f.endsWith('.ts'))
    .map((f) => join(dir, f));
}

// Matches e.g. `fooRouter.post('/:name/receive', requireRole('Administrator', 'Bookkeeper'), (req, res) => {...})`
// or `authRouter.get('/businesses/:business/role-matrix', requireAuth, requireGlobalRole('Administrator'), (req, res) => {...})`.
// Deliberately simple and line-oriented (every real route in this
// codebase is written as one real statement starting with
// `<x>Router.<method>(`, with its real handler always starting
// `(req, res) =>`), matching the same real, direct-from-source
// discipline generate-screens-inventory.ts already uses - never a full
// TypeScript parse for what a regex already reads correctly. Captures
// everything between the route's own path and its own handler's
// opening `(req` directly - a naive `[^)]*` up to the first real `)`
// would wrongly stop inside requireRole(...)'s own, real closing
// paren, silently dropping every real, guarded route entirely (a
// real, confirmed bug found and fixed directly while building this).
const ROUTE_RE = /\w+Router\.(get|post|put|delete|patch)\(\s*(['"`])((?:(?!\2).)*)\2\s*,([\s\S]*?)\(req/g;
const ROLE_CALL_RE = /require(?:Global)?Role\(([^)]*)\)/;

function extractRoles(argsText: string): string[] | null {
  const m = ROLE_CALL_RE.exec(argsText);
  if (!m) return null;
  return [...m[1].matchAll(/'([^']*)'|"([^"]*)"/g)].map((mm) => mm[1] ?? mm[2]);
}

const routes: GuardedRoute[] = [];
const unguarded: { file: string; method: string; path: string }[] = [];

for (const file of findRouteFiles(ROUTES_DIR).sort()) {
  const text = readFileSync(file, 'utf-8');
  // Route declarations can span multiple lines - join first, since the
  // regex above looks for the whole `(...)` call in one shot.
  const joined = text.replace(/\n/g, ' ');
  for (const m of joined.matchAll(ROUTE_RE)) {
    const [, method, , path, argsText] = m;
    const roles = extractRoles(argsText);
    const rel = relative(REPO_ROOT, file).split('/').join('/');
    if (roles) routes.push({ file: rel, method: method.toUpperCase(), path, roles });
    else unguarded.push({ file: rel, method: method.toUpperCase(), path });
  }
}

const roleNames = [...new Set(routes.flatMap((r) => r.roles))].sort();

const out: string[] = [];
out.push('# Role × Route Matrix');
out.push('');
out.push(
  'Every real backend route guarded by `requireRole(...)`/`requireGlobalRole(...)`, grouped by the ' +
    'real role(s) that may call it — read directly from source, never hand-maintained. This is the ' +
    'real, enforced half of "screens v roles": a "screens v roles" matrix does not exist anywhere in ' +
    'this project (no screens.csv column, no doc table, no code) and is not a small, honest thing to ' +
    'fabricate here — one real screen often calls several, independently role-gated routes, and most ' +
    'report screens call none at all. "Roles v users" already exists, fully built: a real, per-business ' +
    'User × Role Cartesian Product (see `docs/user-business-role-matrix-design.md`), edited through a ' +
    'real checkbox grid on the Users screen. Generated directly from source by ' +
    '`scripts/generate-role-routes-matrix.ts` (`make role-routes-matrix`) — never hand-edited.',
);
out.push('');

for (const role of roleNames) {
  out.push(`## ${role}`);
  out.push('');
  out.push('| Method | Route | Source File | Also requires |');
  out.push('|---|---|---|---|');
  for (const r of routes.filter((rt) => rt.roles.includes(role)).sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0))) {
    const also = r.roles.filter((x) => x !== role);
    out.push(`| ${r.method} | ${r.path} | ${r.file} | ${also.length ? also.join(', ') : '—'} |`);
  }
  out.push('');
}

out.push('## Every real route with no role guard at all (open to any authenticated — or, for a route with no `requireAuth` either, any — caller)');
out.push('');
out.push('| Method | Route | Source File |');
out.push('|---|---|---|');
for (const r of unguarded.sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0))) {
  out.push(`| ${r.method} | ${r.path} | ${r.file} |`);
}
out.push('');
out.push(`**${routes.length} real, role-guarded route(s)** across ${roleNames.length} real role(s); **${unguarded.length} route(s)** with no role guard.`);

writeFileSync(OUT, out.join('\n') + '\n', 'utf-8');
console.log(`Wrote ${OUT} (${routes.length} guarded, ${unguarded.length} unguarded)`);
