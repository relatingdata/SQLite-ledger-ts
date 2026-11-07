// Permanent correctness test for MemoryEntityDriver (the "genuinely
// separate engine" option — in-process, plain TypeScript, no subprocess,
// no SQL entity table). Mirrors the same check shapes as
// kaappi-experiment/entity-model/entities.sld's own
// test-indexed-lookups.scm (every mutation path: create/rename/reparent/
// relate, a multi-level descendantsWithDepth walk), plus the one thing
// that Scheme-side test couldn't cover: a real WAL persistence round
// trip through the SAME kaappi_wal table KaappiEntityDriver uses,
// proving this driver's durability story across a simulated process
// restart (a fresh driver instance replaying the same stored op log),
// not just its in-memory correctness within one instance's lifetime.
import { test, after } from './test-runtime.ts';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const tmpDbPath = path.join(os.tmpdir(), `sql-ledger-ts-memory-driver-test-${process.pid}-${Date.now()}.sqlite`);
process.env.DB_PATH = tmpDbPath;
process.env.SEED_DEMO_BUSINESSES = 'false';

const db = await import('../src/db.ts');
const { MemoryEntityDriver } = await import('../src/drivers/memory-entity-driver.ts');

after(() => {
  try {
    fs.rmSync(tmpDbPath, { force: true });
    fs.rmSync(`${tmpDbPath}-wal`, { force: true });
    fs.rmSync(`${tmpDbPath}-shm`, { force: true });
  } catch {
    // best-effort cleanup only
  }
});

const U = db.asUserId(1);

function sortedNames(nodes: { name: string }[]): string[] {
  return nodes.map((n) => n.name).sort();
}

// The public create(name, parent: string|number, userId) signature always
// requires a resolvable parent (same real restriction SqlEntityDriver's
// own public create carries) — there is no way to create a true,
// parentless root through it, by design. Real top-level entities are
// always bootstrapped some other way (raw SQL/seed data for the SQL
// system; a direct create-op for this one). Seeding one op directly into
// kaappi_wal before the driver's first construction exercises the exact
// same replay path real bootstrapped data takes, and is the only way to
// get a parentless box into this engine at all.
function seedRootOp(): void {
  db.db.prepare('UPDATE kaappi_wal SET ops_json = ? WHERE id = 1').run(JSON.stringify([['create', 1, 'Root', null, null, 1]]));
}

