#!/usr/bin/env python3
"""Generate the Screens Inventory table for the Programmer's Manual.

For every real frontend route (+page.svelte), reports: route path,
source file, code lines, comment lines (blank lines excluded from
both), total non-blank lines, and implementation status.

A line is counted as a comment line if, after stripping leading
whitespace, it starts with // or <!-- , or falls inside a /* ... */
block comment (including the line that opens or closes one). This is
a real, line-based classifier - a single line containing both code
and a trailing comment (e.g. `let x = 1; // note`) is counted as code,
matching how a person skimming the file would categorize it: the line
is doing real work, not just documenting.

Usage: python3 generate-screens-inventory.py > docs/screens-inventory.md
"""
import subprocess
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
ROUTES_DIR = REPO_ROOT / "frontend" / "src" / "routes"


def classify_lines(path: Path) -> tuple[int, int]:
    """Return (code_lines, comment_lines) for one .svelte file, blank lines excluded."""
    code = 0
    comments = 0
    in_block_comment = False
    for raw_line in path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line:
            continue  # blank lines excluded from both counts, per direct instruction
        if in_block_comment:
            comments += 1
            if "*/" in line:
                in_block_comment = False
            continue
        if line.startswith("//") or line.startswith("<!--"):
            comments += 1
            # A single-line /* ... */ or <!-- ... --> both open and close
            # on the same line in the common case, so no state change.
            continue
        if line.startswith("/*"):
            comments += 1
            if "*/" not in line:
                in_block_comment = True
            continue
        code += 1
    return code, comments


def status_for(path: Path, total_lines: int) -> str:
    text = path.read_text(encoding="utf-8")
    if "NotImplemented" in text:
        return "Not implemented"
    if total_lines <= 10:
        return "Thin wrapper (shared component)"
    return "Implemented"


def main() -> None:
    rows = []
    for path in sorted(ROUTES_DIR.rglob("+page.svelte")):
        route = "/" + str(path.relative_to(ROUTES_DIR).parent).replace("\\", "/")
        if route == "/.":
            route = "/"
        code, comments = classify_lines(path)
        total_lines = int(subprocess.run(
            ["wc", "-l", str(path)], capture_output=True, text=True, check=True
        ).stdout.split()[0])
        status = status_for(path, total_lines)
        rel_path = path.relative_to(REPO_ROOT)
        rows.append((route, str(rel_path), code, comments, status))

    print("# Screens Inventory")
    print()
    print("Every real frontend route (`+page.svelte`), its source file, a real "
          "code/comment line split (blank lines excluded from both, per direct "
          "instruction), and whether it's genuinely implemented, a thin wrapper "
          "around a shared component, or still a `NotImplemented` stub. Generated "
          "directly from source by `docs/generate-screens-inventory.py` — never "
          "hand-edited.")
    print()
    print("| Route | Source File | Code Lines | Comment Lines | Status |")
    print("|---|---|---|---|---|")
    for route, rel_path, code, comments, status in rows:
        print(f"| {route} | {rel_path} | {code} | {comments} | {status} |")

    total_code = sum(r[2] for r in rows)
    total_comments = sum(r[3] for r in rows)
    implemented = sum(1 for r in rows if r[4] == "Implemented")
    thin = sum(1 for r in rows if r[4] == "Thin wrapper (shared component)")
    not_impl = sum(1 for r in rows if r[4] == "Not implemented")
    print()
    print(f"**{len(rows)} screens total** — {implemented} implemented, {thin} thin wrapper "
          f"(shared component), {not_impl} not yet implemented. "
          f"{total_code} total code lines, {total_comments} total comment lines "
          f"across all screens (blank lines excluded from both).")


if __name__ == "__main__":
    main()
