# Frontend/backend/database version agreement — a real, permanent skill

Per direct instruction: a single, real `VERSION` file at the project root
(e.g. `0.0.0.400`) is the one, real source of truth every part of this
application reads from — never a second, separately-maintained copy that
could silently drift.

## The three, real, distinct version concepts

- **Application version** — the real `VERSION` file itself. The backend
  reads it directly at startup (`getAppVersion()`, `backend/src/server.ts`).
  The frontend reads the exact, same file at build time, via a real Vite
  `define` (`__APP_VERSION__`, `frontend/vite.config.ts`) — never a second,
  hand-maintained copy in `package.json` or anywhere else.
- **Database version** — a real, new `db_version` table (`backend/schema/
  00-core.sql`), exactly one row, enforced by a fixed primary key
  (`CHECK (id = 1)`, since SQLite has no direct "at most one row"
  constraint). This is the one, real place a future migration feature
  checks what version a specific database file was last brought up to
  date with — genuinely distinct from the running application's own
  version, since a database file can outlive many application upgrades.
- **The running backend's own, live-reported version** — returned by the
  real, extended `/api/health` endpoint (`{ ok, appVersion, dbVersion }`).

## The real, frontend-side check

`checkVersion()` (`frontend/src/lib/api.ts`), called once from the root
layout's own `onMount` (skipped during automated tests): fetches `/api/health`,
compares the frontend's own `__APP_VERSION__` against the backend's real,
live `appVersion`, via `compareVersions` — a real, part-by-part numeric
comparison (never a plain string compare, since `"0.0.0.99" > "0.0.0.100"`
lexically but not numerically).

**When they genuinely disagree, whichever side carries the real, lower
version is out of date, and restarts**:
- If the frontend is behind, a real, full page reload (`window.location.reload()`).
- If the backend is behind, a real, clear console warning is the most this
  call can honestly do — the frontend cannot restart the backend process
  from here at all. Stated as a real, honest limitation of the browser
  environment, not worked around by pretending otherwise.

## Verified

The real, extended `/api/health` endpoint tested directly against a live,
running backend — both `appVersion` and `dbVersion` correctly report
`0.0.0.400`. `check-frontend` clean (0 errors). Full backend and frontend
test suites (208 + 24) pass under the new `node` default runtime.

## Real, honest, remaining scope

The backend cannot restart itself when found to be behind — this would
need a real, external supervisor (a wrapper script watching for a specific
exit code, say) that does not yet exist. The database-version mechanism is
built and stamped, but no real migration runner exists yet to actually use
it — this is deliberately deferred, laying only the real foundation asked
for, not a full migration feature.
