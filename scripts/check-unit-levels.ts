// Every unit test file is in exactly one level of `make test-unit`
// (Makefile, UNIT_*; docs/pm-testing-unit.md, "Levels"). The levels come
// as arguments, separated by `--`.
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const levels: string[][] = [[]];
for (const arg of process.argv.slice(2)) {
  if (arg === '--') levels.push([]);
  else levels[levels.length - 1].push(arg);
}
const tests = execFileSync('git', ['ls-files', '*.test.ts'], { cwd: root, encoding: 'utf-8' })
  .split('\n')
  .filter((f) => f && !f.startsWith('storage_engine/'));
let failures = 0;
for (const file of tests) {
  const n = levels.filter((l) => l.includes(file)).length;
  if (n !== 1) {
    console.error(`❌ ${file} is in ${n} unit-test levels; it must be in exactly one.`);
    failures++;
  }
}
for (const file of levels.flat()) {
  if (!tests.includes(file)) {
    console.error(`❌ The Makefile lists ${file}, which is not a tracked test file.`);
    failures++;
  }
}
if (failures) process.exit(1);
console.log(`✅ PASS: all ${tests.length} unit test files are in exactly one of the ${levels.length} levels.`);
