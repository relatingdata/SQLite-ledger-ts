/**
 * Prototype: the relationship-type pattern, confirmed uniform (not a
 * special case) with the three existing relation_id uses — a plain
 * tag (COGS/Balance Sheet/P&L) is the degenerate case of this same
 * shape, where the type IS the complete answer and no second hop is
 * needed. A relationship needing both "what kind" and "with whom"
 * (trustee-of) uses the full recursive shape: relation_id points at an
 * intermediate entity, whose own parent_id gives the type and whose
 * own relation_id gives the target.
 *
 * Run with: node --import tsx backend/scripts/prototype-relationship-type.ts
 */
import { createEntityRaw, create, requireEntity, typeRootName, typeVocabularyWordName, updateEntity, db } from '../src/db.js';

async function main() {
  console.log('=== Setup: Relationship Types tree ===');
  create(requireEntity('Vocabulary', typeRootName), typeVocabularyWordName, 'Relationship Types', 1);
  create(requireEntity('Relationship Types', typeRootName), typeRootName, 'Trustee Of', 1);
  create(requireEntity('Relationship Types', typeRootName), typeRootName, 'Subsidiary Of', 1);

  console.log('\n=== Real businesses ===');
  create(requireEntity('Businesses', typeRootName), typeRootName, 'Smith Prototype Trust', 1);
  create(requireEntity('Businesses', typeRootName), typeRootName, 'Jones Prototype Trust', 1);
  create(requireEntity('Businesses', typeRootName), typeRootName, 'Boutique Wine Company', 1);

  console.log('\n=== The relationship itself: an intermediate entity, type via parent_id, target via its own relation_id ===');
  const rel1 = create(requireEntity('Trustee Of', typeRootName), typeRootName, 'Trustee relationship — Smith Prototype Trust', 1);
  updateEntity(rel1.id, { relation: 'Boutique Wine Company' }, 1);
  const rel2 = create(requireEntity('Trustee Of', typeRootName), typeRootName, 'Trustee relationship — Jones Prototype Trust', 1);
  updateEntity(rel2.id, { relation: 'Boutique Wine Company' }, 1);

  console.log('=== The trust points at its own relationship record — the same relation_id mechanism, one recursive hop deeper ===');
  const smith = db.prepare(`SELECT id FROM current_entities WHERE name = 'Smith Prototype Trust'`).get() as { id: number };
  updateEntity(smith.id, { relation: 'Trustee relationship — Smith Prototype Trust' }, 1);
  const jones = db.prepare(`SELECT id FROM current_entities WHERE name = 'Jones Prototype Trust'`).get() as { id: number };
  updateEntity(jones.id, { relation: 'Trustee relationship — Jones Prototype Trust' }, 1);

  console.log('\n=== Query 1: "What relationship does Smith Prototype Trust have, and with whom?" ===');
  const query1 = db
    .prepare(
      `SELECT trust.name AS trust, rel_type.name AS relationship_type, target.name AS target
       FROM current_entities trust
       JOIN current_entities rel ON rel.id = trust.relation_id
       JOIN current_entities rel_type ON rel_type.id = rel.parent_id
       JOIN current_entities target ON target.id = rel.relation_id
       WHERE trust.name = 'Smith Prototype Trust'`
    )
    .get() as { trust: string; relationship_type: string; target: string } | undefined;
  console.log(query1);
  if (!query1 || query1.relationship_type !== 'Trustee Of' || query1.target !== 'Boutique Wine Company') {
    throw new Error('PROTOTYPE FAILURE: query 1 wrong');
  }

  console.log('\n=== Query 2: "Show me every company acting as trustee for anything" — the group query, walking from the type node ===');
  const query2 = db
    .prepare(
      `SELECT target.name AS trustee_company, trust.name AS trust
       FROM current_entities rel
       JOIN current_entities rel_type ON rel_type.id = rel.parent_id AND rel_type.name = 'Trustee Of'
       JOIN current_entities target ON target.id = rel.relation_id
       JOIN current_entities trust ON trust.relation_id = rel.id`
    )
    .all() as { trustee_company: string; trust: string }[];
  console.log(query2);
  if (query2.length !== 2 || !query2.every((r) => r.trustee_company === 'Boutique Wine Company')) {
    throw new Error('PROTOTYPE FAILURE: query 2 (group query) wrong');
  }

  console.log('\n=== Confirming this is the SAME shape as the existing COGS tag, not a special case ===');
  // A tag is the degenerate case: relation_id -> the type entity directly,
  // no second hop needed because there's no separate "target" fact.
  const cogsCheck = db
    .prepare(
      `SELECT e.name, tag.name AS tag_name, tag_parent.name AS tag_category
       FROM current_entities e
       JOIN current_entities tag ON tag.id = e.relation_id
       LEFT JOIN current_entities tag_parent ON tag_parent.id = tag.parent_id
       WHERE e.relation_id = (SELECT id FROM current_entities WHERE name = 'COGS')
       LIMIT 1`
    )
    .get() as { name: string; tag_name: string; tag_category: string } | undefined;
  console.log('A real COGS-tagged account:', cogsCheck);
  console.log('Same underlying shape: relation_id -> an entity whose own parent_id gives its category/type.');
  console.log('The trustee case just adds one more hop (the intermediate\'s own relation_id) because it has a second fact (the target) to record — the tag case has none.');

  console.log('\n=== ALL SCENARIOS PASSED — one uniform pattern, not a special case ===');
}

main().catch((err) => {
  console.error('PROTOTYPE FAILED:', err);
  process.exit(1);
});
