# Translations

## The rule

Every text a person reads is defined in every language, English
included:

- the menus: each section and link label (`getMenuTree`);
- the screens: each title, heading, field label, placeholder and help
  text (`Title`, `Text`, `Label`, `Placeholder`, `Description`, `Intro`,
  `Empty` and `Summary` in `application/application.entities`, and the
  `label` and `placeholder` of each form field a screen defines);
- the frontend's own words: every literal in `translations.current['…']`
  and `t('…')` in `frontend/src`, generated pages included.

Data that people name themselves (an account, an item, an employee) is
not in this rule: it is shown as named, and translated only when someone
adds a translation for it.

`make check-translations` (`backend/scripts/check-translations.ts`), a
manual gate, checks the rule.

A text in the code is spelled exactly as its concept: the Vocabulary
refuses two words that differ only in case (`createEntityRaw`), so
`'Reorder level'` in a page must not be written `'Reorder Level'`.

## The model

A text is a **concept**: an entity under `Application` › `Vocabulary`,
named by its English text. A **translation** is an entity under the
language (`Application` › `Languages` › `German`), named by the
translated text, whose `relation_id` is the concept (*The Entity
Model*, "What `relation_id` is used for"). `setTranslation(concept, language, text)` makes
or renames it. Two concepts may have the same word in one language
(Italian `Attivo` for both `Asset` and `Active`): names under a
language may repeat, the one exception to sibling uniqueness
(`entities_name_unique`, `createEntityRaw`, and the Gleam engine's
`validate_write`).

English has three roles:

1. **The implementation language.** A concept's name is its English
   text, and the code names texts in English
   (`translations.current['Continue'] ?? 'Continue'`).
2. **A translation like any other.** Every concept has an entry under
   `English`; `schema/00-core.sql` creates one for each of its 418
   concepts, spelled as the key.
3. **The fallback** where a translation is missing, in two places: the
   `localized_text` view gives a concept with no translation in a
   language its English name (`COALESCE(tr.name, e.name)`), and every
   page shows the English literal when the map has no entry (`?? 'X'`).

So a missing translation is never visible on a screen; only
`check-translations` shows it. It reads the translation entities
themselves, not `localized_text`.

A chart of accounts in another language (German CoA, French CoA, …) is
separate from this: its accounts are entities named in that language,
which may or may not have translations, and may name the same thing
differently for a business type.

## Where the translations come from

- `schema/00-core.sql`: the English entry of each of its concepts.
  Creating a Vocabulary word creates its English entry too.
- `db-seed.ts`: chart-of-accounts names, the days of the week and some
  screen words.
- `shared-fixtures/translations-steps.csv`, loaded by `make
  load-translations-api` (or `-ui`): the translations people wrote, and
  two included files written by Claude, in which every translation ends
  in ` (C)` so a person can find and review it:
  - `translations-claude-new.csv`, first: the concepts for texts that
    had none, with their translations. A translation a person writes
    later in `translations-steps.csv` replaces one of these.
  - `translations-claude-existing.csv`, last: the languages that
    existing concepts were missing.

A text not yet translated with confidence has `To be Translated` in
that language's words in place of a translation (`Zu übersetzen:
home`, `À traduire: Every`, …); `To be Translated` is a concept with a
translation in every language.

## The check

`check-translations` builds a database in a temporary file, loads every
translation the project defines (the seed in `db-seed.ts`, then
`shared-fixtures/translations-steps.csv` through the step runner's API
path), collects the texts above, and for each language lists every text
with no translation entity. A text that is not a Vocabulary concept is
missing in every language, English included, since nothing can
translate it. The summary is printed per language and kind; the full
list goes to `backend/data/missing-translations.csv` (language, kind,
reason, where, text). It takes about 15 seconds.

## Current state

`make check-translations` passes: 908 texts, each defined in every
language. Two texts are marked To be Translated in every language,
`home` and `Every`: each is a fragment whose sense depends on the words
around it on its screen.

About 230 of the translations people wrote, in German, French, Danish
and Italian, carry over filler words from their English text ("A real
employee can genuinely work a real, scheduled shift…" as "Ein realer
Mitarbeiter kann tatsächlich eine reale, geplante Schicht…"). The cure
is to rewrite the English texts first, since each translation is keyed
by its English text, then their translations.

Text direction is stored under the language like a translation:
`Arabic — Text Direction` and `Hebrew — Text Direction` under each
language, related to `RTL`. `check-translations` does not count them.
