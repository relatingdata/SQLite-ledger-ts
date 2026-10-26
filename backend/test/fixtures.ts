// Minimal library of test fixtures, each a thin wrapper around a real db.ts function.
// Full documentation: docs/pm-testing-unit.md ("The fixture framework").

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

// Handed in by the test file (never imported directly here) — see pm-testing-unit.md's
// DB-connection-ordering hazard.
export type DbModule = typeof import('../src/db.ts');

let counter = 0;
/** Collision-free suffix for test-owned names. */
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
  coaPrototype?: string | undefined;
  secondaryCurrencies?: string[];
  entityStructure?: Parameters<DbModule['createBusiness']>[5];
  partnerNames?: string[];
}

export function makeFixtures(db: DbModule) {
  const userId: UserId = db.asUserId(1);

  function freshBusiness(hint: string, opts: FreshBusinessOptions = {}): BusinessFixture {
    const name = db.asBusinessName(uniqueName(hint));
    const coaPrototype = 'coaPrototype' in opts ? opts.coaPrototype : 'English CoA';
    return db.createBusiness(name, opts.financialYearLabel ?? '2027-28', userId, coaPrototype, opts.secondaryCurrencies, opts.entityStructure, opts.partnerNames);
  }

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

  function freshDepartment(business: BusinessName, hint: string): { name: string; entity: TypedNode<'DepartmentEntityName'> } {
    const name = uniqueName(hint);
    const entity = db.createAndConfigureDepartment(business, name, userId);
    return { name, entity };
  }

  function freshEmployee(business: BusinessName, hint: string, placeOfEmployment: string): { name: string } {
    const name = uniqueName(hint);
    db.createEmployee(name, placeOfEmployment, userId);
    return { name };
  }

  function freshItem(business: BusinessName, hint: string): { itemName: ItemName } {
    const itemNameStr = uniqueName(hint);
    db.createItem(itemNameStr, 'Items', userId, business);
    return { itemName: db.asItemName(itemNameStr) };
  }

  function freshHierarchyValue(business: BusinessName, groupingName: string, valueHint: string): { groupingName: string; valueName: string } {
    const valueName = uniqueName(valueHint);
    db.ensureHierarchyGrouping(business, groupingName, userId);
    db.ensureHierarchyValue(business, groupingName, valueName, userId);
    return { groupingName, valueName };
  }

  // Prefer reading balance_minor/currency off a getEntityTree() node (via findByName/findChild)
  // when one is already in hand; use this only when the entity was found some other way.
  function getAccountBalance(entityId: number): { balance_minor: number; currency: string | null } | undefined {
    return db.db.prepare(`SELECT balance_minor, currency FROM account WHERE entity_id = ?`).get(entityId) as { balance_minor: number; currency: string | null } | undefined;
  }

  function findChild(entities: EntityNode[], parentId: number, name: string): EntityNode | undefined {
    return entities.find((e) => e.parent_id === parentId && e.name === name);
  }

  function findByName(entities: EntityNode[], name: string, parentId?: number): EntityNode | undefined {
    return entities.find((e) => e.name === name && (parentId === undefined || e.parent_id === parentId));
  }

  function coaCategoryRoot(business: BusinessName, categoryName: string): TypedNode<'RootName'> {
    const businessesRoot = db.requireEntity('Businesses', db.typeRootName);
    const businessEntity = db.requireEntity(business, db.typeBusinessName, businessesRoot);
    const coaRoot = db.requireEntity('Chart of Accounts', db.typeChartOfAccountsRootName, businessEntity);
    return db.requireEntity(categoryName, db.typeRootName, coaRoot);
  }

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
    freshDepartment,
    freshEmployee,
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
