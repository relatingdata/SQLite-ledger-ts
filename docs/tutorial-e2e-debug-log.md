# Tutorial e2e debug log — every fix made, why, and what's left

Kept from this point forward because debugging had become reactive rather than
planned. This records the real state: what's confirmed fixed, what's confirmed still
broken, and the exact next step — so work continues from a plan, not from chasing the
last failure.

## Confirmed fixed so far, in order found

1. **`CashTransaction.svelte` sent the auto-added blank line to the server on submit.**
   The backend correctly rejected it (`lines: String must contain at least 1
   character(s)`), silently failing every Cash Purchase/Cash Sale. This was the real,
   root cause behind the transfer and stock-take steps failing — not those pages
   themselves. Fixed: filter blank lines before submitting, matching the two sibling
   forms (`ap-purchase`, `ar-sale`) that already did this correctly.
2. **Tutorial script clicked a nonexistent "Add line" button** on the cash-purchase
   form (it auto-adds lines reactively now). Removed the click.
3. **Tutorial script's transfer-page selectors were stale** — that page was rebuilt
   with a generic `Form` component; hardcoded placeholders and the button label
   (`"Stock Transfer"`) no longer existed. Fixed to the real selectors and the real
   button text (`"Transfer"`).
4. **Stock-take completion button text.** Two round trips on this one:
   - First changed test to `"Complete stock take"` (wrong guess at the fallback text).
   - Checked the real, live DOM: the button actually showed `"Complete"` because of a
     genuine application bug — the button's translation key (`'Complete'`) collided
     with an already-existing, generic vocabulary word, so its own, more descriptive
     fallback text (`'Complete stock take'`) could never actually display.
   - **Fixed the real application bug**: gave the button its own, correctly-matching
     translation key (`'Complete stock take'`), so it now genuinely renders that text.
   - Updated the test to expect `"Complete stock take"` — now correct, because the
     application itself was fixed, not because of another guess.
5. **Two more of the same key/fallback mismatch bug**, found via a full grep audit
   after the pattern above was understood: `/invoices` page's heading was keyed as
   `'Journal Entries'` (would show that instead of "Invoices"); `/journal`'s
   empty-state link was keyed as `'Record The First One'` (fallback said "Post the
   first one."). Both fixed to give each its own, correct key.
6. **`Makefile`'s `stop-servers` only killed the single top-level PID**, not the
   process group — `setsid nohup npm run dev` spawns child processes (`tsx watch` →
   a separate `node` process actually serving requests) that survived. This meant
   `stop-servers` + `reset-db` + `ensure-servers` could leave an orphaned, stale
   server still bound to the port, serving requests against an outdated database —
   which is what caused several confusing, seemingly-random "location doesn't exist"
   failures earlier in this debugging session. Fixed: kill the process group
   (`kill -- -$PID`), with a `pkill -f` fallback. Verified directly: process count
   goes from several to zero after `stop-servers`, where it previously left some
   running.
7. **POS location select — false alarm, not an app bug.** The location appeared
   empty in an isolated check because the isolated check's own setup script (`node
   --import tsx -e "..."` as a separate process) wrote to a different database
   connection than the one the running server actually uses. Confirmed by creating
   the same data through the running server's own API (`curl` against
   `localhost:3001`) instead — worked immediately. **Lesson, now a rule for the rest
   of this debugging: test data must always be created through the running server's
   own API, never a separate script process, when checking behavior against a live
   server.**

## Confirmed real, not yet fixed

8. **POS "New terminal" vs "Add a foreign-currency terminal" — a real bug in my own
   test script, not the application.** The button only reads "New terminal" once at
   least one terminal already exists for that location (`{#if terminals.length > 0 ||
   showAddTerminal}`); with zero terminals (the real, first-time case the tutorial is
   actually exercising), the button reads "Add a foreign-currency terminal" instead
   (the `{:else}` branch). My test script assumed the wrong branch. **Fixed and
   confirmed**: updated the tutorial script to the real, first-use button text;
   verified via the same isolated script, extended through terminal creation, the USD
   item search, and clicking "Complete Sale" — all 20 steps passed.

## Exact next step

Clean up the isolated debug test file, run the full backend suite + `check-frontend`
to confirm nothing else broke, then run the full tutorial e2e end to end. Nothing
past step 20 above (the USD sale) has been exercised yet in isolation — the report
pages and the third location's stock-take still need a real, full run to confirm.

## Full tutorial run history (for reference — do not re-derive this by re-running blind)

- Full runs before checkpoint 372: hung consistently at the cash-purchase receiving
  step (item 1 above).
- After item 1's fix: progressed to and through both stock transfers and both
  stock-takes, hung at "Complete stock take" (item 4).
- After item 4, 5's fixes and the Makefile fix (item 6): progressed through both
  stock-takes, the POS home-currency sale, and currency nomination, hung at POS
  terminal creation (item 8, now understood, not yet fixed in the test script).

Once item 8 is fixed, the remaining, never-yet-exercised tail of the script is: one
USD sale through the new terminal, then four report pages (trial balance, balance
sheet, P&L, DND P&L pivot), then the third location's stock-take (the one testing the
"never stocked this item" case). None of these have been reached in any run yet, so
none are confirmed working — this needs an honest, full run once item 8 is fixed, not
an assumption that the rest is fine.
