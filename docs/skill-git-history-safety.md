*A Claude Code skill for this project — lives at `/mnt/skills/user/git-history-safety/SKILL.md`, reproduced here so it's part of this manual's own, single, complete source. Description: MANDATORY before deleting any file, or before any git history-rewriting action (git init over an existing repo, git reset --hard, filter-repo, BFG, or anything that discards commit history) - not optional, not "this seems safe". Use whenever a file is about to be removed as part of "cleanup", "this is superseded now", or similar reasoning, and whenever any action would make past commits unreachable from the current branch. Trigger this even if the deletion "obviously" doesn't matter - that judgment call is exactly what this skill exists to remove.*


# Git History Safety

## Why this skill exists

Per direct, real incident in this project: a real, working, committed script (`setup-rtl-experiment.ts`) was deleted as part of "making a feature permanent" — its actual, real-world value (translations already proven correct via a live Playwright screenshot walkthrough) was reasoned away and rebuilt from scratch, badly, wasting significant effort, when the exact original content was one `git show <old-commit> -- <path>` away the whole time. This was then compounded by a **separate**, later action — `rm -rf .git && git init` to "start fresh" — which discarded that recovery path from the active repository entirely. The only reason the original file was recoverable at all was that an old bundle happened to be preserved separately, by a specific, explicit request unrelated to this safety concern.

**Do not reason about whether a deletion or history rewrite "feels safe" for a given case.** Every deletion and every history-rewriting action gets the same, mandatory checks below — a script that "is obviously superseded" still gets checked, because that reasoning is exactly what went wrong here.

## Before deleting ANY file, in order

1. **Check whether it's tracked and has real history:**
   ```bash
   git log --oneline -- <path>
   ```
2. **If it has any real commits**, deleting it is genuinely safe — `git show <commit>:<path>` will always recover the exact content later. State this directly: "this is tracked at commit X, safe to delete."
3. **If it is untracked** (no output from step 1), it is NOT safely recoverable once deleted. Either commit it first, or explicitly confirm with the user that permanent loss is acceptable before deleting.
4. **Never skip step 1** on the reasoning that the file "is clearly superseded" or "obviously isn't needed anymore" — that is precisely the reasoning that caused the real incident this skill documents.

## Before ANY git history-rewriting action

This includes: `rm -rf .git` followed by `git init`, `git reset --hard` to an earlier commit (discarding later ones), `git filter-repo`, BFG, or force-pushing over history.

1. **State plainly, before doing it**, that this action makes every commit not reachable from the new state permanently unrecoverable from the active repository — no exceptions, no "but it's probably fine."
2. **Explicitly ask for confirmation** of this specific consequence — not just "should I start fresh?" but "this will make commits A through Z unrecoverable from this repo going forward — confirm?"
3. **If any real, working content exists only in that history** (not already reflected in the current working tree, not backed up elsewhere), surface that specifically before proceeding — do not assume the person has already accounted for it.
4. A separately-preserved bundle/export from *before* the rewrite does not substitute for this warning — it is not something to rely on after the fact; the warning must come *before* the irreversible action, every time.
