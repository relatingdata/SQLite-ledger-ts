# Source Reference

A real, generated, comprehensive source reference — per direct
request, functions, types, and exported variables arranged by file
(common, then backend, then frontend), with a real include graph, a
call graph summary, and a full, alphabetical index at the end.
`make source-reference` regenerates it, writing to
`docs/source-reference.md`.

## Real, stated scope

Covers the real, core, top-level `.ts` files: `shared-fixtures/`
(common — shared between backend scripts and e2e tests),
`backend/src/*.ts`, and `frontend/src/lib/*.ts` — 34 real files, 797
real, indexed names, confirmed directly on first generation. The many
real route (`.svelte`) and component files (101 more) are real,
separate, larger follow-on work, not attempted in this first pass.

## Why this lives as its own generated file, not a manual chapter

The real, generated output is substantial (1000+ lines) — genuinely
useful as a real, standalone reference to search or grep, but not the
right shape to fold into the Programmer's Manual's own, prose-driven
chapters directly. This chapter documents the *tool*; the real,
generated content itself lives at `docs/source-reference.md`,
regenerated on demand rather than kept as static prose that could
drift from the real, live source.
