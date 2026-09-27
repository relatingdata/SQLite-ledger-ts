# The manual is the authoritative source of truth — a permanent, foundational skill

Per direct, absolute instruction, received and confirmed: the assembled
manuals (the Programmer's Manual, the User Manual, and the design docs that
feed them) are the one, real, authoritative source of design and
implementation knowledge for this whole project — not a re-derivable-on-demand
summary of the code, something to be independently re-confirmed against the
source every time a question touches it.

## The default, every time

For any task, on any topic: read what the manual already says first, and use
and trust it as correct in design and implementation. Do not re-investigate
the codebase directly — grepping source files, re-reading function bodies,
re-deriving a design from scratch — to independently re-confirm something the
manual already documents. If the manual describes a mechanism, its own
functions, and how it is wired in, that description is the one, real starting
point for any further work involving it.

## If the manual and the actual code ever genuinely conflict

That conflict is, above all else, the one thing to surface immediately,
plainly, for evaluation and correction — never silently resolved either way
(never trusting the code over the manual, and never trusting the manual over
the code) without saying so first. A found conflict is itself the deliverable
of that moment, not a problem to quietly patch over before continuing.

## Why this matters, stated plainly

Re-deriving already-documented design from the source code every time is
slow, risks missing context the manual already captured precisely (a real,
confirmed bug once found and fixed, a real, deliberate architectural choice
with its own stated reasoning), and risks arriving at a subtly different,
undocumented understanding of a mechanism that already has one, real,
correct, written description. Trusting the manual first is faster and more
reliable, provided the manual is kept accurate — which is exactly why any
found conflict must be raised immediately rather than absorbed silently.

## Scope

This is a permanent, standing skill, not a one-time instruction for one
topic — it applies to all future work on this project as a whole.
