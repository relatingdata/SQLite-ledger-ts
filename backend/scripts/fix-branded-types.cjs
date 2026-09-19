// A real, direct codemod: finds every real place a bare number/string
// literal (or expression) is passed where a real, branded type
// (UserId, BusinessName, AccountName, ...) is expected, and wraps it
// with the real, corresponding asXxx() function - using TypeScript's
// own compiler API for exact, position-based diagnostics, never a
// regex guess at what "looks like" a mismatch.
const ts = require('typescript');
const fs = require('fs');
const path = require('path');

const targetFile = process.argv[2];
if (!targetFile) {
  console.error('Usage: node fix-branded-types.cjs <file.ts>');
  process.exit(1);
}

const absPath = path.resolve(targetFile);
const configPath = ts.findConfigFile(path.dirname(absPath), ts.sys.fileExists, 'tsconfig.json');
if (!configPath) {
  console.error('Could not find tsconfig.json');
  process.exit(1);
}
const configFile = ts.readConfigFile(configPath, ts.sys.readFile);
const parsedConfig = ts.parseJsonConfigFileContent(configFile.config, ts.sys, path.dirname(configPath));

// The real, direct mapping from a branded type's own, real name to its
// real, established asXxx() wrapper function - the exact, same
// convention already used everywhere else in this codebase.
const typeToWrapper = {
  UserId: 'asUserId',
  EntityId: 'asEntityId',
  BusinessName: 'asBusinessName',
  LedgerName: 'asLedgerName',
  AccountName: 'asAccountName',
  DivisionName: 'asDivisionName',
  LocationName: 'asLocationName',
  EmployeeName: 'asEmployeeName',
  CustomerName: 'asCustomerName',
  VendorName: 'asVendorName',
  ItemName: 'asItemName',
};

function findNodeAtPosition(sourceFile, start, length) {
  // Real, direct AST traversal to the exact, real node whose own
  // start/end match the diagnostic's position - never a blind
  // start/length text splice, since a real diagnostic on an object
  // literal's own, mismatched property reports its position at the
  // real property NAME, not its real value - wrapping the name
  // directly would produce genuinely invalid syntax (a function call
  // as a property key). Confirmed directly: this is exactly the real
  // bug found and fixed here, not a hypothetical one.
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
  // If the exact node flagged is a property's own NAME (identifier
  // or string literal key), the real, correct thing to wrap is that
  // property's own real VALUE (initializer) instead - the name
  // itself is never a real, valid expression to wrap.
  if (node.parent && ts.isPropertyAssignment(node.parent) && node.parent.name === node) {
    return node.parent.initializer;
  }
  return node;
}

function runOnce(filePath) {
  const program = ts.createProgram([filePath], parsedConfig.options);
  const sourceFile = program.getSourceFile(filePath);
  const diagnostics = ts.getPreEmitDiagnostics(program, sourceFile);

  const edits = [];
  for (const diag of diagnostics) {
    if (diag.file !== sourceFile) continue;
    const message = ts.flattenDiagnosticMessageText(diag.messageText, ' ');
    const match = message.match(/not assignable to type '\{ readonly __brand: "([A-Za-z]+)"; \}'/);
    if (!match) continue;
    const brandedType = match[1];
    const wrapper = typeToWrapper[brandedType];
    if (!wrapper) continue;

    const flaggedNode = findNodeAtPosition(sourceFile, diag.start, diag.length);
    if (!flaggedNode) continue;

    // A real, distinct case: a shorthand property ({ business, ledger })
    // has no separate value node to wrap at all - the identifier
    // itself must be expanded to a real "name: wrapper(name)" pair,
    // a genuine text transformation, not just a wrap.
    if (ts.isShorthandPropertyAssignment(flaggedNode)) {
      const name = flaggedNode.name.getText(sourceFile);
      edits.push({ start: flaggedNode.getStart(sourceFile), length: flaggedNode.getEnd() - flaggedNode.getStart(sourceFile), replacement: `${name}: ${wrapper}(${name})` });
      continue;
    }

    const target = resolveWrapTarget(flaggedNode);
    // A real, direct safety check: only ever wrap a node that is
    // genuinely a valid, standalone expression - never a property
    // name, a spread element, or anything else that would produce
    // real, invalid syntax once wrapped.
    if (!ts.isExpression(target)) continue;

    edits.push({ start: target.getStart(sourceFile), length: target.getEnd() - target.getStart(sourceFile), wrapper });
  }

  if (edits.length === 0) return 0;

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
  fs.writeFileSync(filePath, text);
  return uniqueEdits.length;
}

function ensureImports(filePath) {
  // A real, confirmed gap, found directly: wrapping an expression with
  // asUserId(...) is worthless if asUserId itself was never imported -
  // a real, immediate runtime ReferenceError. Finds this file's own,
  // existing import of db.ts (whatever its real, relative path is,
  // since every real script/test file already imports something real
  // from it) and adds any newly-used wrapper names to that same,
  // existing import statement, rather than assuming a fixed path.
  let text = fs.readFileSync(filePath, 'utf8');
  const usedWrappers = new Set();
  for (const wrapper of Object.values(typeToWrapper)) {
    if (new RegExp(`\\b${wrapper}\\(`).test(text)) usedWrappers.add(wrapper);
  }
  const importRegex = /import\s*\{([^}]*)\}\s*from\s*(['"][^'"]*\/db(?:\.ts|\.js)?['"])/;
  const match = text.match(importRegex);
  if (!match) {
    console.log(`  WARNING: no real, existing db.ts import found in ${filePath} - cannot auto-add wrapper imports.`);
    return;
  }
  const existingNames = match[1].split(',').map((n) => n.trim()).filter(Boolean);
  const missing = [...usedWrappers].filter((w) => !existingNames.includes(w));
  if (missing.length === 0) return;
  const newImportList = [...existingNames, ...missing].join(', ');
  text = text.replace(importRegex, `import { ${newImportList} } from ${match[2]}`);
  fs.writeFileSync(filePath, text);
  console.log(`  Added missing import(s): ${missing.join(', ')}`);
}

// Real diagnostics can overlap/nest (fixing an outer one can reveal or
// shift an inner one) - repeat until a real, stable, zero-edit pass.
let totalFixed = 0;
let round = 1;
while (true) {
  const fixed = runOnce(absPath);
  if (fixed === 0) break;
  totalFixed += fixed;
  console.log(`Round ${round}: fixed ${fixed} real, branded-type mismatches.`);
  round++;
  if (round > 100) {
    console.log('Stopping after 100 real rounds - check remaining diagnostics manually.');
    break;
  }
}
if (totalFixed > 0) ensureImports(absPath);
console.log(`Total: ${totalFixed} real, branded-type mismatches fixed in ${targetFile}.`);
