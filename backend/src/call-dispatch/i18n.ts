// Converted from routes/i18n.ts. GET /languages, GET /language-direction/:,
// GET /default-language and GET /text/:language are deliberately public —
// the login screen needs translated labels, text direction, and the
// default language before anyone has authenticated — so these call no
// requireAuth/requireRole at all, matching the old route exactly.
import {
  getLanguages,
  getLocalizedText,
  setTranslation,
  getDefaultLanguage,
  setDefaultLanguage,
  getVocabularyAlternates,
  getConceptsWithAlternates,
  getVocabularyWords,
  setVocabularyPreference,
  deleteVocabularyPreference,
  getLanguageDirection,
  setLanguageDirection,
  deleteTranslationConcept,
  ValidationError,
  NotFoundError,
  asUserId,
  ensureVocabularyAlternate,
} from '../db.js';
import { Entity } from '../primitives.js';
import { CallError, encodeStringList, requireAuth, requireRole, row, table, type BackendCall } from '../call-dispatch.js';

export const i18nFunctions: Record<string, BackendCall> = {
  // No args. Public.
  getLanguages: () => table(['id', 'name'], getLanguages()),
  // Positional args: [0] language. Public.
  getLanguageDirection: (v) => {
    const [language] = v;
    if (!language) throw new CallError(400, 'language is required.');
    return row(getLanguageDirection(language) ?? 'LTR');
  },
  // Positional args: [0] language, [1] direction ('LTR'/'RTL'/'').
  // Administrator only — NOT Bookkeeper, matching the old route's own
  // narrower gate.
  setLanguageDirection: (v, user) => {
    const admin = requireRole(user, 'Administrator');
    const [language, direction] = v;
    if (!language) throw new CallError(400, 'language is required.');
    if (direction !== 'LTR' && direction !== 'RTL' && direction !== '') throw new CallError(400, 'direction must be LTR, RTL, or empty.');
    setLanguageDirection(language, direction === '' ? null : direction, asUserId(admin.id));
    return row();
  },
  // No args. Public.
  getDefaultLanguage: () => row(getDefaultLanguage() ?? ''),
  // Positional args: [0] language. Administrator only.
  setDefaultLanguage: (v, user) => {
    const admin = requireRole(user, 'Administrator');
    const [language] = v;
    if (!language) throw new CallError(400, 'language is required.');
    try {
      setDefaultLanguage(language, asUserId(admin.id));
      return row();
    } catch (err) {
      if (err instanceof ValidationError) throw new CallError(409, err.message);
      throw err;
    }
  },
  // Positional args: [0] language, [1] business (optional). Public.
  // The real result is a Record<string,string> (every localized label) —
  // flattened into one (entity, text) table, same technique as
  // getHierarchyAssignments.
  getLocalizedText: (v, user) => {
    const [language, business] = v;
    if (!language) throw new CallError(400, 'language is required.');
    const map = getLocalizedText(language, { businessName: business || undefined, userId: user?.id });
    return table(
      ['entity', 'text'],
      Object.entries(map).map(([entity, text]) => ({ entity, text }))
    );
  },
  // Positional args: [0] word. Public. No live frontend caller (already
  // commented out as unused in api.ts) — built anyway for a complete
  // backend surface.
  getVocabularyAlternates: (v) => {
    const [word] = v;
    if (!word) throw new CallError(400, 'word is required.');
    return table(['name'], getVocabularyAlternates(word).map((name) => ({ name })));
  },
  // No args. The real result's alternates: string[] (a genuine nested
  // list per concept) reuses the shared encodeStringList/decodeStringList
  // codec — one row per concept, one encoded column.
  getConceptsWithAlternates: (v, user) => {
    requireAuth(user);
    const concepts = getConceptsWithAlternates();
    return table(
      ['headerAccountName', 'alternates', 'defaultAlternate'],
      concepts.map((c) => ({ headerAccountName: c.headerAccountName, alternates: encodeStringList(c.alternates), defaultAlternate: c.defaultAlternate }))
    );
  },
  // No args. The real result nests one level (each word carries its own
  // translations: Record<string,string>) — flattened into one
  // (word, language, text) table with a sentinel row (language='') for a
  // word with zero translations yet, since the frontend reads word names
  // independent of their translation count (confirmed via grep of
  // setup/translations/+page.svelte), same technique as
  // departments.ts's getOrgChartStructure.
  getVocabularyWords: (v, user) => {
    requireAuth(user);
    const words = getVocabularyWords();
    const rows: { word: string; language: string; text: string }[] = [];
    for (const w of words) {
      const entries = Object.entries(w.translations);
      if (entries.length === 0) rows.push({ word: w.name, language: '', text: '' });
      else for (const [language, text] of entries) rows.push({ word: w.name, language, text });
    }
    return table(['word', 'language', 'text'], rows);
  },
  // Positional args: [0] word.
  deleteVocabularyWord: (v, user) => {
    const admin = requireRole(user, 'Administrator', 'Bookkeeper');
    const [word] = v;
    if (!word) throw new CallError(400, 'word is required.');
    try {
      deleteTranslationConcept(word, asUserId(admin.id));
      return row();
    } catch (err) {
      if (err instanceof ValidationError) throw new CallError(409, err.message);
      if (err instanceof NotFoundError) throw new CallError(404, err.message);
      throw err;
    }
  },
  // Positional args: [0] conceptName, [1] scope ('business'/'user'),
  // [2] scopeId, [3] preferredAlternateName. Replicates the old route's
  // own, real (not db.ts's) logic for a genuinely new name: entity reads
  // go through primitives.ts's Entity object (entityDriver underneath),
  // per the approved entity-storage-isolation plan.
  setVocabularyPreference: (v, user) => {
    requireAuth(user);
    const [conceptName, scope, scopeIdRaw, preferredAlternateName] = v;
    if (!conceptName || (scope !== 'business' && scope !== 'user') || !scopeIdRaw || !preferredAlternateName) {
      throw new CallError(400, 'conceptName, scope, scopeId and preferredAlternateName are all required.');
    }
    const scopeId = Number(scopeIdRaw);
    try {
      const alreadyExists = Entity.get(preferredAlternateName) !== undefined;
      if (!alreadyExists) {
        if (scope !== 'business') throw new CallError(400, 'A genuinely new name can only be added for a real business, not a user preference alone.');
        const businessName = Entity.get(scopeId)?.name;
        if (!businessName) throw new CallError(400, 'No real business with that id.');
        ensureVocabularyAlternate(conceptName, preferredAlternateName, businessName, asUserId(1));
      }
      setVocabularyPreference(conceptName, scope, scopeId, preferredAlternateName);
      return row('true');
    } catch (err) {
      if (err instanceof CallError) throw err;
      if (err instanceof ValidationError) throw new CallError(400, err.message);
      throw err;
    }
  },
  // Positional args: [0] conceptName, [1] scope, [2] scopeId.
  deleteVocabularyPreference: (v, user) => {
    requireAuth(user);
    const [conceptName, scope, scopeIdRaw] = v;
    if (!conceptName || (scope !== 'business' && scope !== 'user') || !scopeIdRaw) {
      throw new CallError(400, 'conceptName, scope and scopeId are all required.');
    }
    deleteVocabularyPreference(conceptName, scope, Number(scopeIdRaw));
    return row('true');
  },
  // Positional args: [0] entity, [1] language, [2] text.
  setTranslation: (v, user) => {
    const u = requireAuth(user);
    const [entity, language, text] = v;
    if (!entity || !language || !text) throw new CallError(400, 'entity, language and text are all required.');
    setTranslation(entity, language, text, asUserId(u.id));
    return row();
  },
};
