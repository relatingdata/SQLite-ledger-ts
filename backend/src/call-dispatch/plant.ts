// New (not converted from any old route): Plant and Skill, built for the
// Manufacturing/Project Builder tutorials' Recipe-capable BOM. See
// docs/pm-project-builder.md.
import { asBusinessName, asLedgerName, asAccountName, asUserId, ValidationError, NotFoundError, createPlantItem, getPlantItem, listPlant, ensureSkill, listSkills, tagSkill, untagSkill, getSkills } from '../db.js';
import { clockPlantIn, clockPlantOut, getOpenPlantClock } from '../db-journal.js';
import { CallError, requireAuth, requireRole, row, table, type BackendCall } from '../call-dispatch.js';

export const plantFunctions: Record<string, BackendCall> = {
  // Positional args: [0] name, [1] business, [2] hourlyRateMinor,
  // [3] ownedOrHired ('Owned'|'Hired'), [4] hireVendor?.
  createPlantItem: (v, user) => {
    const u = requireRole(user, 'Administrator', 'Bookkeeper');
    const [name, business, hourlyRateMinorRaw, ownedOrHiredRaw, hireVendor] = v;
    if (!name || !business || !hourlyRateMinorRaw || !ownedOrHiredRaw) {
      throw new CallError(400, 'name, business, hourlyRateMinor and ownedOrHired are all required.');
    }
    if (ownedOrHiredRaw !== 'Owned' && ownedOrHiredRaw !== 'Hired') {
      throw new CallError(400, `ownedOrHired must be Owned or Hired — got "${ownedOrHiredRaw}".`);
    }
    try {
      createPlantItem(name, asBusinessName(business), Number(hourlyRateMinorRaw), ownedOrHiredRaw, asUserId(u.id), hireVendor || undefined);
      return row();
    } catch (e) {
      if (e instanceof ValidationError) throw new CallError(400, e.message);
      throw e;
    }
  },
  // Positional args: [0] business.
  listPlant: (v, user) => {
    requireAuth(user);
    const [business] = v;
    if (!business) throw new CallError(400, 'business is required.');
    return table(['name'], listPlant(asBusinessName(business)).map((name) => ({ name })));
  },
  // Positional args: [0] name.
  getPlantItem: (v, user) => {
    requireAuth(user);
    const [name] = v;
    if (!name) throw new CallError(400, 'name is required.');
    const plant = getPlantItem(name);
    if (!plant) return row();
    return row(plant.name, String(plant.hourlyRateMinor), plant.ownedOrHired, plant.hireVendor ?? '');
  },
  // Positional args: [0] plantName, [1] projectExpenseAccount, [2] business, [3] ledger.
  clockPlantIn: (v, user) => {
    const u = requireAuth(user);
    const [plantName, projectExpenseAccount, business, ledger] = v;
    if (!plantName || !projectExpenseAccount || !business || !ledger) throw new CallError(400, 'plantName, projectExpenseAccount, business and ledger are all required.');
    try {
      const result = clockPlantIn(plantName, asAccountName(projectExpenseAccount), asBusinessName(business), asLedgerName(ledger), asUserId(u.id));
      return row(result.plant, result.po_reference, result.project_expense_account, result.clocked_in_at);
    } catch (e) {
      if (e instanceof ValidationError || e instanceof NotFoundError) throw new CallError(400, e.message);
      throw e;
    }
  },
  // Positional args: [0] plantName, [1] business, [2] ledger.
  clockPlantOut: (v, user) => {
    const u = requireAuth(user);
    const [plantName, business, ledger] = v;
    if (!plantName || !business || !ledger) throw new CallError(400, 'plantName, business and ledger are all required.');
    try {
      clockPlantOut(plantName, asBusinessName(business), asLedgerName(ledger), asUserId(u.id));
      return row();
    } catch (e) {
      if (e instanceof ValidationError) throw new CallError(400, e.message);
      throw e;
    }
  },
  // Positional args: [0] plantName. Empty row means "no open clock",
  // same convention as getOpenProjectClock.
  getOpenPlantClock: (v, user) => {
    requireAuth(user);
    const [plantName] = v;
    if (!plantName) throw new CallError(400, 'plantName is required.');
    const result = getOpenPlantClock(plantName);
    if (!result) return row();
    return row(result.plant, result.po_reference, result.project_expense_account, result.clocked_in_at);
  },
  // Positional args: [0] skillName. Idempotent — creates the skill under
  // the global Skills root if it doesn't already exist.
  ensureSkill: (v, user) => {
    const u = requireRole(user, 'Administrator', 'Bookkeeper');
    const [skillName] = v;
    if (!skillName) throw new CallError(400, 'skillName is required.');
    ensureSkill(skillName, asUserId(u.id));
    return row();
  },
  listSkills: (v, user) => {
    requireAuth(user);
    return table(['name'], listSkills().map((name) => ({ name })));
  },
  // Positional args: [0] contactName, [1] skillName, [2] rateMinorPerHour.
  tagSkill: (v, user) => {
    const u = requireRole(user, 'Administrator', 'Bookkeeper');
    const [contactName, skillName, rateRaw] = v;
    if (!contactName || !skillName || !rateRaw) throw new CallError(400, 'contactName, skillName and rateMinorPerHour are all required.');
    try {
      tagSkill(contactName, skillName, Number(rateRaw), asUserId(u.id));
      return row();
    } catch (e) {
      if (e instanceof ValidationError) throw new CallError(400, e.message);
      throw e;
    }
  },
  // Positional args: [0] contactName, [1] skillName.
  untagSkill: (v, user) => {
    const u = requireRole(user, 'Administrator', 'Bookkeeper');
    const [contactName, skillName] = v;
    if (!contactName || !skillName) throw new CallError(400, 'contactName and skillName are both required.');
    untagSkill(contactName, skillName, asUserId(u.id));
    return row();
  },
  // Positional args: [0] contactName.
  getSkills: (v, user) => {
    requireAuth(user);
    const [contactName] = v;
    if (!contactName) throw new CallError(400, 'contactName is required.');
    return table(['skill', 'rateMinorPerHour'], getSkills(contactName).map((s) => ({ skill: s.skill, rateMinorPerHour: String(s.rateMinorPerHour) })));
  },
};
