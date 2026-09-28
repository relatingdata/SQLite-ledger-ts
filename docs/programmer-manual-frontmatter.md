```{=latex}
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

