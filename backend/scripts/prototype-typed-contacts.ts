/**
 * Prototype: multiple, typed addresses and phone numbers per entity —
 * a store, vendor, or customer needs a Head Office address AND a
 * Billing address AND a Delivery address, not just one. Since an
 * entity can only have one relation_id, the shape has to invert: each
 * address/phone becomes its own child entity (parent_id already
 * handles one-to-many naturally, no new mechanism needed), and that
 * child's own relation_id points at a type marker (Head Office,
 * Billing, Mobile, Landline...) — exactly the relationship-type
 * pattern, one level deeper. The child gets its own contact row for
 * the actual value, reusing the exact mechanism already proven for
 * locations' own address in this project. Zero new tables.
 *
 * Run with: node --import tsx backend/scripts/prototype-typed-contacts.ts
 */
import { createEntity, setContact, getContact, updateEntity, db } from '../src/db.js';

async function main() {
  console.log('=== Setup: Address Types and Phone Types categories ===');
  createEntity({ name: 'Address Types', parent: 'Vocabulary' }, 1);
  for (const t of ['Registered Office', 'Billing', 'Delivery', 'Shipping']) {
    createEntity({ name: t, parent: 'Address Types' }, 1);
  }
  createEntity({ name: 'Phone Types', parent: 'Vocabulary' }, 1);
  for (const t of ['Landline', 'Mobile', 'Home', 'Fax', 'Toll-Free']) {
    createEntity({ name: t, parent: 'Phone Types' }, 1);
  }

  console.log('\n=== A real store with multiple typed addresses and phones ===');
  createEntity({ name: 'PrototypeTestStore', parent: 'Locations' }, 1);

  function addAddress(entityName: string, addressType: string, value: { address_line1: string; city: string; region?: string; postal_code?: string; country?: string }) {
    const childName = `${entityName} — ${addressType} Address`;
    try {
      createEntity({ name: childName, parent: entityName }, 1);
    } catch {
      // already exists
    }
    const child = db.prepare(`SELECT id FROM current_entities WHERE name = ?`).get(childName) as { id: number };
    updateEntity(child.id, { relation: addressType }, 1);
    setContact(childName, value);
    return childName;
  }

  function addPhone(entityName: string, phoneType: string, number: string) {
    const childName = `${entityName} — ${phoneType} Phone`;
    try {
      createEntity({ name: childName, parent: entityName }, 1);
    } catch {
      // already exists
    }
    const child = db.prepare(`SELECT id FROM current_entities WHERE name = ?`).get(childName) as { id: number };
    updateEntity(child.id, { relation: phoneType }, 1);
    setContact(childName, { phone: number });
    return childName;
  }

  addAddress('PrototypeTestStore', 'Registered Office', { address_line1: '1 Corporate Way', city: 'Springfield', region: 'State', postal_code: '1000', country: 'Testland' });
  addAddress('PrototypeTestStore', 'Delivery', { address_line1: '42 Market Street', city: 'Springfield', region: 'State', postal_code: '1001', country: 'Testland' });
  addPhone('PrototypeTestStore', 'Landline', '555-0100');
  addPhone('PrototypeTestStore', 'Mobile', '555-0199');

  console.log('\n=== Query: every address on this store, with its type ===');
  const addresses = db
    .prepare(
      `SELECT type_marker.name AS address_type, child.name AS record_name
       FROM current_entities child
       JOIN current_entities parent ON parent.id = child.parent_id AND parent.name = 'PrototypeTestStore'
       JOIN current_entities type_marker ON type_marker.id = child.relation_id
       JOIN current_entities type_category ON type_category.id = type_marker.parent_id AND type_category.name = 'Address Types'`
    )
    .all() as { address_type: string; record_name: string }[];
  for (const a of addresses) {
    const contact = getContact(a.record_name);
    console.log(` - ${a.address_type}: ${contact?.address_line1}, ${contact?.city}`);
  }
  if (addresses.length !== 2) throw new Error('PROTOTYPE FAILURE: expected 2 addresses');

  console.log('\n=== Query: every phone on this store, with its type ===');
  const phones = db
    .prepare(
      `SELECT type_marker.name AS phone_type, child.name AS record_name
       FROM current_entities child
       JOIN current_entities parent ON parent.id = child.parent_id AND parent.name = 'PrototypeTestStore'
       JOIN current_entities type_marker ON type_marker.id = child.relation_id
       JOIN current_entities type_category ON type_category.id = type_marker.parent_id AND type_category.name = 'Phone Types'`
    )
    .all() as { phone_type: string; record_name: string }[];
  for (const p of phones) {
    const contact = getContact(p.record_name);
    console.log(` - ${p.phone_type}: ${contact?.phone}`);
  }
  if (phones.length !== 2) throw new Error('PROTOTYPE FAILURE: expected 2 phones');

  console.log('\n=== Confirming addresses and phones never get confused with each other (different type category) ===');
  const allChildren = db.prepare(`SELECT COUNT(*) as c FROM current_entities WHERE parent_id = (SELECT id FROM current_entities WHERE name = 'PrototypeTestStore')`).get() as { c: number };
  console.log('Total child records on this store:', allChildren.c, '(2 addresses + 2 phones)');
  if (allChildren.c !== 4) throw new Error('PROTOTYPE FAILURE: expected exactly 4 children');

  console.log('\n=== ALL SCENARIOS PASSED — multiple, typed addresses/phones, zero new tables ===');
}

main().catch((err) => {
  console.error('PROTOTYPE FAILED:', err);
  process.exit(1);
});
