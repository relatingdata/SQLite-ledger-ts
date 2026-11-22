# Translations

## The rule

Every text a person reads is defined in every language, English
included:

- the menus: each section and link label (`getMenuTree`);
- the screens: each title, heading, field label, placeholder and help
  text (`Title`, `Text`, `Label`, `Placeholder`, `Description`, `Intro`,
  `Empty` and `Summary` in `application/application.entities`);
- the frontend's own words: every literal in `translations.current['…']`
  and `t('…')` in `frontend/src`, generated pages included.

Data that people name themselves (an account, an item, an employee) is
not in this rule: it is shown as named, and translated only when someone
adds a translation for it.

`make check-translations` (`backend/scripts/check-translations.ts`)
checks the rule. It is not yet a manual gate: it fails today ("Current
state", below), and it joins `MANUAL_GATES` once it passes.

## The model

A text is a **concept**: an entity under `Application` › `Vocabulary`,
named by its English text. A **translation** is an entity under the
language (`Application` › `Languages` › `German`), named by the
translated text, whose `relation_id` is the concept (*The Entity
Model*, "What `relation_id` is used for"). `setTranslation(concept, language, text)` makes
or renames it.

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

From `make check-translations` (883 texts):

| Language | menu | screen title | heading | field | help text | screen text | shared text | total |
|---|---|---|---|---|---|---|---|---|
| English | 2 | 16 | 38 | 133 | 47 | 115 | 37 | 388 |
| German | 5 | 15 | 40 | 138 | 47 | 126 | 39 | 410 |
| French | 5 | 15 | 38 | 134 | 47 | 128 | 38 | 405 |
| Danish | 5 | 17 | 38 | 137 | 47 | 126 | 38 | 408 |
| Italian | 6 | 18 | 39 | 134 | 47 | 126 | 38 | 408 |
| Hebrew | 4 | 42 | 136 | 240 | 60 | 225 | 69 | 776 |
| Arabic | 4 | 42 | 136 | 240 | 60 | 225 | 69 | 776 |

- **388 texts are not concepts**, so they are missing in every language;
  English's 388 are exactly these. Some are translated anyway:
  `setTranslation` attaches a translation to any entity of that name
  when no concept has it, so the reports (`Balance Sheet`, `Trial
  Balance`), the English chart's accounts and the days of the week have
  German, French and Danish text but no concept and no English entry.
- **Hebrew and Arabic** have almost no translations.
- **90 translations cannot be stored**: two concepts with the same word
  in one language (Italian `Attivo` for `Asset` and `Active`) would be
  two siblings of one name under the language, which entity names
  forbid. `setTranslation` keeps the first and appends the clash to
  `docs/flagged-translation-collisions.log`; 100 steps of the
  translation fixture fail for this reason.
- **Text direction** is stored under the language like a translation:
  `Arabic — Text Direction` and `Hebrew — Text Direction` under each
  language, related to `RTL`.
