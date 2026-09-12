# Release Notes

Formal record of real, checkpoint-by-checkpoint changes — what was
resolved, and what remains genuinely outstanding at each point. Newest
checkpoint first. Under git control, alongside every other real
document in `docs/`.

**A real, honest note on scope**: this document begins at checkpoint
210. Real work happened at every earlier checkpoint too (see
`docs/lessons-learned.md` for the fuller, running narrative of that
work, and `docs/function-inventory.md` / `docs/entity-model.md` for
what the codebase looks like today) — checkpoints 1 through 209 are
not retroactively written up here, since doing so accurately would
mean reconstructing history no longer fully available (see the
git-history-loss incident, resolved below). Every checkpoint from 210
onward gets a real, contemporaneous entry here, written at the time,
not reconstructed after the fact.

---

## Checkpoint 210

### Resolved

- **`getBusinessTypes()` ordering bug.** The business-type list had no
  `ORDER BY` clause, so SQLite's own incidental return order made
  "Incorporated Company" the real, actual default a person would see
  first, not the sensible "Sole Trader." Fixed with `ORDER BY id`,
  verified directly.
- **A real, genuine application bug in the new-business form.**
  `<select value={selectedBusinessType}>` bound a whole object while
  its own `<option value={bt.name}>` elements use plain strings —
  Svelte silently reset the real, live DOM selection back to empty on
  every reactive re-render. A real user's own selection would have
  appeared to work, then silently reverted. Fixed by binding to the
  matching string (`selectedBusinessType?.name`).
- **`option:checked` CSS pseudo-selector hang**, found while testing
  the fix above: this selector never matched after `selectOption` in
  this browser context, causing an indefinite hang. Fixed by using
  `inputValue()` instead — Playwright's own established, reliable
  method for a `<select>`'s current value.
- **Business-type selector wired into the real, live new-business
  UI** — a database-driven dropdown (`GET /businesses/types`) replacing
  the prior hardcoded array, mapped onto the already-working
  `setupEquityStructure` mechanism rather than risking a rewrite of
  working code. Each type's own real questions render as free-text
  inputs, answered via a new `saveBusinessTypeAnswers` endpoint
  (composing the existing `Detail` primitive).
- **`createBusiness` confirmed genuinely working**, resolving a real
  scare from investigating the above: verified directly against the
  live backend API (not a separate reader process) that a newly
  created business exists with a real ID and a clean `201` response.
  The earlier appearance of failure was traced to a real limitation in
  a separate-process database reader used for diagnosis (a genuine
  SQLite WAL-visibility gap), not a bug in the application itself.
- **Documentation**: tutorial chapter in the user manual updated with
  real, current screenshots through the Trial Balance step;
  programmer's manual gained a full section on the primitive set
  (`Entity`/`Link`/`Balance`/`Currency`/`Detail`), hierarchical access,
  and a concrete Svelte 5 runes migration plan.
- **Git history loss incident** (working directory lost to an
  environment reset; no bundle existed past checkpoint 206) —
  recovered the most complete real history that exists (384 commits),
  overlaid the current, correct file state as one honestly-labeled
  commit, and wrote a full incident memo with measured size statistics
  of the affected span (~16.4% of the codebase). Standing practice
  changed: a `git bundle` is now created after every real commit, not
  periodically.
- **A real, meaningless "passing" test caught and named as a lesson**:
  a debug script with zero real `expect()` assertions reported "1
  passed" while investigating answer persistence, briefly obscuring a
  more serious finding underneath. Recorded in `lessons-learned.md` so
  the pattern is named, not just fixed once.

### Outstanding

- **Whether a business's own answered question values (e.g. "Owner
  name") genuinely persist end-to-end** is not yet confirmed with full
  confidence — the investigation surfaced a real diagnostic tooling
  gap (the WAL-visibility issue above) before a clean, final
  verification was completed. Needs a repeat check using the live API
  as the source of truth, not a separate reader process.
- **No business created today is linked to a business-type record
  itself** — only the free-text question answers are saved via
  `Detail`. The business-to-business-type relationship itself (a real,
  named `Link`) is not yet established.
- **Employee login does not exist as a feature.** Creating an
  "employee" only creates an HR entity; there is no connection to a
  `user` login account. Confirmed by direct inspection of
  `createUser()`'s own signature — genuinely unbuilt, not merely
  untested.
- **Svelte 5 runes migration**: a concrete plan exists
  (`docs/svelte-5-runes-migration-plan.md`); no component has been
  converted yet.
- **The prototype-CoA / business-type-template scaffolding remains a
  first pass** — real, structural, and verified, but the CoA-template
  side of a business type (as opposed to its questions) is not yet
  exercised by any real, live business creation flow.
- **A real, unexplained oddity from this session's own investigation**:
  after a full backend shutdown (which should checkpoint the SQLite
  WAL), a separate reader process still could not see a business
  created moments earlier. Not fully root-caused before time ran out
  this checkpoint — flagged honestly rather than assumed resolved.
