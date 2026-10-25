import { Router } from 'express';
import { z } from 'zod';
import { getLanguages, getLocalizedText, setTranslation, getDefaultLanguage, setDefaultLanguage, getVocabularyAlternates, getConceptsWithAlternates, getVocabularyWords, setVocabularyPreference, deleteVocabularyPreference, getLanguageDirection, setLanguageDirection, deleteTranslationConcept, ValidationError, NotFoundError,
  asUserId, ensureVocabularyAlternate, db,
} from '../db.js';
import { requireAuth, requireRole } from '../auth-middleware.js';

export const i18nRouter = Router();

// Deliberately public — translations are UI label text, not sensitive
// data, and the login screen itself needs to show translated labels
// before a person has authenticated at all.
i18nRouter.get('/languages', (_req, res) => {
  res.json(getLanguages());
});

// Also, deliberately public - the login screen needs to know which
// direction to render in before anyone has authenticated at all.
i18nRouter.get('/language-direction/:language', (req, res) => {
  res.json({ direction: getLanguageDirection(req.params.language) ?? 'LTR' });
});

const setLanguageDirectionSchema = z.object({ direction: z.enum(['LTR', 'RTL']).nullable() });

i18nRouter.put('/language-direction/:language', requireRole('Administrator'), (req, res) => {
  const parsed = setLanguageDirectionSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  try {
    setLanguageDirection(req.params.language, parsed.data.direction, asUserId(req.user!.id));
    res.status(204).end();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not set this language\'s text direction.' });
  }
});

// Also public, same reasoning as /languages and /text — the login
// screen needs to know what to default to before anyone has
// authenticated at all.
i18nRouter.get('/default-language', (_req, res) => {
  res.json({ language: getDefaultLanguage() });
});

const defaultLanguageSchema = z.object({ language: z.string().min(1) });

i18nRouter.put('/default-language', requireAuth, requireRole('Administrator'), (req, res) => {
  const parsed = defaultLanguageSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  try {
    setDefaultLanguage(parsed.data.language, asUserId(req.user!.id));
    res.status(204).end();
  } catch (err) {
    if (err instanceof ValidationError) return res.status(409).json({ error: err.message });
    console.error(err);
    res.status(500).json({ error: 'Could not set the default language.' });
  }
});

i18nRouter.get('/text/:language', (req, res) => {
  const businessName = typeof req.query.business === 'string' ? req.query.business : undefined;
  res.json(getLocalizedText(req.params.language, { businessName, userId: req.user?.id }));
});

i18nRouter.get('/vocabulary-alternates/:word', (req, res) => {
  res.json(getVocabularyAlternates(req.params.word));
});

i18nRouter.get('/concepts-with-alternates', requireAuth, (_req, res) => {
  res.json(getConceptsWithAlternates());
});

i18nRouter.get('/vocabulary-words', requireAuth, (_req, res) => {
  res.json(getVocabularyWords());
});

/** Deletes a real, named Vocabulary word — name-based, like every other
 * route here, since getVocabularyWords' own VocabularyWord shape carries
 * no entity id. Refuses while the word is still genuinely translated
 * anywhere (see getTranslationsReferencing/deleteTranslationConcept in
 * db.ts), or while it's become a real hierarchy/vocabulary-alternate
 * target (revokeEntity's own incoming-links guard). */
i18nRouter.delete('/vocabulary-words/:word', requireRole('Administrator', 'Bookkeeper'), (req, res) => {
  try {
    deleteTranslationConcept(req.params.word, asUserId(req.user!.id));
    res.status(204).end();
  } catch (err) {
    if (err instanceof ValidationError) return res.status(409).json({ error: err.message });
    if (err instanceof NotFoundError) return res.status(404).json({ error: err.message });
    console.error(err);
    res.status(500).json({ error: 'Could not delete vocabulary word.' });
  }
});

const vocabularyPreferenceSchema = z.object({
  conceptName: z.string().min(1),
  scope: z.enum(['business', 'user']),
  scopeId: z.number(),
  preferredAlternateName: z.string().min(1),
});

i18nRouter.post('/vocabulary-preference', requireAuth, (req, res) => {
  const parsed = vocabularyPreferenceSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  try {
    const { conceptName, scope, scopeId, preferredAlternateName } = parsed.data;
    // Per direct instruction: a word stays in the real, global
    // Vocabulary by default. Only the moment a genuinely new name is
    // chosen - not yet a known entity at all - does it get a real,
    // local, business-owned Vocabulary word, and even then only after
    // checking whether a real, global synonym with that exact text
    // already exists.
    const alreadyExists = db.prepare(`SELECT 1 FROM current_entities WHERE name = ?`).get(preferredAlternateName);
    if (!alreadyExists) {
      if (scope !== 'business') return res.status(400).json({ error: 'A genuinely new name can only be added for a real business, not a user preference alone.' });
      const businessName = (db.prepare(`SELECT name FROM current_entities WHERE id = ?`).get(scopeId) as { name: string } | undefined)?.name;
      if (!businessName) return res.status(400).json({ error: 'No real business with that id.' });
      ensureVocabularyAlternate(conceptName, preferredAlternateName, businessName, asUserId(1));
    }
    setVocabularyPreference(conceptName, scope, scopeId, preferredAlternateName);
    res.json({ ok: true });
  } catch (err) {
    if (err instanceof ValidationError) return res.status(400).json({ error: err.message });
    console.error(err);
    res.status(500).json({ error: 'Could not save vocabulary preference.' });
  }
});

const deleteVocabularyPreferenceSchema = z.object({
  conceptName: z.string().min(1),
  scope: z.enum(['business', 'user']),
  scopeId: z.number(),
});

i18nRouter.delete('/vocabulary-preference', requireAuth, (req, res) => {
  const parsed = deleteVocabularyPreferenceSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  deleteVocabularyPreference(parsed.data.conceptName, parsed.data.scope, parsed.data.scopeId);
  res.json({ ok: true });
});

const translationSchema = z.object({
  entity: z.string().min(1),
  language: z.string().min(1),
  text: z.string().min(1),
});

i18nRouter.post('/translations', requireAuth, (req, res) => {
  const parsed = translationSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  try {
    setTranslation(parsed.data.entity, parsed.data.language, parsed.data.text);
    res.status(204).end();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not save translation.' });
  }
});
