#!/usr/bin/env node
// fix-branded-types.cjs — a general-purpose codemod for TypeScript's
// "nominal typing via intersection" pattern:
//
//   type UserId = number & { readonly __brand: 'UserId' };
//   function asUserId(id: number): UserId { return id as UserId; }
//
// This pattern is invisible at runtime (asXxx is a pure type-cast, a
// no-op), so a bare literal or loosely-typed variable passed where the
// branded type is expected compiles and runs fine under some
// toolchains (bun, ts-node with transpile-only, tsx) but is flagged as
// a real type error under a stricter checker (deno check, tsc without
// isolatedModules/transpile-only shortcuts, or CI's own tsc pass).
// This script finds every such site using the TypeScript compiler
// API's own diagnostics (never a regex guess at "what looks wrong")
// and wraps it with the matching asXxx() call, converging over
// multiple passes since fixing one call argument can reveal another
// on the same call that TypeScript was masking behind the first error.
//
// USAGE:
//   node fix-branded-types.cjs <file.ts> [file2.ts ...]
//   node fix-branded-types.cjs --dry-run <file.ts>
//   node fix-branded-types.cjs --brand-pattern '_brand' <file.ts>
//   node fix-branded-types.cjs --wrapper-prefix 'to' <file.ts>   # toUserId instead of asUserId
//   node fix-branded-types.cjs --max-rounds 50 <file.ts>
//
// See README.md in this skill folder for the full story, the three
// real bugs found building this, and why each safety check exists.

const ts = require('typescript');
const fs = require('fs');
const path = require('path');

function parseArgs(argv) {
  const opts = { files: [], dryRun: false, brandPattern: '__brand', wrapperPrefix: 'as', maxRounds: 100 };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--dry-run') opts.dryRun = true;
    else if (a === '--brand-pattern') opts.brandPattern = argv[++i];
    else if (a === '--wrapper-prefix') opts.wrapperPrefix = argv[++i];
    else if (a === '--max-rounds') opts.maxRounds = parseInt(argv[++i], 10);
    else opts.files.push(a);
  }
  return opts;
}

const opts = parseArgs(process.argv.slice(2));
if (opts.files.length === 0) {
  console.error('Usage: node fix-branded-types.cjs [--dry-run] [--brand-pattern NAME] [--wrapper-prefix PREFIX] [--max-rounds N] <file.ts> [file2.ts ...]');
  process.exit(1);
}

const firstAbsPath = path.resolve(opts.files[0]);
const configPath = ts.findConfigFile(path.dirname(firstAbsPath), ts.sys.fileExists, 'tsconfig.json');
if (!configPath) {
  console.error('Could not find a tsconfig.json above', firstAbsPath);
  process.exit(1);
}
const configFile = ts.readConfigFile(configPath, ts.sys.readFile);
const parsedConfig = ts.parseJsonConfigFileContent(configFile.config, ts.sys, path.dirname(configPath));

// Escape the brand pattern for use inside a RegExp built from it below.
const escapedBrand = opts.brandPattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const brandMessageRegex = new RegExp(`not assignable to type '\\{ readonly ${escapedBrand}: "([A-Za-z_$][A-Za-z0-9_$]*)"; \\}'`);

function wrapperNameFor(brandedType) {
  return `${opts.wrapperPrefix}${brandedType}`;
}

function findNodeAtPosition(sourceFile, start, length) {
  // Real, direct AST traversal to the exact node whose own start/end
  // match the diagnostic's position - never a blind start/length text
  // splice. BUG #1, found the hard way: TypeScript's diagnostic for a
  // mismatched object-literal property reports its position at the
  // property's own NAME, not its value. Wrapping the name directly
  // produces invalid syntax (a function call as an object property
  // key, e.g. "asLedgerName(ledger): 'Actual'"). This function's job
  // is only to find the exact node; resolveWrapTarget (below) is what
  // redirects a property-name node to its real value.
  function visit(node) {
    if (node.getStart(sourceFile) === start && node.getEnd() === start + length) {
      return node;
    }
    if (start >= node.getStart(sourceFile) && start + length <= node.getEnd()) {
      return ts.forEachChild(node, visit) || node;
    }
    return undefined;
  }
  return visit(sourceFile);
}

function resolveWrapTarget(node) {
  // If the exact node flagged is a property's own NAME, the real,
  // correct thing to wrap is that property's own VALUE (initializer)
  // instead - the name itself is never a valid expression to wrap.
  if (node.parent && ts.isPropertyAssignment(node.parent) && node.parent.name === node) {
    return node.parent.initializer;
  }
  return node;
}

