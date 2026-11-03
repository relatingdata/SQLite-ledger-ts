// The real, live, production dispatch table for the new ASCII-CSV
// frontend<->backend call protocol, per direct instruction: no JSON
// anywhere on this path, no per-screen Express route, no separate
// "api_function" name distinct from the screen itself — a screen's own
// name IS the backend call. Each entry here is a plain function keyed by
// that exact screen name, looked up with an ordinary object-property
// read (`BACKEND_FUNCTIONS[screenName]`) — never `eval`: an unrecognized
// or malicious name simply fails the lookup instead of running as code.
//
// This file currently covers one real, fully-verified screen ("Create
// Business") as the first proven slice of a larger, tracked rollout
// (see the plan file) converting the rest of the app's ~24 Express route
// files off this same JSON/per-path-routing pattern, one function at a
// time.
import { createBusiness, asBusinessName, asUserId, ValidationError, type ReportingFrequency } from './db.js';
import { provisionBusinessAdminUser, type AuthenticatedUser } from './auth.js';

export class CallError extends Error {
  constructor(
    public status: number,
    message: string
  ) {
    super(message);
  }
}

function requireGlobalRole(user: AuthenticatedUser | undefined, ...roles: string[]): AuthenticatedUser {
  if (!user) throw new CallError(401, 'Not logged in.');
  if (!user.roles.some((r) => roles.includes(r))) throw new CallError(403, `Requires one of: ${roles.join(', ')} (globally).`);
  return user;
}

const ENTITY_STRUCTURES = ['sole_trader', 'partnership', 'llc', 'unlimited_liability', 'publicly_traded'] as const;
const REPORTING_FREQUENCIES = ['annual', 'biannual', 'quarterly', 'monthly'] as const;

export type BackendCall = (values: string[], user: AuthenticatedUser | undefined) => unknown;

// Positional args, in this exact order:
// [0] businessName, [1] financialYearLabel, [2] coaPrototype, [3]
// secondaryCurrencies ('|'-joined), [4] entityStructure, [5]
// partnerNames ('|'-joined), [6] financialYearStart, [7]
// reportingFrequency. Any trailing arg may be '' for "not provided".
//
// Creating a business is the one, real, deliberately narrow operation
// Business Admin must never reach - see
// docs/business-admin-role-and-enforcement-design.md - hence
// requireGlobalRole, not an ordinary per-business role check.
export const BACKEND_FUNCTIONS: Record<string, BackendCall> = {
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
      return { ...result, businessAdmin };
    } catch (err) {
      if (err instanceof ValidationError) throw new CallError(409, err.message);
      throw err;
    }
  },
};

export function callBackendFunction(screenName: string, values: string[], user: AuthenticatedUser | undefined): unknown {
  const fn = BACKEND_FUNCTIONS[screenName];
  if (!fn) throw new CallError(404, `No real backend function named "${screenName}".`);
  return fn(values, user);
}
