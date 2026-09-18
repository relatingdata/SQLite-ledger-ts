// A real, direct, minimal sanity check: does db.ts load and
// initialize without error at all? Used by verify-fresh, right after
// a real reset-db, before the full test suite runs. Kept as its own,
// real, dedicated script file rather than an inline -e/eval flag,
// since bun and node both support -e but Deno uses a real, separate
// "eval" subcommand instead - a real .ts file runs identically across
// all three via $(RUN_SCRIPT), with no per-runtime flag difference at all.
import('../src/db.ts').then(() => {
  console.log('db.ts loaded and initialized without error.');
});
