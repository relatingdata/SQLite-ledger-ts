# Appendix: The Step Runner

The Step Runner is the application's own tool for setting up test data and
walking through a scripted sequence of actions — creating a business, adding
locations, receiving stock, and so on — one step at a time or all at once.

## What it's for

If you want to load a known set of sample data into the application (to try
something out, to prepare for a demonstration, or to reproduce a specific
situation), the Step Runner reads a plain, readable list of steps from a file
and carries them out for you, either instantly through the application's own
backend or, if you'd like to watch, by driving the actual screens the way a
person would.

## Running it

From a terminal, in the project's own `backend` folder:

```
npx tsx scripts/step-runner.ts <fixture-file.csv>
```

By default, it shows you the next step — its name, what it does, and which
screen or function it uses — and asks whether to go ahead. Answer `y` (or press
Enter) to run it, or `n` to stop.

To run several steps in a row without waiting to be asked: add
`--non-interactive`. To run only one, specific step, use `--only step-name`.

## Reading the display

Before each step runs, its details are shown as a table, with the same column
names as the underlying data file — so what you see matches exactly what's
written down, with nothing paraphrased or left out.

## What's here today, and what's still to come

Right now, the Step Runner can carry out a step by calling the application's
own backend directly — the fast way, with no browser involved, best for setting
up data quickly. Driving the actual on-screen forms and buttons the way a
person would, with screenshots along the way, is planned but not yet built.
