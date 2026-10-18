// A small, deliberately minimal library of test fixtures.
//
// The whole point of this file: no test anywhere in db.test.ts (or any
// other test file built on it) should ever read or write the shared
// 'admin' business, or rely on any other globally-seeded business or
// account. Every test creates its OWN, uniquely-named, genuinely real
// business - via the real createBusiness production function, the
// exact same one the setup wizard uses - then layers onto it only the
// specific, small set of further fixtures that one test actually
// needs (a location, an item, a hierarchy value, ...). Nothing here
// is a fake or shortcut version of the real mechanism; every helper
// is a thin, named wrapper around a real db.ts function, composed the
// same way the real application composes them. See
// docs/test-fixtures-design.md for the full rationale and a worked
// example.
//
// Isolation note: a business created WITHOUT a coaPrototype gets an
// empty Chart of Accounts of its own - a prototype-tagged account
// name like "Cash and Bank" or "Sales Revenue" then falls back to the
// one, single, global template copy (see the real, documented
// COALESCE fallback in schema/00-core.sql's post_journal_entry
// trigger, and copyChartOfAccountsInto's own comments in db.ts) -
// genuinely shared across every other business that also omitted a
// prototype. A fixture business that will stage or post to any such
// named account must pass coaPrototype: 'English CoA' (the real,
// built-in prototype every demo business already uses) so it gets
// its own, separate, real copy - true per-test isolation, not an
// assumption. freshBusiness defaults to 'English CoA' for exactly
// this reason; pass coaPrototype: undefined only for a test that
// genuinely only exercises bare entity-tree/structural mechanics with
// no named financial account at all.

import type {
  BusinessName,
  LedgerName,
  UserId,
  EntityNode,
  TypedNode,
  ItemName,
  LocationName,
} from '../src/db.ts';
import { runInSessionContext } from '../src/session-context.ts';

// The real db.ts module, dynamically imported by the test file itself
// (after it sets process.env.DB_PATH) and handed in here - this file
// never imports db.ts on its own, since a static or eager top-level
// import would race the test file's own DB_PATH assignment and
// silently reconnect to the wrong database. See db.test.ts's own
// comment on the same hazard.
export type DbModule = typeof import('../src/db.ts');

let counter = 0;
/** A short, collision-free suffix - a counter plus a few random
 * characters, so two tests run in any order, or genuinely in
 * parallel, never collide on the same business/location/item name
 * even when they start from the same hint. */
export function uniqueSuffix(): string {
  counter += 1;
  return `${counter}-${Math.random().toString(36).slice(2, 8)}`;
}

export function uniqueName(hint: string): string {
  return `${hint} ${uniqueSuffix()}`;
}

export interface BusinessFixture {
  business: BusinessName;
  actualLedger: LedgerName;
  budgetLedger: LedgerName;
}

export interface FreshBusinessOptions {
  financialYearLabel?: string;
  /** 'English CoA' by default - see the module doc comment above.
   * Pass undefined explicitly for a test that never touches a named,
   * prototype-tagged account. */
  coaPrototype?: string | undefined;
  secondaryCurrencies?: string[];
  entityStructure?: Parameters<DbModule['createBusiness']>[5];
  partnerNames?: string[];
}

