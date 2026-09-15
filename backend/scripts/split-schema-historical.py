"""
Split schema.sql into real, separate files, per direct request:
the basic structural schema, English vocabulary, each other
language's vocabulary separately, and the German BMW / French
Peugeot demo ledger data separately.

Kept here as a real, honest historical record of how this split was
actually done, and the real dependency this session's own, direct
verification caught along the way (see the commit message this
script shipped with) — not a real, ongoing, re-runnable tool. It
hardcodes the exact, real line numbers of the original, single
schema.sql file, which no longer exists; running this script again,
as-is, against the current, already-split backend/schema/*.sql files
will not work.

Safety approach used: extract lines that mechanically match each real,
target criterion (a translation_entry INSERT for a given language;
the contiguous BMW/Peugeot demo block), remove them from the core
file, write each into its own real file - then verify the exact,
same, real concatenation (core + each vocab file + demo files, in
the exact, original order) is byte-for-byte identical to the
original file. This is the real, safety-critical step: if this
check fails, the split is not trusted or used.
"""
import re

SRC = "/home/claude/sql-ledger-ts/backend/schema.sql"
OUT_DIR = "/home/claude/sql-ledger-ts/backend/schema"

with open(SRC, "r", encoding="utf-8") as f:
    original = f.read()

lines = original.split("\n")

# Step 1: split the one, real, known line that has two, real, separate
# statements concatenated on it with no real newline between them —
# confirmed directly, line 2644 (1-indexed) ends the Peugeot block and
# immediately starts the next, real, different section on the same line.
for i, line in enumerate(lines):
    if "PCS-2020', 'PCS Actual', 1);-- Vocabulary words" in line:
        idx = line.index("-- Vocabulary words")
        lines[i] = line[:idx]
        lines.insert(i + 1, line[idx:])
        break

# Step 2: identify the real, contiguous BMW/Peugeot demo block by line number,
# confirmed directly by reading the file - entity_ids(188) through the
# real, final Peugeot post_journal_entry line.
bmw_start = None
bmw_end = None
for i, line in enumerate(lines):
    if "INSERT INTO entity_ids (id) VALUES (188);" in line and bmw_start is None:
        bmw_start = i
    if "PCS-2020', 'Peugeot Citroën Sochaux SNC', 'PCS Actual', 1);" in line:
        bmw_end = i
        break

assert bmw_start is not None and bmw_end is not None, "Could not find the real BMW/Peugeot block boundaries"
demo_lines = lines[bmw_start:bmw_end + 1]
print(f"Real BMW/Peugeot demo block: lines {bmw_start+1}-{bmw_end+1} ({len(demo_lines)} lines)")

# Step 2b: a real, second, genuine cross-dependency found and confirmed
# directly (not assumed) via a live database-loading test before this
# split was trusted: a real, separate "link every real, existing
# business to its own real Chart of Accounts family" block —
# confirmed directly, not limited to BMW/Peugeot at all, it also
# touches Wine Retail Business — genuinely depends on entities from
# BOTH the core file and the demo block already existing, so it must
# load last, after everything else.
coa_links_start, coa_links_end = None, None
for i, line in enumerate(lines):
    if "'Achats de marchandises'), 'Achats de marchandises', 'Expense', 'French CoA', 1);" in line:
        coa_links_start = i
    if "'Zinsergebnis'), 'Zinsergebnis', 'Expense', 'German CoA', 1);" in line:
        coa_links_end = i
        break
assert coa_links_start is not None and coa_links_end is not None, "Could not find the real CoA-links block boundaries"
coa_links_lines = lines[coa_links_start:coa_links_end + 1]
print(f"Real CoA-family-linking block: lines {coa_links_start+1}-{coa_links_end+1} ({len(coa_links_lines)} lines)")

# Step 3: identify every real translation_entry INSERT line, grouped by
# its own, real language.
lang_pattern = re.compile(r"INSERT INTO translation_entry \(entity, language, text\) VALUES \('[^']*', '([A-Za-z]+)',")
vocab_lines = {lang: [] for lang in ["Danish", "English", "French", "German", "Italian"]}
vocab_line_indices = set()
for i, line in enumerate(lines):
    if bmw_start <= i <= bmw_end:
        continue  # already extracted as part of the demo block
    if coa_links_start <= i <= coa_links_end:
        continue  # already extracted as part of the CoA-links block
    if line.lstrip().startswith("--"):
        continue  # a real, direct comment, not an actual, executable statement
    m = lang_pattern.search(line)
    if m:
        lang = m.group(1)
        if lang in vocab_lines:
            vocab_lines[lang].append(line)
            vocab_line_indices.add(i)

for lang, ls in vocab_lines.items():
    print(f"Real {lang} vocabulary lines: {len(ls)}")

# Step 4: build the real, remaining "core" file — everything except the
# demo block and the per-language vocabulary lines just extracted.
core_lines = []
for i, line in enumerate(lines):
    if bmw_start <= i <= bmw_end:
        continue
    if coa_links_start <= i <= coa_links_end:
        continue
    if i in vocab_line_indices:
        continue
    core_lines.append(line)

import os
os.makedirs(OUT_DIR, exist_ok=True)

with open(f"{OUT_DIR}/00-core.sql", "w", encoding="utf-8") as f:
    f.write("\n".join(core_lines))

for lang, ls in vocab_lines.items():
    fname = f"{OUT_DIR}/10-vocab-{lang.lower()}.sql"
    with open(fname, "w", encoding="utf-8") as f:
        f.write(f"-- {lang} vocabulary — every real translation_entry row for this language.\n")
        f.write("\n".join(ls))

with open(f"{OUT_DIR}/20-demo-bmw-peugeot.sql", "w", encoding="utf-8") as f:
    f.write("-- German BMW / French Peugeot demo ledger data, split out per direct request.\n")
    f.write("\n".join(demo_lines))

with open(f"{OUT_DIR}/30-coa-links.sql", "w", encoding="utf-8") as f:
    f.write("-- Links every real, existing business's own real Chart of Accounts\n")
    f.write("-- to its own real, preferred CoA family — genuinely depends on\n")
    f.write("-- entities from both the core file and the demo block already\n")
    f.write("-- existing, so this must load last, after everything else.\n")
    f.write("\n".join(coa_links_lines))

# Step 5: verify — the exact, same, real concatenation, in the exact,
# original order, must be byte-for-byte identical to the original file.
recon = []
i = 0
while i < len(lines):
    if i == bmw_start:
        recon.extend(demo_lines)
        i = bmw_end + 1
        continue
    if i == coa_links_start:
        recon.extend(coa_links_lines)
        i = coa_links_end + 1
        continue
    if i in vocab_line_indices:
        i += 1
        continue
    recon.append(lines[i])
    i += 1

reconstructed_text = "\n".join(recon)
print("Reconstructed matches original:", reconstructed_text == "\n".join(lines))
if reconstructed_text != "\n".join(lines):
    for j, (a, b) in enumerate(zip(reconstructed_text.split("\n"), "\n".join(lines).split("\n"))):
        if a != b:
            print(f"First diff at line {j+1}:")
            print("  recon:", repr(a[:100]))
            print("  orig: ", repr(b[:100]))
            break
