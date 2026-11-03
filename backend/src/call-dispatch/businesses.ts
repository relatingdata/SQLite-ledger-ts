// Converted from routes/businesses.ts, one function at a time. See
// ../call-dispatch.ts for the shared types/helpers (CallError, row,
// table, requireGlobalRole/requireRole/requireAuth). The whole router was
// mounted behind a blanket requireAuth in server.ts — every function here
// that the old route left otherwise ungated still calls requireAuth
// itself, matching that same baseline.
import {
  createBusiness,
  asBusinessName,
  asUserId,
  ValidationError,
  type ReportingFrequency,
  getBusinesses,
  getBusinessTypes,
  getLedgers,
  getActiveLedger,
  getProfitCenters,
  createProfitCenter,
  getChartOfAccountsPrototype,
  getReportingPeriods,
  saveBusinessTypeAnswers,
  nominateBankAccount,
  getNominatedBankAccounts,
  getBusinessConfigurationReport,
  buildBankCurrencyStructure,
  typeAssetAccountName,
  typeEquityAccountName,
} from '../db.js';
import { provisionBusinessAdminUser } from '../auth.js';
import { CallError, decodeRecordList, encodeRecordList, encodeStringList, requireAuth, requireGlobalRole, requireRole, row, table, type BackendCall } from '../call-dispatch.js';

const ENTITY_STRUCTURES = ['sole_trader', 'partnership', 'llc', 'unlimited_liability', 'publicly_traded'] as const;
const REPORTING_FREQUENCIES = ['annual', 'biannual', 'quarterly', 'monthly'] as const;

