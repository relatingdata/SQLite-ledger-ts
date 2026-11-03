// Converted from routes/businesses.ts, one function at a time. See
// ../call-dispatch.ts for the shared types/helpers (CallError, row,
// table, requireGlobalRole/requireRole/requireAuth).
import { createBusiness, asBusinessName, asUserId, ValidationError, type ReportingFrequency } from '../db.js';
import { provisionBusinessAdminUser } from '../auth.js';
import { CallError, requireGlobalRole, row, type BackendCall } from '../call-dispatch.js';

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
};