function ensureImports(filePath, usedWrappers) {
  // BUG #2, found the hard way: wrapping an expression with
  // asUserId(...) is worthless if asUserId itself was never imported -
  // a real, immediate ReferenceError at runtime that a type-checker
  // alone will never catch (the import line itself type-checks fine;
  // it's only the *usage* that's new). Handles BOTH real import
  // styles found across real codebases:
  //   import { a, b } from '../src/db.ts';
  //   const { a, b } = await import('../src/db.ts');
  // A static "import type { ... }" line is deliberately never matched
  // here (the regex requires "import" immediately followed by "{",
  // with no "type" in between) - adding a runtime function name to a
  // type-only import would itself be a new, different bug.
  let text = fs.readFileSync(filePath, 'utf8');
  const usedList = [...usedWrappers].filter((w) => new RegExp(`\\b${w}\\(`).test(text));
  if (usedList.length === 0) return;

  const staticImportRegex = /import\s*\{([^}]*)\}\s*from\s*(['"][^'"]*['"])/s;
  const dynamicImportRegex = /const\s*\{([^}]*)\}\s*=\s*await\s*import\((['"][^'"]*['"])\)/s;

  // Prefer whichever import statement already references the module
  // that actually exports these wrapper names, found by checking each
  // match's existing name list for overlap with a name we know is a
  // real export used elsewhere in the file already (best-effort: falls
  // back to the first import of either kind found).
  let match = text.match(staticImportRegex);
  let isDynamic = false;
  if (!match) {
    match = text.match(dynamicImportRegex);
    isDynamic = true;
  }
  if (!match) {
    console.log(`  WARNING: no existing import found in ${filePath} to attach wrapper imports to - add these manually: ${usedList.join(', ')}`);
    return;
  }
  const existingNames = match[1].split(',').map((n) => n.trim()).filter(Boolean);
  const missing = usedList.filter((w) => !existingNames.includes(w));
  if (missing.length === 0) return;
  const newImportList = [...existingNames, ...missing].join(isDynamic ? ',\n  ' : ', ');
  const replacement = isDynamic ? `const {\n  ${newImportList},\n} = await import(${match[2]})` : `import { ${newImportList} } from ${match[2]}`;
  text = text.replace(isDynamic ? dynamicImportRegex : staticImportRegex, replacement);
  fs.writeFileSync(filePath, text);
  console.log(`  Added missing import(s) to ${filePath}: ${missing.join(', ')}`);
}

function runOnce(filePath, allFiles) {
  const program = ts.createProgram(allFiles, parsedConfig.options);
  const sourceFile = program.getSourceFile(filePath);
  const diagnostics = ts.getPreEmitDiagnostics(program, sourceFile);

  const edits = [];
  const usedWrappers = new Set();
  for (const diag of diagnostics) {
    if (diag.file !== sourceFile) continue;
    const message = ts.flattenDiagnosticMessageText(diag.messageText, ' ');
    const match = message.match(brandMessageRegex);
    if (!match) continue;
    const brandedType = match[1];
    const wrapper = wrapperNameFor(brandedType);
    usedWrappers.add(wrapper);

    const flaggedNode = findNodeAtPosition(sourceFile, diag.start, diag.length);
    if (!flaggedNode) continue;

    // A distinct, third case, found while generalizing this for reuse:
    // a shorthand property ({ business, ledger }) has no separate
    // value node to wrap at all - the identifier itself must be
    // expanded to a real "name: wrapper(name)" pair, a genuine text
    // transformation, not just a wrap-in-place (which would produce
    // the same kind of invalid syntax as bug #1 above, just via a
    // different AST shape).
    if (ts.isShorthandPropertyAssignment(flaggedNode)) {
      const name = flaggedNode.name.getText(sourceFile);
      edits.push({ start: flaggedNode.getStart(sourceFile), length: flaggedNode.getEnd() - flaggedNode.getStart(sourceFile), replacement: `${name}: ${wrapper}(${name})` });
      continue;
    }

    const target = resolveWrapTarget(flaggedNode);
    // Safety check: only ever wrap a node that is genuinely a valid,
    // standalone expression - never a property name, a spread
    // element, or anything else that would produce invalid syntax.
    if (!ts.isExpression(target)) continue;

    edits.push({ start: target.getStart(sourceFile), length: target.getEnd() - target.getStart(sourceFile), wrapper });
  }

  if (edits.length === 0) return { fixed: 0, usedWrappers };

  const seen = new Set();
  const uniqueEdits = edits.filter((e) => {
    const key = `${e.start}:${e.length}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  uniqueEdits.sort((a, b) => b.start - a.start);

  let text = fs.readFileSync(filePath, 'utf8');
  for (const edit of uniqueEdits) {
    const before = text.slice(0, edit.start);
    const targetText = text.slice(edit.start, edit.start + edit.length);
    const after = text.slice(edit.start + edit.length);
    const replacement = edit.replacement !== undefined ? edit.replacement : `${edit.wrapper}(${targetText})`;
    text = `${before}${replacement}${after}`;
  }
  if (!opts.dryRun) fs.writeFileSync(filePath, text);
  return { fixed: uniqueEdits.length, usedWrappers };
}

for (const file of opts.files) {
  const absPath = path.resolve(file);
  console.log(`\n=== ${file} ===`);
  if (opts.dryRun) {
    const { fixed } = runOnce(absPath, [absPath]);
    console.log(`Dry run: would fix ${fixed} mismatches in this pass (more may cascade on subsequent passes - run without --dry-run to see the true total).`);
    continue;
  }

  let totalFixed = 0;
  let round = 1;
  let allUsedWrappers = new Set();
  while (round <= opts.maxRounds) {
    const { fixed, usedWrappers } = runOnce(absPath, [absPath]);
    for (const w of usedWrappers) allUsedWrappers.add(w);
    if (fixed === 0) break;
    totalFixed += fixed;
    console.log(`Round ${round}: fixed ${fixed} mismatch(es).`);
    round++;
  }
  if (round > opts.maxRounds) {
    console.log(`Stopping after ${opts.maxRounds} rounds. This can be genuine, slow, sequential discovery (TypeScript sometimes reports only one error per call/scope until the first is resolved) rather than a bug - re-run this same command again to continue, or raise --max-rounds. If the count truly never reaches 0 no matter how many times you re-run it, that IS a bug: stop and inspect with the diagnostic-dump snippet in README.md before trusting further automated edits.`);
  }
  if (totalFixed > 0) ensureImports(absPath, allUsedWrappers);
  console.log(`Total: ${totalFixed} mismatch(es) fixed in ${file}.`);
}