export const businessesFunctions: Record<string, BackendCall> = {
  // Positional args: [0] businessName, [1] financialYearLabel, [2]
  // coaPrototype, [3] secondaryCurrencies ('|'-joined), [4]
  // entityStructure, [5] partnerNames ('|'-joined), [6]
  // financialYearStart, [7] reportingFrequency. Any trailing arg may be
  // '' for "not provided".
  //
  // Creating a business is the one, real, deliberately narrow operation
  // Business Admin must never reach - see
  // docs/business-admin-role-and-enforcement-design.md - hence
  // requireGlobalRole, not an ordinary per-business role check.
  'Create Business': (v, user) => {
    const admin = requireGlobalRole(user, 'Administrator');
    const [businessNameRaw, financialYearLabel, coaPrototype, secondaryCurrenciesRaw, entityStructureRaw, partnerNamesRaw, financialYearStart, reportingFrequencyRaw] = v;
    if (!businessNameRaw || !financialYearLabel) throw new CallError(400, 'businessName and financialYearLabel are both required.');
    const entityStructure = entityStructureRaw && (ENTITY_STRUCTURES as readonly string[]).includes(entityStructureRaw) ? (entityStructureRaw as (typeof ENTITY_STRUCTURES)[number]) : undefined;
    const reportingFrequency =
      reportingFrequencyRaw && (REPORTING_FREQUENCIES as readonly string[]).includes(reportingFrequencyRaw) ? (reportingFrequencyRaw as (typeof REPORTING_FREQUENCIES)[number]) : undefined;
    const secondaryCurrencies = secondaryCurrenciesRaw ? secondaryCurrenciesRaw.split('|').filter(Boolean) : undefined;
    const partnerNames = partnerNamesRaw ? partnerNamesRaw.split('|').filter(Boolean) : undefined;
    try {
      const businessName = asBusinessName(businessNameRaw);
      const result = createBusiness(
        businessName,
        financialYearLabel,
        asUserId(admin.id),
        coaPrototype || undefined,
        secondaryCurrencies,
        entityStructure,
        partnerNames,
        financialYearStart || undefined,
        reportingFrequency as ReportingFrequency | undefined
      );
      const businessAdmin = provisionBusinessAdminUser(businessName, asUserId(admin.id));
      return row(result.business, result.actualLedger, result.budgetLedger, businessAdmin.username, businessAdmin.password);
    } catch (err) {
      if (err instanceof ValidationError) throw new CallError(409, err.message);
      throw err;
    }
  },

  // No args.
  getBusinesses: (v, user) => {
    requireAuth(user);
    return table(['id', 'name'], getBusinesses());
  },
  // No args. Every real business type with its own real questions — the
  // real, database-driven source for the new-business form's type
  // selector.
  getBusinessTypes: (v, user) => {
    requireAuth(user);
    return table(
      ['name', 'questions'],
      getBusinessTypes().map((t) => ({ name: t.name, questions: encodeStringList(t.questions) }))
    );
  },
  // Positional args: [0] businessName, [1] answers — a genuine, caller-
  // variable-shaped Record<string,string>, encoded as a flat (key,value)
  // record list via encodeRecordList/decodeRecordList (the same codec
  // used elsewhere for a dynamically-keyed map, e.g. i18n.ts's
  // getLocalizedText for the reverse direction).
  saveBusinessTypeAnswers: (v, user) => {
    const admin = requireRole(user, 'Administrator');
    const [business, answersEncoded] = v;
    if (!business) throw new CallError(400, 'businessName is required.');
    const answers = Object.fromEntries(decodeRecordList(['key', 'value'], answersEncoded ?? '').map((r) => [r.key, r.value]));
    saveBusinessTypeAnswers(asBusinessName(business), answers, asUserId(admin.id));
    return row();
  },
  // Positional args: [0] businessName.
  getLedgers: (v, user) => {
    requireAuth(user);
    const [business] = v;
    if (!business) throw new CallError(400, 'businessName is required.');
    return table(['id', 'name'], getLedgers(asBusinessName(business)));
  },
  // Positional args: [0] businessName.
  getActiveLedger: (v, user) => {
    requireAuth(user);
    const [business] = v;
    if (!business) throw new CallError(400, 'businessName is required.');
    return row(getActiveLedger(asBusinessName(business)) ?? '');
  },
  // Positional args: [0] businessName.
  getProfitCenters: (v, user) => {
    requireAuth(user);
    const [business] = v;
    if (!business) throw new CallError(400, 'businessName is required.');
    return table(['id', 'name'], getProfitCenters(asBusinessName(business)));
  },
  // Positional args: [0] businessName, [1] profitCenterName.
  createProfitCenter: (v, user) => {
    const admin = requireRole(user, 'Administrator', 'Bookkeeper');
    const [business, profitCenterName] = v;
    if (!business || !profitCenterName) throw new CallError(400, 'businessName and profitCenterName are both required.');
    try {
      const result = createProfitCenter(asBusinessName(business), profitCenterName, asUserId(admin.id));
      return row(result.id, result.name);
    } catch (err) {
      if (err instanceof ValidationError) throw new CallError(409, err.message);
      throw err;
    }
  },
  // Positional args: [0] language.
  getCoaPrototypeAccounts: (v, user) => {
    requireAuth(user);
    const [language] = v;
    if (!language) throw new CallError(400, 'language is required.');
    return table(['name'], getChartOfAccountsPrototype(language).map((name) => ({ name })));
  },
  // Positional args: [0] businessName, [1] asOf (optional).
  getReportingPeriods: (v, user) => {
    requireAuth(user);
    const [business, asOf] = v;
    if (!business) throw new CallError(400, 'businessName is required.');
    return table(['label', 'startDate', 'endDate'], getReportingPeriods(business, asOf || undefined));
  },
  // Positional args: [0] businessName, [1] bankAccountName,
  // [2] routingDetail, [3] accountNumber.
  nominateBankAccount: (v, user) => {
    const admin = requireRole(user, 'Administrator');
    const [business, bankAccountName, routingDetail, accountNumber] = v;
    if (!business || !bankAccountName || routingDetail === undefined || accountNumber === undefined) {
      throw new CallError(400, 'businessName, bankAccountName, routingDetail and accountNumber are all required.');
    }
    try {
      const result = nominateBankAccount(asBusinessName(business), bankAccountName, routingDetail, accountNumber, asUserId(admin.id));
      return row(result.id);
    } catch (err) {
      if (err instanceof ValidationError) throw new CallError(400, err.message);
      throw err;
    }
  },
  // Positional args: [0] businessName. No live frontend caller (already
  // commented out as unused in api.ts) — built anyway for completeness.
  getNominatedBankAccounts: (v, user) => {
    requireRole(user, 'Administrator');
    const [business] = v;
    if (!business) throw new CallError(400, 'businessName is required.');
    return table(['name', 'routingDetail', 'accountNumber'], getNominatedBankAccounts(asBusinessName(business)));
  },
  // Positional args: [0] businessName. The real result nests SIX separate
  // arrays (addresses, phones, ownerOrPartners, bankAccounts,
  // secondaryCurrencies, hierarchies — itself one further level nested,
  // since each hierarchy carries its own values[] — plus locations,
  // categories, notes). Each array-of-records uses encodeRecordList;
  // each plain string[] uses encodeStringList; hierarchies nests
  // encodeStringList inside encodeRecordList (the same codec applied
  // recursively, same precedent as journal.ts's encodeRecordList itself
  // being built from encodeStringList).
  getBusinessConfigurationReport: (v, user) => {
    requireRole(user, 'Administrator', 'Bookkeeper');
    const [business] = v;
    if (!business) throw new CallError(400, 'businessName is required.');
    try {
      const r = getBusinessConfigurationReport(asBusinessName(business));
      return row(
        r.businessName,
        encodeRecordList(['address_type', 'address_line1', 'city'], r.addresses),
        encodeRecordList(['phone_type', 'phone'], r.phones),
        encodeStringList(r.ownerOrPartners),
        encodeRecordList(['name', 'routingDetail', 'accountNumber'], r.bankAccounts),
        r.homeCurrency ?? '',
        encodeStringList(r.secondaryCurrencies),
        encodeRecordList(['grouping', 'values'], r.hierarchies.map((h) => ({ grouping: h.grouping, values: encodeStringList(h.values) }))),
        encodeRecordList(['name', 'city', 'locationType'], r.locations),
        encodeStringList(r.categories),
        encodeRecordList(['name', 'text'], r.notes),
        r.chartOfAccountsPrototype ?? ''
      );
    } catch (err) {
      if (err instanceof ValidationError) throw new CallError(404, err.message);
      throw err;
    }
  },
  // Positional args: [0] businessName, [1] headerName, [2] leafKind
  // ('asset'/'equity'), [3] selections (encodeRecordList-encoded
  // bankAccountName/currency pairs), [4] homeCurrency.
  buildBankCurrencyStructure: (v, user) => {
    const admin = requireRole(user, 'Administrator');
    const [business, headerName, leafKind, selectionsEncoded, homeCurrency] = v;
    if (!business || !headerName || (leafKind !== 'asset' && leafKind !== 'equity') || !selectionsEncoded || !homeCurrency) {
      throw new CallError(400, 'businessName, headerName, leafKind, selections and homeCurrency are all required.');
    }
    const selections = decodeRecordList(['bankAccountName', 'currency'], selectionsEncoded) as { bankAccountName: string; currency: string }[];
    if (selections.length === 0) throw new CallError(400, 'selections must contain at least one entry.');
    try {
      const leafType = leafKind === 'asset' ? typeAssetAccountName : typeEquityAccountName;
      buildBankCurrencyStructure(asBusinessName(business), headerName, leafType, selections, asUserId(admin.id), homeCurrency);
      return row();
    } catch (err) {
      if (err instanceof ValidationError) throw new CallError(400, err.message);
      throw err;
    }
  },
};
