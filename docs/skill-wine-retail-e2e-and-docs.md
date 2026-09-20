*A Claude Code skill for this project — lives at `/mnt/skills/user/wine-retail-e2e-and-docs/SKILL.md`, reproduced here so it's part of this manual's own, single, complete source. Description: MANDATORY closing checklist for any sql-ledger-ts code change — not optional, not "if it seems relevant". Use whenever you finish making a change to backend/src, frontend/src, or docs in the sql-ledger-ts repo, before telling the user the work is done.*


# Wine Retail E2E and Documentation Discipline

## Why this skill exists

Per direct, standing instruction from the project owner: "I should never have to ask again" whether Playwright was run and passed, and whether documentation was updated. This has been asked for multiple times across sessions because it kept being skipped, forgotten, or replaced with a lower-bar substitute (a direct API `curl` call instead of an actual Playwright browser test; a code comment instead of an actual doc update). This skill is the enforcement mechanism — a checklist that runs every time, not a judgment call about whether it's "needed this time."

**Do not reason about whether this feels necessary for a given change.** Every change gets this checklist. A change that "obviously only touches backend validation logic" still gets it — validation logic changes have broken UI forms before in this exact project.

## The three, non-negotiable steps, in order

### 1. Rebuild the database fresh and confirm both servers boot

```bash
rm -f backend/data/entities.sqlite*
pkill -f "node.*server\|vite" 2>/dev/null; sleep 2
cd backend && node --import tsx -e "import('./src/db.ts')" 2>&1 | grep -i error | grep -v FLAGGED
(setsid nohup npm run dev > /tmp/be.log 2>&1 < /dev/null &)
sleep 12
curl -s -o /dev/null -w "Backend: %{http_code}\n" http://localhost:3001/api/i18n/languages
cd ../frontend && (setsid nohup npm run dev > /tmp/fe.log 2>&1 < /dev/null &)
sleep 12
curl -s -o /dev/null -w "Frontend: %{http_code}\n" http://localhost:5173/
```

Both must return `200`. If either doesn't, stop and fix the boot failure before proceeding — do not run Playwright against a server that isn't actually healthy.

### 2. Run the full Playwright suite through the real browser, not a curl substitute

```bash
rm -rf e2e/test-results
cd e2e && timeout 120 npx playwright test --reporter=list --timeout=30000 --workers=1
echo "EXIT CODE: $?"
```

**A direct API call via `curl` or `fetch` is never a substitute for this step**, even to "verify the same thing faster." The whole point of Playwright here is confirming the change works through the actual rendered UI a person clicks through — a backend function returning the right JSON is necessary but not sufficient.

If `tutorial-walkthrough.spec.ts` (which builds Wine Retail Business from scratch) isn't part of the default suite run, run it explicitly:

```bash
cd e2e && timeout 90 npx playwright test tutorial-walkthrough --reporter=list --timeout=30000 --workers=1
```

If the change is business-creation-adjacent (new-business form, business types, CoA seeding, or anything in `db-seed.ts`), also confirm the second, augmented business builds correctly — reuse or recreate a focused test that:
1. Logs in, selects "My Business"
2. Goes to `/setup/new-business`, creates a second business (any distinguishing name, e.g. "Training Wine Business")
3. Confirms via a real screenshot and/or the live `/api/businesses` endpoint that it was genuinely created

**A real exit code 0 is required.** Read the actual reporter output — don't infer success from "no errors in my edit." If a test fails, the failure could be a real regression from this change; investigate before claiming the checklist is complete. Re-running the exact same test twice in a row without resetting the database is expected to hit "already exists" errors (Wine Retail Business/Training Wine Business persist between runs) — that's not itself a regression, but confirm this by checking the actual error, not by assuming.

### 3. Update the documentation that genuinely needs it — check both files explicitly

Before claiming this step is done, run these two checks and act on what they say:

```bash
grep -n "<relevant term(s) for what changed>" docs/entity-model.md
grep -n "<relevant term(s) for what changed>" docs/user-manual.md
```

- `docs/entity-model.md` — the programmer-facing doc. Any change to how entities relate, how a mechanism works internally (a new `setEntityLink` relationship type, a schema change, a bug fix in a hierarchy-walking function), or any design decision worth a future reader knowing about, goes here.
- `docs/user-manual.md` — the training/tutorial chapter. Any change visible to an actual user of the app (a new field, a renamed screen, a new button, a changed workflow) goes here, in the relevant Chapter 2 (reference) and/or Chapter 3 (tutorial) section.

If the grep finds nothing and the change is genuinely user- or programmer-visible, that's the doc gap — fix it, don't note it and move on. Then rebuild both PDFs to confirm they build clean (no missing-image warnings, no pandoc errors):

```bash
make manual
make programmer-manual
```

A screenshot used in a new doc section should be a real one from the Playwright run above (see `/tmp/*.png` after a test with `page.screenshot(...)`), copied into `docs/manual-images/` — not a placeholder path.

## Expensive, multi-step setup gets a saved database snapshot — never a full re-run per iteration

Found the hard way, across many repeated ~10-minute full runs of `tutorial-walkthrough.spec.ts` while debugging a failure near its end: re-running an entire, long, multi-step test from scratch to check one fix near the *end* of it is a real, needless cost, repeated every single iteration. The real, correct pattern, once a test has a confirmed-good prefix (every step up to some point has already passed, verified, in a real run):

1. **Truncate a copy of the test at the last confirmed-good step**, run it once, and let it finish.
2. **Copy the database file it produced** — `backend/data/entities.sqlite` (and its `-wal`/`-shm` siblings if present) — to a snapshot location, e.g. `/tmp/snapshot-<name>.sqlite`.
3. **To iterate on the remaining, untested tail**: stop the servers, restore the snapshot over the live database file, restart the servers, then run only the remaining steps (a second, small test file, or a fast, direct API-driven check) against that already-progressed state.
4. Once the tail is fixed and confirmed, reassemble the full test file and run it once, completely, end to end, to confirm the whole thing still passes together — the snapshot shortcut is for iteration speed while debugging, never a substitute for a final, real, full run before calling the work done.

This is the same principle as a fixture/cassette in other testing setups: expensive, deterministic setup gets computed once and reused, not redone per iteration. Skipping this and re-running the full script blind, every time, is the exact "tail chasing" this skill's own "done looks like" section already warns against — it wastes the person's time waiting on the same, already-confirmed-working steps, dozens of times over, for information a saved snapshot would have given back in seconds.

## What "done" looks like

Only report a change as complete once all three steps above have genuinely run in this same session, with real output confirming each — not "I'm confident this doesn't need it" and not a summary written before actually executing the commands. If time pressure forces a shortcut, say so explicitly rather than presenting the change as fully verified.
