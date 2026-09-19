"""
Assembles the real, complete Programmer's Manual from this project's
own, already-existing, real technical documents — one, single,
logical, direct concatenation, in the same, real spirit as the User
Manual's own, single-Markdown-source, pandoc-built pipeline.
"""
import os

DOCS = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(DOCS, "programmer-manual.md")

# Real, direct, logical grouping — not alphabetical, not chronological,
# but by what a real, new programmer would actually want to read in
# order: architecture first, then technical infrastructure, then real,
# concrete design work (both shipped and still-planned), then real,
# operational/testing concerns.
PARTS = [
    ("Part I --- Architecture", [
        "coding-standards.md",
        "entity-model.md",
        "entity-chains.md",
        "money-model.md",
        "multi-dimensional-reporting.md",
        "contact-types-and-translations.md",
    ]),
    ("Part II --- Technical Infrastructure", [
        "orm-and-commit-path.md",
        "multi-runtime-support.md",
        "css-styling-and-data-entry.md",
        "screens-staging-triggers-functions.md",
        "screens-inventory.md",
        "vocabulary-vs-sample-data.md",
        "scoped-uniqueness-and-location-accounting.md",
        "entity-identity-resolution.md",
        "svelte-usage.md",
        "svelte-5-runes-migration-plan.md",
        "one-file-per-page-consolidation-plan.md",
        "wine-bar-assemblies-plan.md",
        "programmer-tooling.md",
    ]),
    ("Part III --- Real, Concrete Design Work", [
        "multicurrency-design.md",
        "foreign-currency-receipts-and-payments.md",
        "menu-as-entity-tree-plan.md",
        "translator-form-and-guard-rails-plan.md",
    ]),
    ("Part IV --- Planning and Roadmap", [
        "expansion-walker-design.md",
        "pglite-migration-plan.md",
        "chart-of-accounts-hierarchy-editor-plan.md",
        "cold-shelf-storage-inventory-model-plan.md",
        "coa-class-instance-plan.md",
        "ui-completeness-plan.md",
        "sql-ledger-comparison.md",
        "business-evolution-plan.md",
        "cash-flow-and-growth-planning.md",
        "future-dated-projection-and-capacity-planning.md",
        "pl-pivot-builder-dnd-plan.md",
        "construction-project-management-plan.md",
        "stock-lifecycle-review-plan.md",
        "min-e2e-coverage-plan.md",
        "svelte-call-trace.md",
        "source-reference-tool.md",
        "naming-conventions-and-entity-glossary.md",
        "skill-branded-types-not-primitives.md",
        "border-multicurrency-pos-plan.md",
        "typed-node-create-design.md",
        "general-typed-hierarchy-resolution-plan.md",
        "cartesian-account-linking-plan.md",
        "inventory-lifecycle-blow-by-blow.md",
        "file-inventory-appendix.md",
        "user-manual-plan.md",
    ]),
    ("Part V --- Testing and Simulation", [
        "testing.md",
        "simulation-prompt.md",
    ]),
    ("Appendix --- Release Notes", [
        "RELEASE-NOTES.md",
    ]),
    ("Appendix --- Lessons Learned", [
        "lessons-learned.md",
    ]),
    ("Part VI --- Claude Skills for This Project", [
        "skill-wine-retail-e2e-and-docs.md",
        "skill-sql-ledger-ui-conventions.md",
        "skill-git-history-safety.md",
        "skill-makefile-only-execution.md",
        "skill-backend-first-testing.md",
        "skill-manual-as-source-of-truth.md",
        "skill-specification-driven-design.md",
        "skill-test-driven-development.md",
        "skill-design-driven-development.md",
        "skill-continual-skill-improvement.md",
        "skill-explicit-skill-attribution.md",
        "skill-test-writing-standard.md",
        "skill-skill-review-after-failure.md",
        "skill-no-new-tables.md",
        "skill-documentation-coverage-enforcement.md",
        "skill-pattern-recognition-to-tooling.md",
        "documentation-coverage-baseline.md",
        "documentation-baseline-report.md",
    ]),
]

# Bump every real heading down one level (# -> ##, ## -> ###, etc.) so
# each real document's own "# Title" becomes a real "chapter" nested
# correctly under its own, real "Part" — matching the exact, same,
# established book-class convention already proven for the User
# Manual, where "#" is chapter-level.
# Real, direct replacements for real, genuine glyphs the default
# LaTeX fonts don't support (confirmed directly by a real, failed
# build attempt, not assumed in advance) — plain-text equivalents,
# not simply dropped, so the real, intended meaning survives.
REPLACEMENTS = {
    "✅": "[done]",
    "❌": "[not done]",
    "🔜": "[soon]",
    "🔧": "[in progress]",
    "─": "-",
    "│": "|",
    "├": "|",
    "└": "`",
    "┘": "'",
    "┌": ".",
    "≤": "<=",
    "◄": "<",
    "┐": ".",
    "┤": "|",
}