test('MemoryEntityDriver: create/children/rename/reparent/relate/descendants/revoke/getMany/findAll/findByNameContaining — one flowing scenario, matching entities.sld test-indexed-lookups.scm', () => {
  seedRootOp();
  const d = new MemoryEntityDriver();

  const root = d.get('Root');
  assert.ok(root, 'Root replayed from the seeded WAL op');
  assert.equal(root!.parent_id, null);

  const biz = d.create('Businesses', 'Root', U);
  const acme = d.create('Acme', biz.id, U);
  const globex = d.create('Globex', biz.id, U);

  assert.deepEqual(sortedNames(d.children(biz.id)), ['Acme', 'Globex'], 'materialized children list right after two creates');
  assert.deepEqual(d.children(acme.id), [], 'Acme has no children yet');

  const acmeDept = d.create('Accounting', acme.id, U);
  assert.deepEqual(sortedNames(d.children(acme.id)), ['Accounting']);

  // duplicate-under-same-parent conflict, same wording as SqlEntityDriver/entities.sld
  assert.throws(() => d.create('Accounting', acme.id, U), /already exists under this real, same parent/);

  // getByName / getUnder
  assert.equal(d.getByName('Accounting')!.name, 'Accounting');
  assert.equal(d.getByName('NoSuchEntity'), undefined);
  assert.equal(d.getUnder('Accounting', acme.id)!.id, acmeDept.id);

  // rename moves the name index
  d.rename(acmeDept.id, 'Finance', U);
  assert.equal(d.getByName('Accounting'), undefined, 'old name no longer resolves');
  assert.equal(d.getByName('Finance')!.id, acmeDept.id);
  assert.deepEqual(sortedNames(d.children(acme.id)), ['Finance']);

  // reparent moves the box between two children-lists
  d.reparent(acmeDept.id, 'Globex', U);
  assert.deepEqual(d.children(acme.id), [], 'old parent no longer lists it');
  assert.deepEqual(sortedNames(d.children(globex.id)), ['Finance']);
  assert.equal(d.get(acmeDept.id)!.parent_id, globex.id);
  assert.throws(() => d.reparent(acmeDept.id, 'Finance', U), /cannot be its own parent/i, 'reparenting under itself by name resolves to itself and is rejected');

  // a real, multi-level subtree for descendantsWithDepth
  const subA = d.create('SubA', acme.id, U);
  const subA1 = d.create('SubA1', subA.id, U);
  const subB = d.create('SubB', acme.id, U);
  assert.deepEqual(
    d.descendantsWithDepth(acme.id).map((n) => n.name).sort(),
    ['Acme', 'SubA', 'SubA1', 'SubB'].sort(),
    'descendants includes every level, root included at depth 0'
  );
  const acmeEntry = d.descendantsWithDepth(acme.id).find((n) => n.id === acme.id)!;
  assert.equal(acmeEntry.depth, 0);
  const subA1Entry = d.descendantsWithDepth(acme.id).find((n) => n.id === subA1.id)!;
  assert.equal(subA1Entry.depth, 2);

  // whole-tree walk from a synthetic null root — a real capability this
  // engine has that KaappiEntityDriver's own descendantsWithDepth(null)
  // deliberately throws on (see that driver's header).
  const wholeTree = d.descendantsWithDepth(null);
  assert.ok(wholeTree.some((n) => n.id === root!.id && n.depth === 0));
  assert.ok(wholeTree.some((n) => n.id === subA1.id));

  // relate + hasTag (a child acting as a type-marker, its OWN relation_id set)
  const locationTypeMarker = d.create('LocationType', acme.id, U);
  d.relate(locationTypeMarker.id, null, U, globex.id);
  assert.equal(d.hasTag(acme.id, 'LocationType'), true);
  assert.equal(d.hasTag(acme.id, 'NoSuchTag'), false);
  assert.equal(d.get(locationTypeMarker.id)!.relation_id, globex.id);

  // setAttr/getAttr round trip, including overwrite of an existing value
  d.setAttr(acme.id, 'Phone', '0400 111 222', U);
  assert.equal(d.getAttr(acme.id, 'Phone'), '0400 111 222');
  d.setAttr(acme.id, 'Phone', '0400 999 888', U);
  assert.equal(d.getAttr(acme.id, 'Phone'), '0400 999 888');
  assert.equal(d.getAttr(acme.id, 'NoSuchAttr'), undefined);

  // revoke is a disclosed, not-implemented gap (see this driver's header)
  assert.throws(() => d.revoke(subB.id, U), /not implemented/);

  // getMany — silently drops a missing id
  const many = d.getMany([acme.id, subA.id, 999999]);
  assert.deepEqual(sortedNames(many), ['Acme', 'SubA']);

  // findAll — relationId / nameSuffix / underTagNamed, independently and AND-combined
  assert.deepEqual(
    sortedNames(d.findAll({ relationId: globex.id })),
    ['LocationType']
  );
  assert.deepEqual(sortedNames(d.findAll({ nameSuffix: '1' })), ['SubA1']);
  assert.deepEqual(sortedNames(d.findAll({ underTagNamed: 'Acme' })).sort(), ['LocationType', 'Phone', 'SubA', 'SubB'].sort());

  // findByNameContaining — case-insensitive substring, optionally scoped to
  // DIRECT children only (same as SqlEntityDriver's own `parent_id = ?`
  // filter — SubA1 is a grandchild of Acme via SubA, not a direct child,
  // so it's correctly excluded when scoped to acme.id).
  assert.deepEqual(sortedNames(d.findByNameContaining('suba')), ['SubA', 'SubA1']);
  assert.deepEqual(sortedNames(d.findByNameContaining('sub', acme.id)), ['SubA', 'SubB']);
  assert.deepEqual(d.findByNameContaining('sub', globex.id), []);
});

test('MemoryEntityDriver: a fresh instance replays the shared kaappi_wal op log and sees every prior write — the real "process restart" proof', () => {
  // Reuses the SAME db file/kaappi_wal row the scenario test above already
  // wrote to (module-level DB_PATH, one shared connection for this whole
  // file) — so this test's first `new MemoryEntityDriver()` already
  // starts from a non-empty log, which is itself part of the proof: a
  // brand-new instance, with no in-memory state carried over from the
  // previous test's own `d`, reconstructs the identical tree purely from
  // the stored ops.
  const driver2 = new MemoryEntityDriver();
  assert.equal(driver2.getByName('Finance')!.parent_id, driver2.getByName('Globex')!.id, 'driver2 independently replays the earlier test\'s rename+reparent correctly');
  // The real descendant set of Acme at this point also includes the
  // LocationType marker and the Phone attribute node + its value, all
  // created under Acme later in the previous test — the full real state,
  // not just the earlier subset, since this is a true persistence check,
  // not a reset.
  assert.deepEqual(
    sortedNames(driver2.descendantsWithDepth(driver2.getByName('Acme')!.id)),
    ['Acme', 'SubA', 'SubA1', 'SubB', 'LocationType', 'Phone', '0400 999 888'].sort()
  );

  // Mutate via driver2, then construct a THIRD instance — confirming the
  // invariant holds transitively (every instance's writes are visible to
  // every later instance), not just once.
  const underAcme = driver2.getByName('Acme')!.id;
  const newChild = driver2.create('CreatedByDriver2', underAcme, U);

  const driver3 = new MemoryEntityDriver();
  assert.equal(driver3.get(newChild.id)!.name, 'CreatedByDriver2');
  assert.ok(sortedNames(driver3.children(underAcme)).includes('CreatedByDriver2'));
});