export function makeFixtures(db: DbModule) {
  const userId: UserId = db.asUserId(1);

  /** Creates a real, uniquely-named business via the real
   * createBusiness production function - never a cut-down or
   * test-only substitute. `hint` becomes a readable prefix; the real,
   * final name also carries a collision-free suffix, so this test's
   * business can never be confused with another test's, whatever
   * order they run in. */
  function freshBusiness(hint: string, opts: FreshBusinessOptions = {}): BusinessFixture {
    const name = db.asBusinessName(uniqueName(hint));
    const coaPrototype = 'coaPrototype' in opts ? opts.coaPrototype : 'English CoA';
    return db.createBusiness(name, opts.financialYearLabel ?? '2027-28', userId, coaPrototype, opts.secondaryCurrencies, opts.entityStructure, opts.partnerNames);
  }

  /** A real, minimal, immediately-postable location - the exact
   * fields createAndConfigureLocation actually requires, defaulted to
   * an ordinary retail outlet, overridable per test. */
  function freshLocation(
    business: BusinessName,
    hint: string,
    overrides: Partial<{ city: string; location_type: string; is_billing_address: boolean; bottle_capacity: number | null; carton_capacity: number | null; timezone: string }> = {}
  ): { name: LocationName; entity: TypedNode<'LocationEntityName'> } {
    const name = uniqueName(hint);
    const entity = db.createAndConfigureLocation(
      business,
      name,
      {
        city: 'Adelaide',
        location_type: 'Retail',
        is_billing_address: false,
        bottle_capacity: 100,
        carton_capacity: null,
        timezone: 'Australia/Adelaide',
        ...overrides,
      },
      userId
    );
    return { name: db.asLocationName(name), entity };
  }

  /** A real item, under a real, fresh category of its own (never the
   * bare Items root) - the minimal shape every stock-movement
   * function needs to resolve a real item identity. */
  function freshItem(business: BusinessName, hint: string): { category: TypedNode<'RootName'>; itemName: ItemName } {
    const categoryName = uniqueName(`${hint} Category`);
    const itemNameStr = uniqueName(hint);
    const category = db.createItemCategory(business, categoryName, undefined, userId);
    db.create(category, db.typeItemName, itemNameStr, userId);
    return { category, itemName: db.asItemName(itemNameStr) };
  }

  /** A real hierarchy grouping plus one real value under it - the
   * minimal shape defineProductShape/receiveItems etc. need to tag a
   * movement by a real, user-defined dimension (Storage, Container,
   * ...). Returns the real, final (possibly suffixed) names actually
   * created, since a test may ask for a stable, readable grouping
   * name shared across its own several values. */
  function freshHierarchyValue(business: BusinessName, groupingName: string, valueHint: string): { groupingName: string; valueName: string } {
    const valueName = uniqueName(valueHint);
    db.ensureHierarchyGrouping(business, groupingName, userId);
    db.ensureHierarchyValue(business, groupingName, valueName, userId);
    return { groupingName, valueName };
  }

  /** The real balance/currency actually posted against one, specific
   * entity id - a thin wrapper around the one, real `account` row,
   * for the handful of cases where an entity was found some other
   * way than getEntityTree() (whose own rows already carry
   * balance_minor/currency directly - prefer reading it straight off
   * the node returned by findByName/findChild below instead of
   * calling this separately when a full entity list is already in
   * hand). */
  function getAccountBalance(entityId: number): { balance_minor: number; currency: string | null } | undefined {
    return db.db.prepare(`SELECT balance_minor, currency FROM account WHERE entity_id = ?`).get(entityId) as { balance_minor: number; currency: string | null } | undefined;
  }

  /** The real, direct child of `parentId` named `name` - the one
   * repeated shape behind every "find this specific node in the
   * entity tree" lookup in this test file. Pass a full
   * getEntityTree() result; its own rows already carry
   * balance_minor/currency/accountnumber, so no second query is
   * usually needed once this returns. */
  function findChild(entities: EntityNode[], parentId: number, name: string): EntityNode | undefined {
    return entities.find((e) => e.parent_id === parentId && e.name === name);
  }

  /** The real node named `name` anywhere in a getEntityTree() result,
   * optionally narrowed to one specific parent - for the common case
   * of finding a business's own top-level child (its Chart of
   * Accounts root, its Items root, ...) by name alone. */
  function findByName(entities: EntityNode[], name: string, parentId?: number): EntityNode | undefined {
    return entities.find((e) => e.name === name && (parentId === undefined || e.parent_id === parentId));
  }

  /** The real, direct child of one business's own real Chart of
   * Accounts root named `categoryName` ('Asset', 'Liability',
   * 'Equity', 'Income', 'Expense', or any further, real, named
   * category) - the one, real, 4-level requireEntity chain
   * (Businesses -> business -> Chart of Accounts -> category)
   * repeated throughout this file, now named once. */
  function coaCategoryRoot(business: BusinessName, categoryName: string): TypedNode<'RootName'> {
    const businessesRoot = db.requireEntity('Businesses', db.typeRootName);
    const businessEntity = db.requireEntity(business, db.typeBusinessName, businessesRoot);
    const coaRoot = db.requireEntity('Chart of Accounts', db.typeChartOfAccountsRootName, businessEntity);
    return db.requireEntity(categoryName, db.typeRootName, coaRoot);
  }

  /** Runs `fn` with this one business as the real, current session
   * context - for the small number of functions (setItemLocationLevels
   * and similar) that read Session.Business/Session.UserId/Session.Ledger
   * directly rather than taking them as explicit parameters. Replaces
   * the file-wide withMyBusinessSession(admin) helper this test suite
   * used to share - every test now runs this against its own, fresh
   * business instead. */
  function withBusinessSession<T>(biz: BusinessFixture, fn: () => T): T {
    const businessEntity = db.requireEntity(biz.business, db.typeBusinessName, db.requireEntity('Businesses', db.typeRootName));
    return runInSessionContext({ userId, business: { id: businessEntity.id, name: biz.business }, ledger: biz.actualLedger }, fn);
  }

  return {
    userId,
    uniqueName,
    uniqueSuffix,
    freshBusiness,
    freshLocation,
    freshItem,
    freshHierarchyValue,
    getAccountBalance,
    findChild,
    findByName,
    coaCategoryRoot,
    withBusinessSession,
  };
}

export type Fixtures = ReturnType<typeof makeFixtures>;
