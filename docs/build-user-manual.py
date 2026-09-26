"""
Assembles the real, complete User Manual from this project's own,
already-existing, real chapter documents — mirroring, exactly,
build-programmer-manual.py's own, established, direct-concatenation
approach, per direct request to split this manual into real, separate
chapter/appendix files the same way.
"""
import os

DOCS = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(DOCS, "user-manual.md")

# Real, direct grouping, matching the manual's own existing real
# structure — Reference (how the application works), Tutorial (a real,
# start-to-finish walkthrough), then Appendix/back-matter.
PARTS = [
    ("Reference", [
        "user-manual-ch0-how-it-started.md",
        "user-manual-ch1-introduction.md",
        "user-manual-ch2-configuration.md",
    ]),
    ("Tutorial", [
        "user-manual-ch3-tutorial.md",
    ]),
    ("Appendix --- Every Screen in the Application", [
        "user-manual-appendix-screens.md",
        "user-manual-appendix-step-runner.md",
    ]),
    ("Back Matter", [
        "user-manual-glossary.md",
        "user-manual-contributors-suggestions-notes.md",
    ]),
]

with open(os.path.join(DOCS, "user-manual-frontmatter.md"), encoding="utf-8") as f:
    front_matter = f.read()

pieces = [front_matter]
for part_title, files in PARTS:
    for fname in files:
        path = os.path.join(DOCS, fname)
        if not os.path.exists(path):
            print(f"WARNING: missing {fname}")
            continue
        with open(path, encoding="utf-8") as f:
            text = f.read()
        pieces.append(text)

full = "".join(pieces)
with open(OUT, "w", encoding="utf-8") as f:
    f.write(full)
print(f"Wrote {OUT} ({len(full.splitlines())} lines)")