def fix_glyphs(text):
    for bad, good in REPLACEMENTS.items():
        text = text.replace(bad, good)
    return text

def bump_headings(text):
    lines = text.split("\n")
    out = []
    for line in lines:
        if line.startswith("#"):
            out.append("#" + line)
        else:
            out.append(line)
    return "\n".join(out)

front_matter = r'''```{=latex}
\begin{titlepage}
\centering
\vspace*{2cm}
{\Huge\bfseries Better Brighter Multi-Ledger\par}
\vspace{0.5cm}
{\Large Architecture, Design, Implementation, Testing, and Programmer's Manual\par}
\vspace{0.3cm}
{\large Version 0.0.0\par}
\vspace{2cm}
{\footnotesize\itshape
Real, technical documentation of this application's own, actual\\
architecture, infrastructure, design work, and testing approach ---\\
assembled directly from this project's own, real, working documents,\\
not written separately from them.\par}
\end{titlepage}

\section*{Preamble --- Intended Audience and Prerequisite Knowledge}
\addcontentsline{toc}{section}{Preamble --- Intended Audience and Prerequisite Knowledge}

This manual, together with the User Manual, is intended to be
sufficient on its own for a competent programmer to recreate this
entire system from scratch --- not just to modify it. Where a design
choice has a real, non-obvious reason behind it, that reason is
recorded here directly, not left to be rediscovered.

\subsection*{Intended use, by a human reader and by an AI/machine reader}

This manual is written for two real, different readers at once, not
one with the other as an afterthought. A human reader is expected to
read a chapter start to finish, in order, building context
progressively --- the prose assumes that. An AI/machine reader (an
LLM-based coding assistant, a documentation search tool, a future
version of the very tool that assembled this manual) is expected to
retrieve a single section or paragraph in isolation, often without the
surrounding chapter loaded into context at all --- every real,
individual finding is written to be self-contained and directly
verifiable on its own (a real, quoted comment, a real, exact function
signature, a real, re-runnable query or command), specifically so it
remains correct and useful even when read as one isolated fragment,
not just as part of a full, sequential read-through. Neither reader is
optimized for at the other's real expense: the same, real, verified
fact serves both, stated once, not duplicated in two different styles.

This manual assumes real, working familiarity with:

\begin{itemize}
\item \textbf{TypeScript} --- interfaces, generics, and its structural
  type system well enough to understand why a plain \texttt{string}
  parameter cannot, on its own, distinguish a business's own name from
  a ledger's own name at compile time, and why this application
  branded types to fix that (Part II).
\item \textbf{SQL, in particular SQLite} --- ordinary queries, joins,
  and recursive common table expressions, plus SQLite's own specific
  mechanisms this application relies on directly: \texttt{INSTEAD OF
  INSERT} triggers on views, partial unique indexes, and its
  particular approach to foreign keys and default values.
\item \textbf{Reactive/declarative programming} --- the general
  paradigm (a UI described as a function of state, not a sequence of
  imperative DOM updates), since this is the model Svelte's own
  reactivity (\texttt{\$:}, stores, runes) is built on.
\item \textbf{HTML and CSS} --- ordinary, direct, semantic markup and
  styling; this application deliberately uses plain \texttt{fieldset}/\texttt{legend}
  elements and a small, shared global stylesheet rather than a
  component framework, so familiarity with the platform itself matters
  more than familiarity with any particular UI library's own
  abstractions over it.
\item \textbf{Svelte 5 and SvelteKit 5} --- components, stores,
  \texttt{load} functions, and file-based routing specifically; this
  codebase does not use an older Svelte version's own, different
  reactivity model, and the two are not interchangeable when reading
  this manual's own code examples.
\end{itemize}

A reader missing one of these can still follow the real, direct
explanations of \emph{why} a decision was made --- but reconstructing
the actual, working code from this manual alone assumes all five.

\pagenumbering{roman}
\setcounter{page}{1}
\tableofcontents
\clearpage
\listoftables
\clearpage
\listoffigures
\clearpage
\pagenumbering{arabic}
\setcounter{page}{1}
```

'''

pieces = [front_matter]
for part_title, files in PARTS:
    pieces.append(f"\n\\clearpage\n\n# {part_title}\n\n")
    for fname in files:
        path = os.path.join(DOCS, fname)
        if not os.path.exists(path):
            print(f"WARNING: missing {fname}")
            continue
        with open(path, encoding="utf-8") as f:
            text = f.read()
        pieces.append("\n\\clearpage\n\n")
        pieces.append(fix_glyphs(bump_headings(text)))
        pieces.append("\n")

full = "".join(pieces)
with open(OUT, "w", encoding="utf-8") as f:
    f.write(full)
print(f"Wrote {OUT} ({len(full.splitlines())} lines)")
