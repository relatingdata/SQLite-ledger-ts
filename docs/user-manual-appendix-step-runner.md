# Appendix: The Step Runner

The Step Runner is the application's own tool for setting up test data and
walking through a scripted sequence of actions — creating a business, adding
locations, receiving stock, and so on — one step at a time or all at once.

## What it's for

If you want to load a known set of sample data into the application, or walk
through a sequence of steps to try something out or prepare for a
demonstration, the Step Runner reads a plain, readable file of steps and
carries them out for you, either instantly through the application's own
backend or, if you'd like to watch, by driving the actual screens the way a
person would.

## Running it

From a terminal, in the project's own `backend` folder:

```
npx tsx scripts/step-runner.ts <data-file.csv>
```

By default, it shows you the next step and asks whether to go ahead. Answer
`y` (or press Enter) to run it, or `n` to stop. To check a file without
running anything, use `--lint` (reports any problems) or `--pretty` (prints
every step in a readable form).

## Section 8: File Formats

**8.1 The data file.** A plain text file, one line per step, with no column
titles. The first item on each line is the name of the screen or action (for
example, `Login` or `Create Business`), and every item after that is one
piece of information for that screen, in the same order every time — the
same order you'd write down when filling in a paper form for that screen. If
any piece of information itself contains a comma, put quotation marks around
it. For example:

```
"Login","admin","changeme123","English"
"Create Business","Wine Tutorial Business","2026-27","Sole Trader"
```

**8.2 The screen file** (`screens.csv`). This is a separate file, maintained
alongside the data file, that tells the Step Runner what each screen's own
pieces of information mean and how to find them on the actual screen. You
won't normally need to edit this yourself — it's set up once per screen, by
whoever builds a new fixture, and every data file that uses that screen
simply refers to it by name.

**8.3 The control file** (optional). This is how you script a run without
sitting at the tool yourself — instead of manually choosing, batch by batch,
whether to run the fast way or watch it happen, this file says so in advance
for every step. For example: the first few steps run instantly through the
backend, then the next step switches to actually driving the screen and
taking a picture of it, then back to instant again — all without anyone
watching. This information goes in a second, small file alongside the data
file, never mixed into the data file itself.

## What's here today, and what's still to come

Right now, the Step Runner's design has been finalized and written up in
full, and its earlier, working parts (checking a file for problems, showing
it in a readable form) exist for an older version of the file format. Bringing
those, and the part that actually drives the screens, up to date with the
format described above is in progress.
