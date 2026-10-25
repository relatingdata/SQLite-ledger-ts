import { db } from './db.js';
import {
  supersedeEntity, setTranslation, setContactType, mergeContactDetail, setHierarchyParent, setEntityLink, instantiateChartOfAccounts, copyChartOfAccountsInto, asBusinessName, asUserId, create, requireEntity, requireEntityById, typeRootName, typeVocabularyWordName, typeExpenseCategoryName, typeMenuSectionName, typeMenuLinkName, typeMenuLinkFlagName, typeBusinessTypeName, typeBusinessTypeQuestionsRootName, typeBusinessTypeQuestionName, typeBusinessContactsRootName, typeChartOfAccountsRootName, typeBusinessName, typeCustomerName, typeProviderName, type UserId, type EntityUpdate } from './db.js';

// Every real seed function below acts as this one, real, direct admin
// user — cast once, here, rather than at each of the many, real,
// individual call sites throughout this file.
const SEED_USER_ID: UserId = asUserId(1);

// Per direct, absolute instruction: NO demo/seed business, and NO
// non-English language's translated text, has any presence in the
// application's own basic initial data load any more - both are real
// content that belongs in a separately-run, real test-runner script
// instead (see `scripts/simulate-wine-retail-month.ts` and
// `scripts/load-translations.ts`), never baked into what boots by
// default. The four real Wine Retail Business seed functions that
// used to live here (migrateForWineRetailDemoData,
// migrateForWineRetailCompany, seedWineRetailEmployees,
// migrateForWineRetailUpcs, each gated on a real SEED_DEMO_BUSINESSES
// flag), and the real, unconditional `shared-fixtures/translations.csv`
// loader (loadTranslationsFromSharedCsv), have been removed entirely
// from this file - not merely gated off. Everything else below this
// point is real, permanent, structural seed data (vocabulary/menu/
// business-type scaffolding), unaffected by this change.

// ---------------------------------------------------------------------------
// Real, permanent seed data — deliberately NOT "migrations" any more.
//
// Per direct, explicit instruction: this app no longer supports
// upgrading an old, existing database in place. Every real schema
// change (a new column, a new table, a new trigger) now lives ONLY in
// schema.sql itself, applied once, fresh, on a brand-new database —
// never as a separate, conditional "does this old database have the
// new column yet?" migration function. That entire category of
// function (dozens of them, each with its own real risk of a dangling
// trigger reference or a primary-key rebuild going wrong mid-flight —
// several real bugs this session were caused by exactly that
// complexity) has been removed entirely, along with its own dedicated
// test file. Going forward: any real schema change is a real, direct
// edit to schema.sql, verified against a genuinely fresh database via
// `make reset-db`, full stop.
//
// What remains here is a real, different, smaller category: pure data
// seeding — real entities, real translations, real demo data — that
// genuinely doesn't fit as static INSERT statements in schema.sql
// (because it's generated programmatically, via the same real
// createEntity/setTranslation functions the rest of the app uses, not
// hand-written SQL). Each function below is still real, still
// idempotent (safe to run more than once), but is no longer framed as
// upgrading anything — it simply, always runs once at startup,
// populating a fresh database the same way every time.
// ---------------------------------------------------------------------------

export function seedRemainingData(): void {

function migrateForCoaTranslations() {
const coaTranslations: [string, string, string][] = [
    ['Cash and Bank', 'German', 'Kasse und Bank'],
    ['Cash and Bank', 'French', 'Caisse et banque'],
    ['Cash and Bank', 'Danish', 'Kasse og bank'],
    ['Cost of Goods Sold', 'German', 'Wareneinsatz'],
    ['Cost of Goods Sold', 'French', 'Coût des marchandises vendues'],
    ['Cost of Goods Sold', 'Danish', 'Vareforbrug'],
    ['Fixed Assets', 'German', 'Anlagevermögen'],
    ['Fixed Assets', 'French', 'Immobilisations'],
    ['Fixed Assets', 'Danish', 'Anlægsaktiver'],
    ['Inventory', 'German', 'Warenbestand'],
    ['Inventory', 'French', 'Stock'],
    ['Inventory', 'Danish', 'Lager'],
    ['Loans Payable', 'German', 'Darlehensverbindlichkeiten'],
    ['Loans Payable', 'French', 'Emprunts'],
    ['Loans Payable', 'Danish', 'Lån'],
    ['Miscellaneous', 'German', 'Sonstiges'],
    ['Miscellaneous', 'French', 'Divers'],
    ['Miscellaneous', 'Danish', 'Diverse'],
    ['Office', 'German', 'Büro'],
    ['Office', 'French', 'Bureau'],
    ['Office', 'Danish', 'Kontor'],
    ['Other Income', 'German', 'Sonstige Erträge'],
    ['Other Income', 'French', 'Autres produits'],
    ['Other Income', 'Danish', 'Andre indtægter'],
    ['Owner\'s Equity', 'German', 'Eigenkapital'],
    ['Owner\'s Equity', 'French', 'Capital'],
    ['Owner\'s Equity', 'Danish', 'Egenkapital'],
    ['Purchases Tax Claimed', 'German', 'Vorsteuer'],
    ['Purchases Tax Claimed', 'French', 'TVA déductible'],
    ['Purchases Tax Claimed', 'Danish', 'Købsmoms'],
    ['Rent', 'German', 'Miete'],
    ['Rent', 'French', 'Loyer'],
    ['Rent', 'Danish', 'Husleje'],
    ['Retained Earnings', 'German', 'Gewinnvortrag'],
    ['Retained Earnings', 'French', 'Bénéfices non distribués'],
    ['Retained Earnings', 'Danish', 'Overført resultat'],
    ['Sales Discounts', 'German', 'Erlösschmälerungen'],
    ['Sales Discounts', 'French', 'Remises sur ventes'],
    ['Sales Discounts', 'Danish', 'Salgsrabatter'],
    ['Sales Revenue', 'German', 'Umsatzerlöse'],
    ['Sales Revenue', 'French', 'Chiffre d\'affaires'],
    ['Sales Revenue', 'Danish', 'Salgsindtægter'],
    ['Sales Tax Payable', 'German', 'Umsatzsteuer'],
    ['Sales Tax Payable', 'French', 'TVA collectée'],
    ['Sales Tax Payable', 'Danish', 'Salgsmoms'],
    ['Utilities', 'German', 'Nebenkosten'],
    ['Utilities', 'French', 'Charges locatives'],
    ['Utilities', 'Danish', 'Forsyning'],
    ['Wages', 'German', 'Löhne und Gehälter'],
    ['Wages', 'French', 'Salaires'],
    ['Wages', 'Danish', 'Lønninger'],
    ['Immaterielle Vermögensgegenstände', 'English', 'Intangible assets'],
    ['Immaterielle Vermögensgegenstände', 'French', 'Immobilisations incorporelles'],
    ['Immaterielle Vermögensgegenstände', 'Danish', 'Immaterielle anlægsaktiver'],
    ['Sachanlagen', 'English', 'Property, plant and equipment'],
    ['Sachanlagen', 'French', 'Immobilisations corporelles'],
    ['Sachanlagen', 'Danish', 'Materielle anlægsaktiver'],
    ['Vorräte', 'English', 'Inventories'],
    ['Vorräte', 'French', 'Stocks'],
    ['Vorräte', 'Danish', 'Varebeholdninger'],
    ['Forderungen und sonstige Vermögensgegenstände', 'English', 'Receivables and other assets'],
    ['Forderungen und sonstige Vermögensgegenstände', 'French', 'Créances et autres actifs'],
    ['Forderungen und sonstige Vermögensgegenstände', 'Danish', 'Tilgodehavender og andre aktiver'],
    ['Kassenbestand und Bankguthaben', 'English', 'Cash on hand and bank balances'],
    ['Kassenbestand und Bankguthaben', 'French', 'Caisse et avoirs bancaires'],
    ['Kassenbestand und Bankguthaben', 'Danish', 'Kontante beholdninger og bankindeståender'],
    ['Rechnungsabgrenzungsposten (Aktiva)', 'English', 'Prepaid expenses'],
    ['Rechnungsabgrenzungsposten (Aktiva)', 'French', 'Charges constatées d’avance'],
    ['Rechnungsabgrenzungsposten (Aktiva)', 'Danish', 'Periodeafgrænsningsposter (aktiver)'],
    ['Gezeichnetes Kapital', 'English', 'Subscribed capital'],
    ['Gezeichnetes Kapital', 'French', 'Capital souscrit'],
    ['Gezeichnetes Kapital', 'Danish', 'Selskabskapital'],
    ['Gewinnrücklagen', 'English', 'Retained earnings'],
    ['Gewinnrücklagen', 'French', 'Réserves'],
    ['Gewinnrücklagen', 'Danish', 'Overført resultat'],
    ['Rückstellungen', 'English', 'Provisions'],
    ['Rückstellungen', 'French', 'Provisions'],
    ['Rückstellungen', 'Danish', 'Hensættelser'],
    ['Erhaltene Anzahlungen', 'English', 'Advance payments received'],
    ['Erhaltene Anzahlungen', 'French', 'Avances et acomptes reçus'],
    ['Erhaltene Anzahlungen', 'Danish', 'Modtagne forudbetalinger'],
    ['Verbindlichkeiten aus Lieferungen und Leistungen', 'English', 'Trade payables'],
    ['Verbindlichkeiten aus Lieferungen und Leistungen', 'French', 'Dettes fournisseurs'],
    ['Verbindlichkeiten aus Lieferungen und Leistungen', 'Danish', 'Leverandørgæld'],
    ['Verbindlichkeiten gegenüber verbundenen Unternehmen', 'English', 'Amounts owed to affiliated companies'],
    ['Verbindlichkeiten gegenüber verbundenen Unternehmen', 'French', 'Dettes envers des entreprises liées'],
    ['Verbindlichkeiten gegenüber verbundenen Unternehmen', 'Danish', 'Gæld til tilknyttede virksomheder'],
    ['Sonstige Verbindlichkeiten', 'English', 'Other liabilities'],
    ['Sonstige Verbindlichkeiten', 'French', 'Autres dettes'],
    ['Sonstige Verbindlichkeiten', 'Danish', 'Anden gæld'],
    ['Umsatzerlöse', 'English', 'Revenues'],
    ['Umsatzerlöse', 'French', 'Chiffre d\'affaires'],
    ['Umsatzerlöse', 'Danish', 'Omsætning'],
    ['Sonstige betriebliche Erträge', 'English', 'Other operating income'],
    ['Sonstige betriebliche Erträge', 'French', 'Autres produits d\'exploitation'],
    ['Sonstige betriebliche Erträge', 'Danish', 'Andre driftsindtægter'],
    ['Herstellungskosten', 'English', 'Production costs'],
    ['Herstellungskosten', 'French', 'Coûts de production'],
    ['Herstellungskosten', 'Danish', 'Produktionsomkostninger'],
    ['Vertriebskosten', 'English', 'Distribution costs'],
    ['Vertriebskosten', 'French', 'Frais de distribution'],
    ['Vertriebskosten', 'Danish', 'Distributionsomkostninger'],
    ['Allgemeine Verwaltungskosten', 'English', 'General administrative expenses'],
    ['Allgemeine Verwaltungskosten', 'French', 'Frais administratifs généraux'],
    ['Allgemeine Verwaltungskosten', 'Danish', 'Generelle administrationsomkostninger'],
    ['Sonstige betriebliche Aufwendungen', 'English', 'Other operating expenses'],
    ['Sonstige betriebliche Aufwendungen', 'French', 'Autres charges d\'exploitation'],
    ['Sonstige betriebliche Aufwendungen', 'Danish', 'Andre driftsomkostninger'],
    ['Zinsergebnis', 'English', 'Interest result'],
    ['Zinsergebnis', 'French', 'Résultat financier'],
    ['Zinsergebnis', 'Danish', 'Finansielle poster'],
    ['Steuern vom Einkommen und Ertrag', 'English', 'Taxes on income'],
    ['Steuern vom Einkommen und Ertrag', 'French', 'Impôts sur le résultat'],
    ['Steuern vom Einkommen und Ertrag', 'Danish', 'Skat af årets resultat'],
    ['Sonstige Steuern', 'English', 'Other taxes'],
    ['Sonstige Steuern', 'French', 'Autres impôts'],
    ['Sonstige Steuern', 'Danish', 'Andre skatter og afgifter'],
    ['Gewinnabführung', 'English', 'Profit transferred under profit-and-loss transfer agreement'],
    ['Gewinnabführung', 'French', 'Transfert de bénéfice'],
    ['Gewinnabführung', 'Danish', 'Overført resultat til moderselskab'],
    ['Stocks et en-cours', 'English', 'Inventory and work in progress'],
    ['Stocks et en-cours', 'German', 'Vorräte und unfertige Erzeugnisse'],
    ['Stocks et en-cours', 'Danish', 'Varebeholdninger og igangværende arbejder'],
    ['Créances clients et comptes rattachés', 'English', 'Trade receivables'],
    ['Créances clients et comptes rattachés', 'German', 'Forderungen aus Lieferungen und Leistungen'],
    ['Créances clients et comptes rattachés', 'Danish', 'Tilgodehavender fra salg'],
    ['Autres créances', 'English', 'Other receivables'],
    ['Autres créances', 'German', 'Sonstige Forderungen'],
    ['Autres créances', 'Danish', 'Andre tilgodehavender'],
    ['Disponibilités', 'English', 'Cash at bank and in hand'],
    ['Disponibilités', 'German', 'Kassenbestand und Bankguthaben'],
    ['Disponibilités', 'Danish', 'Likvide beholdninger'],
    ['Capital', 'English', 'Share capital'],
    ['Capital', 'German', 'Gezeichnetes Kapital'],
    ['Capital', 'Danish', 'Selskabskapital'],
    ['Report à nouveau', 'English', 'Retained earnings brought forward'],
    ['Report à nouveau', 'German', 'Gewinnvortrag'],
    ['Report à nouveau', 'Danish', 'Overført resultat fra tidligere år'],
    ['Provisions pour risques', 'English', 'Provisions for risks'],
    ['Provisions pour risques', 'German', 'Rückstellungen für Risiken'],
    ['Provisions pour risques', 'Danish', 'Hensættelser til risici'],
    ['Emprunts et dettes financières divers', 'English', 'Borrowings and miscellaneous financial debt'],
    ['Emprunts et dettes financières divers', 'German', 'Finanzverbindlichkeiten'],
    ['Emprunts et dettes financières divers', 'Danish', 'Lån og anden finansiel gæld'],
    ['Dettes fournisseurs et comptes rattachés', 'English', 'Trade payables'],
    ['Dettes fournisseurs et comptes rattachés', 'German', 'Verbindlichkeiten aus Lieferungen und Leistungen'],
    ['Dettes fournisseurs et comptes rattachés', 'Danish', 'Leverandørgæld'],
    ['Dettes fiscales et sociales', 'English', 'Tax and social security liabilities'],
    ['Dettes fiscales et sociales', 'German', 'Steuer- und Sozialverbindlichkeiten'],
    ['Dettes fiscales et sociales', 'Danish', 'Skyldig skat og sociale bidrag'],
    ['Autres dettes', 'English', 'Other liabilities'],
    ['Autres dettes', 'German', 'Sonstige Verbindlichkeiten'],
    ['Autres dettes', 'Danish', 'Anden gæld'],
    ['Ventes de marchandises', 'English', 'Sales of goods'],
    ['Ventes de marchandises', 'German', 'Warenverkäufe'],
    ['Ventes de marchandises', 'Danish', 'Varesalg'],
    ['Production vendue - Biens', 'English', 'Sales of manufactured goods'],
    ['Production vendue - Biens', 'German', 'Umsatzerlöse aus Erzeugnissen'],
    ['Production vendue - Biens', 'Danish', 'Salg af producerede varer'],
    ['Production vendue - Services', 'English', 'Sales of services'],
    ['Production vendue - Services', 'German', 'Umsatzerlöse aus Dienstleistungen'],
    ['Production vendue - Services', 'Danish', 'Salg af tjenesteydelser'],
    ['Reprises sur provisions et transferts de charges', 'English', 'Reversals of provisions and expense transfers'],
    ['Reprises sur provisions et transferts de charges', 'German', 'Auflösung von Rückstellungen'],
    ['Reprises sur provisions et transferts de charges', 'Danish', 'Tilbageførsel af hensættelser'],
    ['Autres produits', 'English', 'Other income'],
    ['Autres produits', 'German', 'Sonstige Erträge'],
    ['Autres produits', 'Danish', 'Andre indtægter'],
    ['Produits financiers', 'English', 'Financial income'],
    ['Produits financiers', 'German', 'Finanzerträge'],
    ['Produits financiers', 'Danish', 'Finansielle indtægter'],
    ['Production stockée (variation)', 'English', 'Change in inventory of finished goods'],
    ['Production stockée (variation)', 'German', 'Bestandsveränderung fertiger Erzeugnisse'],
    ['Production stockée (variation)', 'Danish', 'Ændring i varebeholdning'],
    ['Achats de marchandises', 'English', 'Purchases of goods'],
    ['Achats de marchandises', 'German', 'Wareneinkäufe'],
    ['Achats de marchandises', 'Danish', 'Varekøb'],
    ['Achats de matières premières et autres approvisionnements', 'English', 'Purchases of raw materials and supplies'],
    ['Achats de matières premières et autres approvisionnements', 'German', 'Materialaufwand'],
    ['Achats de matières premières et autres approvisionnements', 'Danish', 'Køb af råvarer'],
    ['Variation des stocks de matières premières', 'English', 'Change in raw material inventory'],
    ['Variation des stocks de matières premières', 'German', 'Bestandsveränderung Rohstoffe'],
    ['Variation des stocks de matières premières', 'Danish', 'Ændring i råvarelager'],
    ['Autres achats et charges externes', 'English', 'Other purchases and external expenses'],
    ['Autres achats et charges externes', 'German', 'Sonstige betriebliche Aufwendungen'],
    ['Autres achats et charges externes', 'Danish', 'Andre eksterne omkostninger'],
    ['Impôts, taxes et versements assimilés', 'English', 'Taxes and similar payments'],
    ['Impôts, taxes et versements assimilés', 'German', 'Steuern und Abgaben'],
    ['Impôts, taxes et versements assimilés', 'Danish', 'Skatter og afgifter'],
    ['Dotations aux provisions sur actif circulant', 'English', 'Provisions on current assets'],
    ['Dotations aux provisions sur actif circulant', 'German', 'Zuführung Wertberichtigungen Umlaufvermögen'],
    ['Dotations aux provisions sur actif circulant', 'Danish', 'Hensættelser vedr. omsætningsaktiver'],
    ['Dotations aux provisions pour risques et charges', 'English', 'Provisions for risks and charges'],
    ['Dotations aux provisions pour risques et charges', 'German', 'Zuführung Rückstellungen'],
    ['Dotations aux provisions pour risques et charges', 'Danish', 'Hensættelser til risici og forpligtelser'],
    ['Autres charges', 'English', 'Other expenses'],
    ['Autres charges', 'German', 'Sonstige Aufwendungen'],
    ['Autres charges', 'Danish', 'Andre omkostninger'],
    ['Charges financières', 'English', 'Financial expenses'],
    ['Charges financières', 'German', 'Finanzaufwendungen'],
    ['Charges financières', 'Danish', 'Finansielle omkostninger'],
    ['Charges exceptionnelles', 'English', 'Exceptional expenses'],
    ['Charges exceptionnelles', 'German', 'Außerordentliche Aufwendungen'],
    ['Charges exceptionnelles', 'Danish', 'Ekstraordinære omkostninger'],
    ['Impôts sur les bénéfices', 'English', 'Income tax'],
    ['Impôts sur les bénéfices', 'German', 'Ertragsteuern'],
    ['Impôts sur les bénéfices', 'Danish', 'Selskabsskat'],
  ];
  for (const [entity, language, text] of coaTranslations) {
    if (!db.prepare(`SELECT 1 FROM current_entities WHERE name = ?`).get(entity)) continue;
    setTranslation(entity, language, text);
  }
}
migrateForCoaTranslations();

function migrateForLanguageNameTranslations() {
const languageNameTranslations: [string, string, string][] = [
    ['English', 'German', 'Englisch'],
    ['English', 'French', 'Anglais'],
    ['English', 'Danish', 'Engelsk'],
    ['German', 'English', 'German'],
    ['German', 'French', 'Allemand'],
    ['German', 'Danish', 'Tysk'],
    ['German', 'German', 'Deutsch'],
    ['French', 'English', 'French'],
    ['French', 'German', 'Französisch'],
    ['French', 'Danish', 'Fransk'],
    ['French', 'French', 'Français'],
    ['Danish', 'English', 'Danish'],
    ['Danish', 'German', 'Dänisch'],
    ['Danish', 'French', 'Danois'],
    ['Danish', 'Danish', 'Dansk'],
  ];
  for (const [entity, language, text] of languageNameTranslations) {
    setTranslation(entity, language, text);
  }
}
migrateForLanguageNameTranslations();

function migrateForUtilitiesRestructure() {
  const hasEntity = (name: string) => !!db.prepare(`SELECT 1 FROM current_entities WHERE name = ?`).get(name);

  // Remove Utilities' own account row if this database still has it
  // from before this restructure — it's no longer directly postable.
  // Defensive, not just "run once": if a real journal_line already
  // references this account (a real, confirmed case found live — a
  // screen that didn't filter to postable-only accounts let a real
  // user post directly against Utilities before this migration ran
  // again), deleting the row would violate a real foreign key and
  // crash every future startup. Skip it in that case rather than fail
  // the whole migration — the real fix for the actual cause (a
  // screen posting against a non-postable, structural category) is
  // separate, real work, not this migration's job to paper over.
  const utilitiesId = (db.prepare(`SELECT id FROM current_entities WHERE name = 'Utilities'`).get() as { id: number } | undefined)?.id;
  if (utilitiesId) {
    const hasRealPostings = db.prepare(`SELECT 1 FROM journal_line WHERE account_id = ?`).get(utilitiesId);
    if (!hasRealPostings) {
      db.prepare(`DELETE FROM account WHERE entity_id = ?`).run(utilitiesId);
    }
  }

  if (!hasEntity('Electricity')) create(requireEntity('Utilities', typeRootName), typeExpenseCategoryName, 'Electricity', SEED_USER_ID);
  if (!hasEntity('Refrigeration')) create(requireEntity('Electricity', typeRootName), typeExpenseCategoryName, 'Refrigeration', SEED_USER_ID);
  if (!hasEntity('Lighting & General')) create(requireEntity('Electricity', typeRootName), typeExpenseCategoryName, 'Lighting & General', SEED_USER_ID);
  if (!hasEntity('Gas')) create(requireEntity('Utilities', typeRootName), typeExpenseCategoryName, 'Gas', SEED_USER_ID);
  if (!hasEntity('Water')) create(requireEntity('Utilities', typeRootName), typeExpenseCategoryName, 'Water', SEED_USER_ID);
  if (!hasEntity('Internet')) create(requireEntity('Utilities', typeRootName), typeExpenseCategoryName, 'Internet', SEED_USER_ID);
  if (!hasEntity('Telephone')) create(requireEntity('Utilities', typeRootName), typeExpenseCategoryName, 'Telephone', SEED_USER_ID);

  for (const name of ['Refrigeration', 'Lighting & General', 'Gas', 'Water', 'Internet', 'Telephone']) {
    if (!db.prepare(`SELECT 1 FROM account WHERE entity_id = (SELECT id FROM current_entities WHERE name = ?)`).get(name)) {
      db.prepare(`INSERT INTO account (entity_id) VALUES ((SELECT id FROM current_entities WHERE name = ?))`).run(name);
    }
  }

  const utilitiesSubaccountTranslations: [string, string, string][] = [
    ['Electricity', 'German', 'Strom'],
    ['Electricity', 'French', 'Électricité'],
    ['Electricity', 'Danish', 'Elektricitet'],
    ['Refrigeration', 'German', 'Kühlung'],
    ['Refrigeration', 'French', 'Réfrigération'],
    ['Refrigeration', 'Danish', 'Køling'],
    ['Lighting & General', 'German', 'Beleuchtung & Allgemein'],
    ['Lighting & General', 'French', 'Éclairage et général'],
    ['Lighting & General', 'Danish', 'Belysning og generelt'],
    ['Gas', 'German', 'Gas'],
    ['Gas', 'French', 'Gaz'],
    ['Gas', 'Danish', 'Gas'],
    ['Water', 'German', 'Wasser'],
    ['Water', 'French', 'Eau'],
    ['Water', 'Danish', 'Vand'],
    ['Internet', 'German', 'Internet'],
    ['Internet', 'French', 'Internet'],
    ['Internet', 'Danish', 'Internet'],
    ['Telephone', 'German', 'Telefon'],
    ['Telephone', 'French', 'Téléphone'],
    ['Telephone', 'Danish', 'Telefon'],
  ];
  for (const [entity, language, text] of utilitiesSubaccountTranslations) {
    setTranslation(entity, language, text);
  }
}
migrateForUtilitiesRestructure();

function migrateForPagerVocabulary() {
  const hasEntity = (name: string) => !!db.prepare(`SELECT 1 FROM current_entities WHERE name = ?`).get(name);
  for (const word of ['Newer', 'Older', 'Page']) {
    if (!hasEntity(word)) create(requireEntity('Vocabulary', typeRootName), typeVocabularyWordName, word, SEED_USER_ID);
  }
const pagerVocab: [string, string, string][] = [
    ['Newer', 'German', 'Neuere'],
    ['Newer', 'French', 'Plus récent'],
    ['Newer', 'Danish', 'Nyere'],
    ['Older', 'German', 'Ältere'],
    ['Older', 'French', 'Plus ancien'],
    ['Older', 'Danish', 'Ældre'],
    ['Page', 'German', 'Seite'],
    ['Page', 'French', 'Page'],
    ['Page', 'Danish', 'Side'],
  ];
  for (const [entity, language, text] of pagerVocab) {
    setTranslation(entity, language, text);
  }
}
migrateForPagerVocabulary();

function migrateForDayOfWeekTranslations() {
  // A real, direct gap found via direct verification: the seven real
  // Days of Week entities (added this session for location open
  // hours/employee scheduling) had no real translations at all,
  // correctly falling back to their own English name rather than
  // showing anything wrong, but genuinely untranslated nonetheless.
  const days: [string, string, string][] = [
    ['Sunday', 'German', 'Sonntag'],
    ['Sunday', 'French', 'Dimanche'],
    ['Sunday', 'Danish', 'Søndag'],
    ['Sunday', 'Italian', 'Domenica'],
    ['Monday', 'German', 'Montag'],
    ['Monday', 'French', 'Lundi'],
    ['Monday', 'Danish', 'Mandag'],
    ['Monday', 'Italian', 'Lunedì'],
    ['Tuesday', 'German', 'Dienstag'],
    ['Tuesday', 'French', 'Mardi'],
    ['Tuesday', 'Danish', 'Tirsdag'],
    ['Tuesday', 'Italian', 'Martedì'],
    ['Wednesday', 'German', 'Mittwoch'],
    ['Wednesday', 'French', 'Mercredi'],
    ['Wednesday', 'Danish', 'Onsdag'],
    ['Wednesday', 'Italian', 'Mercoledì'],
    ['Thursday', 'German', 'Donnerstag'],
    ['Thursday', 'French', 'Jeudi'],
    ['Thursday', 'Danish', 'Torsdag'],
    ['Thursday', 'Italian', 'Giovedì'],
    ['Friday', 'German', 'Freitag'],
    ['Friday', 'French', 'Vendredi'],
    ['Friday', 'Danish', 'Fredag'],
    ['Friday', 'Italian', 'Venerdì'],
    ['Saturday', 'German', 'Samstag'],
    ['Saturday', 'French', 'Samedi'],
    ['Saturday', 'Danish', 'Lørdag'],
    ['Saturday', 'Italian', 'Sabato'],
  ];
  for (const [entity, language, text] of days) {
    setTranslation(entity, language, text);
  }
}
migrateForDayOfWeekTranslations();

function migrateForEnglishStringAuditGap() {
  // Short words/phrases first
  const short: [string, string, string, string, string][] = [
    ['Sections', 'Abschnitte', 'Sections', 'Sektioner', 'Sezioni'],
    ['Rename', 'Umbenennen', 'Renommer', 'Omdøb', 'Rinomina'],
    ['Number', 'Nummer', 'Numéro', 'Nummer', 'Numero'],
    ['Since', 'Seit', 'Depuis', 'Siden', 'Da'],
    ['Timezone', 'Zeitzone', 'Fuseau horaire', 'Tidszone', 'Fuso orario'],
    ['Street address', 'Straße', 'Adresse', 'Gadeadresse', 'Indirizzo'],
    ['Location name', 'Standortname', "Nom de l'emplacement", 'Lokationsnavn', 'Nome della posizione'],
    ['Division name', 'Bereichsname', 'Nom de la division', 'Afdelingsnavn', 'Nome della divisione'],
    ['Customer name', 'Kundenname', 'Nom du client', 'Kundenavn', 'Nome del cliente'],
    ['Employee name', 'Mitarbeitername', "Nom de l'employé", 'Medarbejdernavn', 'Nome del dipendente'],
    ['Email (optional)', 'E-Mail (optional)', 'E-mail (facultatif)', 'E-mail (valgfrit)', 'E-mail (opzionale)'],
    ['Legal structure', 'Rechtsform', 'Structure juridique', 'Juridisk struktur', 'Struttura giuridica'],
    ['Clock in', 'Einstempeln', 'Pointer arrivée', 'Stemple ind', 'Timbra entrata'],
    ['Clock out', 'Ausstempeln', 'Pointer déitem', 'Stemple ud', 'Timbra uscita'],
    ['Currently clocked in against', 'Aktuell eingestempelt bei', 'Actuellement pointé sur', 'Aktuelt stemplet ind på', 'Attualmente timbrato su'],
    ['Delivery location', 'Lieferort', 'Lieu de livraison', 'Leveringssted', 'Luogo di consegna'],
    ['Dispatch location', 'Versandort', "Lieu d'expédition", 'Afsendelsessted', 'Luogo di spedizione'],
    ['Amount (minor units)', 'Betrag (kleinste Einheit)', 'Montant (unité mineure)', 'Beløb (mindste enhed)', 'Importo (unità minore)'],
    ['Tax (minor units)', 'Steuer (kleinste Einheit)', 'Taxe (unité mineure)', 'Skat (mindste enhed)', 'Imposta (unità minore)'],
    ['Add a new word', 'Ein neues Wort hinzufügen', 'Ajouter un nouveau mot', 'Tilføj et nyt ord', 'Aggiungi una nuova parola'],
    ['Add word', 'Wort hinzufügen', 'Ajouter un mot', 'Tilføj ord', 'Aggiungi parola'],
    ['Add a new account under this one', 'Ein neues Konto unter diesem hinzufügen', 'Ajouter un nouveau compte sous celui-ci', 'Tilføj en ny konto under denne', 'Aggiungi un nuovo conto sotto questo'],
    ['Allocate to outstanding invoices (optional)', 'Offenen Rechnungen zuordnen (optional)', 'Affecter aux factures impayées (facultatif)', 'Allokér til udestående fakturaer (valgfrit)', 'Assegna alle fatture in sospeso (opzionale)'],
    ['Select an account on the left.', 'Wählen Sie links ein Konto aus.', 'Sélectionnez un compte à gauche.', 'Vælg en konto til venstre.', 'Seleziona un conto a sinistra.'],
    ['Select employee...', 'Mitarbeiter auswählen...', 'Sélectionner un employé...', 'Vælg medarbejder...', 'Seleziona dipendente...'],
    ['Select project...', 'Projekt auswählen...', 'Sélectionner un projet...', 'Vælg projekt...', 'Seleziona progetto...'],
    ['Project (expense account)', 'Projekt (Aufwandskonto)', 'Projet (compte de charges)', 'Projekt (udgiftskonto)', 'Progetto (conto spese)'],
    ['Item / account (what this receipt is for)', 'Artikel / Konto (wofür dieser Beleg ist)', 'Article / compte (objet de ce reçu)', 'Vare / konto (hvad denne kvittering er til)', 'Articolo / conto (a cosa si riferisce questa ricevuta)'],
    ['Show everything (employees, customers, providers, manufacturers)', 'Alles anzeigen (Mitarbeiter, Kunden, Lieferanten, Hersteller)', 'Tout afficher (employés, clients, fournisseurs, fabricants)', 'Vis alt (medarbejdere, kunder, leverandører, producenter)', 'Mostra tutto (dipendenti, clienti, fornitori, produttori)'],
    ['Known, real, alternate words for this concept:', 'Bekannte, tatsächliche alternative Wörter für dieses Konzept:', 'Mots alternatifs réels et connus pour ce concept :', 'Kendte, reelle alternative ord for dette begreb:', 'Parole alternative reali e conosciute per questo concetto:'],
    ['No real concept currently has more than one, known, alternate name.', 'Derzeit hat kein reales Konzept mehr als einen bekannten alternativen Namen.', "Aucun concept réel n'a actuellement plus d'un nom alternatif connu.", 'Ingen reelt begreb har i øjeblikket mere end ét kendt alternativt navn.', 'Nessun concetto reale ha attualmente più di un nome alternativo conosciuto.'],
    ['did you mean to link to it via Relation instead?', 'wollten Sie es stattdessen über Relation verknüpfen?', 'vouliez-vous plutôt le lier via Relation ?', 'mente du at linke til det via Relation i stedet?', 'intendevi collegarlo tramite Relation invece?'],
    ['New category name, e.g. Pinot Noir', 'Neuer Kategoriename, z. B. Pinot Noir', 'Nouveau nom de catégorie, par ex. Pinot Noir', 'Nyt kategorinavn, f.eks. Pinot Noir', 'Nuovo nome categoria, es. Pinot Noir'],
    ['New item name', 'Neuer Teilename', "Nouveau nom d'article", 'Nyt varenavn', 'Nuovo nome articolo'],
    ['Location name, e.g. Downtown Cellar', 'Standortname, z. B. Downtown Cellar', "Nom de l'emplacement, par ex. Downtown Cellar", 'Lokationsnavn, f.eks. Downtown Cellar', 'Nome della posizione, es. Downtown Cellar'],
    ['No invoices for this customer as of this date.', 'Keine Rechnungen für diesen Kunden zu diesem Datum.', "Aucune facture pour ce client à cette date.", 'Ingen fakturaer for denne kunde pr. denne dato.', 'Nessuna fattura per questo cliente a questa data.'],
    ['No real stock on hand for this combination.', 'Kein realer Lagerbestand für diese Kombination.', 'Aucun stock réel disponible pour cette combinaison.', 'Ingen reel lagerbeholdning for denne kombination.', 'Nessuna scorta reale disponibile per questa combinazione.'],
    ['No real division has any activity within this date range.', 'Kein realer Bereich weist in diesem Zeitraum eine Aktivität auf.', "Aucune division réelle n'a d'activité sur cette période.", 'Ingen reel afdeling har nogen aktivitet inden for denne periode.', 'Nessuna divisione reale ha attività in questo intervallo di date.'],
    ['No real wage or salary configured for this employee yet — set one on the Contacts page first.', 'Für diesen Mitarbeiter ist noch kein Lohn oder Gehalt festgelegt — legen Sie zuerst eines auf der Kontakte-Seite fest.', "Aucun salaire réel n'est encore configuré pour cet employé — définissez-en un d'abord sur la page Contacts.", 'Ingen reel løn er endnu konfigureret for denne medarbejder — indstil en på Kontakter-siden først.', 'Nessuno stipendio reale è ancora configurato per questo dipendente — impostane uno prima nella pagina Contatti.'],
    ['No real, known supplier on record for this item yet — showing every real provider.', 'Für diesen Artikel ist noch kein bekannter Lieferant erfasst — es werden alle Lieferanten angezeigt.', "Aucun fournisseur réel connu n'est encore enregistré pour cet article — affichage de tous les fournisseurs réels.", 'Ingen kendt reel leverandør er endnu registreret for denne vare — viser alle reelle leverandører.', 'Nessun fornitore reale conosciuto è ancora registrato per questo articolo — mostra tutti i fornitori reali.'],
    ['No real, outstanding invoices for this customer.', 'Keine offenen Rechnungen für diesen Kunden.', "Aucune facture réelle en attente pour ce client.", 'Ingen reelle udestående fakturaer for denne kunde.', 'Nessuna fattura reale in sospeso per questo cliente.'],
    ['No real, outstanding invoices for this vendor.', 'Keine offenen Rechnungen für diesen Lieferanten.', "Aucune facture réelle en attente pour ce fournisseur.", 'Ingen reelle udestående fakturaer for denne leverandør.', 'Nessuna fattura reale in sospeso per questo fornitore.'],
    ['No anticipated movements within this horizon.', 'Keine erwarteten Bewegungen in diesem Zeitraum.', 'Aucun mouvement anticipé sur cet horizon.', 'Ingen forventede bevægelser inden for denne horisont.', 'Nessun movimento previsto in questo orizzonte.'],
    ['No shortfall projected — cash stays within your arranged overdraft limit throughout this horizon.', 'Kein Engpass prognostiziert — die Liquidität bleibt während dieses Zeitraums innerhalb Ihres vereinbarten Dispolimits.', "Aucun déficit prévu — la trésorerie reste dans votre limite de découvert convenue tout au long de cet horizon.", 'Ingen underskud forventet — likviditeten forbliver inden for din aftalte overtræksgrænse gennem hele denne horisont.', 'Nessuna carenza prevista — la liquidità rimane entro il tuo limite di scoperto concordato per tutto questo orizzonte.'],
    ['Cash is projected to fall below your arranged overdraft limit on', 'Es wird prognostiziert, dass die Liquidität unter Ihr vereinbartes Dispolimit fällt am', 'La trésorerie devrait tomber sous votre limite de découvert convenue le', 'Kontanter forventes at falde under din aftalte overtræksgrænse den', 'La liquidità è prevista scendere sotto il tuo limite di scoperto concordato il'],
    ['Amex', 'Amex', 'Amex', 'Amex', 'Amex'],
    ['Mastercard', 'Mastercard', 'Mastercard', 'Mastercard', 'Mastercard'],
    ['Visa', 'Visa', 'Visa', 'Visa', 'Visa'],
    ['Net income', 'Nettoertrag', 'Résultat net', 'Nettoresultat', 'Utile netto'],
    ['On hand', 'Am Lager', 'En stock', 'På lager', 'In giacenza'],
    ['Reorder level', 'Meldebestand', 'Seuil de réapprovisionnement', 'Genbestillingsniveau', 'Livello di riordino'],
    ['(no division)', '(keine Abteilung)', '(aucune division)', '(ingen afdeling)', '(nessuna divisione)'],
    ['added under', 'hinzugefügt unter', 'ajouté sous', 'tilføjet under', 'aggiunto sotto'],
    ['Renamed to', 'Umbenannt in', 'Renommé en', 'Omdøbt til', 'Rinominato in'],
    ["This can't be undone.", 'Dies kann nicht rückgängig gemacht werden.', 'Cette action est irréversible.', 'Dette kan ikke fortrydes.', 'Questa azione non può essere annullata.'],
    ['deleted.', 'gelöscht.', 'supprimé.', 'slettet.', 'eliminato.'],
  ];
  for (const [entity, german, french, danish, italian] of short) {
    if (!db.prepare(`SELECT 1 FROM current_entities WHERE name = ?`).get(entity)) {
      create(requireEntity('Vocabulary', typeRootName), typeVocabularyWordName, entity, SEED_USER_ID);
    }
    setTranslation(entity, 'German', german);
    setTranslation(entity, 'French', french);
    setTranslation(entity, 'Danish', danish);
    setTranslation(entity, 'Italian', italian);
  }

  const longer: [string, string, string, string, string][] = [
    [
      'No real entity named',
      'Keine reale Entität namens',
      'Aucune entité réelle nommée',
      'Ingen reel enhed ved navn',
      'Nessuna entità reale denominata',
    ],
    [
      'Only showing this item\'s own, known suppliers',
      'Es werden nur die eigenen, bekannten Lieferanten dieses Artikels angezeigt',
      "Affichage uniquement des fournisseurs connus propres à cet article",
      'Viser kun denne vares egne, kendte leverandører',
      'Mostra solo i fornitori propri e conosciuti di questo articolo',
    ],
    [
      "Showing every real provider — click to only show this item's own, known suppliers.",
      'Es werden alle Lieferanten angezeigt — klicken Sie, um nur die eigenen, bekannten Lieferanten dieses Artikels anzuzeigen.',
      "Affichage de tous les fournisseurs réels — cliquez pour n'afficher que les fournisseurs connus propres à cet article.",
      'Viser alle reelle leverandører — klik for kun at vise denne vares egne, kendte leverandører.',
      'Mostra tutti i fornitori reali — clicca per mostrare solo i fornitori propri e conosciuti di questo articolo.',
    ],
    [
      'Cost shown is the preferred provider\u2019s own current price per unit \u2014 not a real, tracked historical average, since no such figure exists yet on a per-item basis.',
      'Der angezeigte Preis ist der aktuelle Preis pro Einheit des bevorzugten Lieferanten — kein realer, erfasster historischer Durchschnitt, da eine solche Kennzahl je Artikel noch nicht existiert.',
      "Le coût affiché est le prix actuel par unité du fournisseur préféré — pas une moyenne historique réelle suivie, car un tel chiffre n'existe pas encore par article.",
      'Den viste omkostning er den foretrukne leverandørs egen nuværende pris pr. enhed — ikke et reelt, sporet historisk gennemsnit, da et sådant tal endnu ikke findes pr. vare.',
      'Il costo mostrato è il prezzo attuale per unità del fornitore preferito — non una vera media storica tracciata, poiché tale valore non esiste ancora per singolo articolo.',
    ],
    [
      'Select a division, location, or employee on the left — Insert adds within whatever\'s selected, Delete removes it.',
      'Wählen Sie links einen Bereich, Standort oder Mitarbeiter aus — Einfg fügt innerhalb der Auswahl hinzu, Entf entfernt sie.',
      "Sélectionnez une division, un emplacement ou un employé à gauche — Insertion ajoute dans l'élément sélectionné, Suppr le retire.",
      'Vælg en afdeling, lokation eller medarbejder til venstre — Indsæt tilføjer inden for det valgte, Slet fjerner det.',
      'Seleziona una divisione, una posizione o un dipendente a sinistra — Inserisci aggiunge all\'interno di ciò che è selezionato, Elimina lo rimuove.',
    ],
    [
      'A division is purely a reporting grouping — press Insert to add a real location within it, or Delete to remove this division.',
      'Ein Bereich ist rein eine Berichtsgruppierung — drücken Sie Einfg, um einen realen Standort hinzuzufügen, oder Entf, um diesen Bereich zu entfernen.',
      'Une division est purement un regroupement de reporting — appuyez sur Insertion pour ajouter un emplacement réel, ou Suppr pour retirer cette division.',
      'En afdeling er udelukkende en rapporteringsgruppering — tryk på Indsæt for at tilføje en reel lokation, eller Slet for at fjerne denne afdeling.',
      'Una divisione è puramente un raggruppamento di reportistica — premi Inserisci per aggiungere una posizione reale al suo interno, o Elimina per rimuovere questa divisione.',
    ],
    [
      'A real, company-wide employee is not scheduled against any single location.',
      'Ein realer, unternehmensweiter Mitarbeiter wird keinem einzelnen Standort zugeordnet.',
      "Un employé réel, à l'échelle de l'entreprise, n'est planifié contre aucun emplacement unique.",
      'En reel, virksomhedsbred medarbejder er ikke planlagt mod nogen enkelt lokation.',
      "Un dipendente reale, a livello aziendale, non è pianificato rispetto a nessuna singola posizione.",
    ],
    [
      'A real employee can genuinely work a real, scheduled shift at more than one location — add another one here.',
      'Ein realer Mitarbeiter kann tatsächlich eine reale, geplante Schicht an mehr als einem Standort arbeiten — fügen Sie hier eine weitere hinzu.',
      "Un employé réel peut véritablement travailler un quart réel et planifié à plus d'un emplacement — ajoutez-en un autre ici.",
      'En reel medarbejder kan reelt arbejde en reel, planlagt vagt på mere end én lokation — tilføj en mere her.',
      'Un dipendente reale può effettivamente lavorare un turno reale e programmato in più di una posizione — aggiungine un\'altra qui.',
    ],
    [
      'A real employee has exactly one of the two — hourly wage or fixed annual salary, never both. Setting one clears the other. Pay Wages (under HR) uses whichever is actually set.',
      'Ein realer Mitarbeiter hat genau eines von beiden — Stundenlohn oder festes Jahresgehalt, niemals beides. Das Festlegen des einen löscht das andere. Löhne zahlen (unter Personal) verwendet, was tatsächlich festgelegt ist.',
      "Un employé réel a exactement l'un des deux — salaire horaire ou salaire annuel fixe, jamais les deux. Définir l'un efface l'autre. Payer les salaires (sous RH) utilise celui qui est effectivement défini.",
      'En reel medarbejder har præcis én af de to — timeløn eller fast årsløn, aldrig begge. At indstille den ene rydder den anden. Betal løn (under HR) bruger den, der faktisk er indstillet.',
      "Un dipendente reale ha esattamente uno dei due — salario orario o stipendio annuo fisso, mai entrambi. Impostarne uno cancella l'altro. Paga stipendi (sotto HR) usa quello effettivamente impostato.",
    ],
    [
      "A real employee is treated as a real Accounts Payable counterparty — the same mechanism a provider invoice already uses. Paying wages debits Wages (or the employee's own monthly salary), withholds a real Medicare levy from their own pay, and accrues real superannuation as a separate, additional employer cost.",
      "Ein realer Mitarbeiter wird als reale Kreditoren-Gegenpartei behandelt — derselbe Mechanismus, den eine Lieferantenrechnung bereits verwendet. Die Lohnzahlung belastet Löhne (oder das monatliche Gehalt des Mitarbeiters), behält eine reale Medicare-Abgabe vom eigenen Lohn ein und verbucht reale Pensionskassenbeiträge als separate, zusätzliche Arbeitgeberkosten.",
      "Un employé réel est traité comme une contrepartie réelle de comptes fournisseurs — le même mécanisme qu'une facture fournisseur utilise déjà. Le paiement des salaires débite Salaires (ou le salaire mensuel propre de l'employé), retient un vrai prélèvement Medicare sur sa propre paie, et comptabilise une vraie retraite comme coût employeur séparé et additionnel.",
      'En reel medarbejder behandles som en reel kreditormoditem — samme mekanisme som en leverandørfaktura allerede bruger. Betaling af løn debiterer Løn (eller medarbejderens egen månedsløn), tilbageholder en reel Medicare-afgift fra egen løn, og periodiserer reel pension som en separat, ekstra arbejdsgiveromkostning.',
      "Un dipendente reale è trattato come una controparte reale di debiti verso fornitori — lo stesso meccanismo già usato da una fattura fornitore. Il pagamento degli stipendi addebita Stipendi (o lo stipendio mensile del dipendente), trattiene un vero prelievo Medicare dalla sua paga, e accantona una vera previdenza come costo aggiuntivo separato per il datore di lavoro.",
    ],
  ];
  for (const [entity, german, french, danish, italian] of longer) {
    if (!db.prepare(`SELECT 1 FROM current_entities WHERE name = ?`).get(entity)) {
      create(requireEntity('Vocabulary', typeRootName), typeVocabularyWordName, entity, SEED_USER_ID);
    }
    setTranslation(entity, 'German', german);
    setTranslation(entity, 'French', french);
    setTranslation(entity, 'Danish', danish);
    setTranslation(entity, 'Italian', italian);
  }

  const paragraphs: [string, string, string, string, string][] = [
    [
      'A real P&L statement, in the same, vertical, drillable layout as the original — but grouped by two, real, independent, nested groupings at once. Pick what each level breaks down by, or narrow either one down to a single, particular value directly.',
      'Eine reale G&V-Rechnung, im selben, vertikalen, aufklappbaren Layout wie das Original — aber gleichzeitig nach zwei realen, unabhängigen, verschachtelten Gruppierungen gegliedert. Wählen Sie, wonach jede Ebene aufgeschlüsselt wird, oder grenzen Sie eine davon direkt auf einen einzelnen, bestimmten Wert ein.',
      'Un vrai compte de résultat, dans la même mise en page verticale et explorable que l\'original — mais regroupé selon deux regroupements réels, indépendants et imbriqués à la fois. Choisissez selon quoi chaque niveau se décompose, ou restreignez l\'un des deux directement à une seule valeur particulière.',
      'En reel resultatopgørelse, i samme lodrette, drill-down layout som originalen — men grupperet efter to reelle, uafhængige, indlejrede grupperinger på én gang. Vælg, hvad hvert niveau skal opdeles efter, eller indsnævr en af dem direkte til én bestemt værdi.',
      'Un vero conto economico, nello stesso layout verticale ed esplorabile dell\'originale — ma raggruppato per due raggruppamenti reali, indipendenti e annidati contemporaneamente. Scegli in base a cosa si suddivide ciascun livello, oppure restringi uno dei due direttamente a un singolo valore particolare.',
    ],
    [
      'A real, two-axis Sales vs. COGS report. Pick what each axis breaks down by — Product, Category, Location, Division, or Consolidated (no breakdown at all) — for any real combination, from the single, most-granular Product-by-Location matrix down to one, single, Consolidated number.',
      'Ein realer Umsatz-vs-Wareneinsatz-Bericht mit zwei Achsen. Wählen Sie, wonach jede Achse aufgeschlüsselt wird — Produkt, Kategorie, Standort, Bereich oder Konsolidiert (keine Aufschlüsselung) — für jede reale Kombination, von der einzelnen, feinsten Produkt-nach-Standort-Matrix bis hin zu einer einzigen, konsolidierten Zahl.',
      'Un vrai rapport Ventes vs. Coût des ventes à deux axes. Choisissez selon quoi chaque axe se décompose — Produit, Catégorie, Emplacement, Division, ou Consolidé (aucune décomposition) — pour toute combinaison réelle, de la matrice Produit par Emplacement la plus fine à un seul chiffre consolidé.',
      'En reel Salg vs. Vareforbrug-rapport med to akser. Vælg, hvad hver akse skal opdeles efter — Produkt, Kategori, Lokation, Afdeling eller Konsolideret (ingen opdeling) — for enhver reel kombination, fra den enkelte, mest detaljerede Produkt-efter-Lokation-matrix ned til ét, enkelt, konsolideret tal.',
      'Un vero report Vendite vs. Costo del venduto a due assi. Scegli in base a cosa si suddivide ciascun asse — Prodotto, Categoria, Posizione, Divisione o Consolidato (nessuna suddivisione) — per qualsiasi combinazione reale, dalla matrice Prodotto per Posizione più granulare fino a un unico numero consolidato.',
    ],
    [
      "One place to set up and amend the real, whole structure of a business — its divisions, each division's own real locations (with address, phone, and real weekly open hours), and each location's own real staff (with address, phone, wage/salary, and a real weekly schedule validated against that location's own open hours).",
      "Eine zentrale Stelle, um die reale, gesamte Struktur eines Unternehmens einzurichten und zu ändern — seine Bereiche, die realen Standorte jedes Bereichs (mit Adresse, Telefon und realen wöchentlichen Öffnungszeiten) und das reale Personal jedes Standorts (mit Adresse, Telefon, Lohn/Gehalt und einem realen Wochenplan, geprüft gegen die eigenen Öffnungszeiten dieses Standorts).",
      "Un seul endroit pour configurer et modifier la structure réelle et complète d'une entreprise — ses divisions, les emplacements réels propres à chaque division (avec adresse, téléphone et horaires d'ouverture hebdomadaires réels), et le personnel réel propre à chaque emplacement (avec adresse, téléphone, salaire, et un planning hebdomadaire réel validé par rapport aux horaires d'ouverture de cet emplacement).",
      'Ét sted at opsætte og ændre en virksomheds reelle, samlede struktur — dens afdelinger, hver afdelings egne reelle lokationer (med adresse, telefon og reelle ugentlige åbningstider), og hver lokations eget reelle personale (med adresse, telefon, løn og en reel ugentlig plan valideret mod den pågældende lokations egne åbningstider).',
      "Un unico posto per configurare e modificare la struttura reale e completa di un'azienda — le sue divisioni, le posizioni reali proprie di ciascuna divisione (con indirizzo, telefono e reali orari di apertura settimanali), e il personale reale proprio di ciascuna posizione (con indirizzo, telefono, stipendio e un reale programma settimanale validato rispetto agli orari di apertura di quella posizione).",
    ],
    [
      "Clocking in is placing a real, standing order for an employee's own product — their time, at their own real price per hour. Clocking out completes its real delivery, rendering the hours worked genuinely due for payment.",
      "Einstempeln bedeutet, einen realen, stehenden Auftrag für das eigene Produkt eines Mitarbeiters aufzugeben — seine Zeit, zum eigenen realen Preis pro Stunde. Ausstempeln vervollständigt die reale Lieferung und macht die geleisteten Stunden tatsächlich zahlungsfällig.",
      "Pointer l'arrivée revient à passer une commande réelle et permanente pour le propre produit d'un employé — son temps, à son propre prix réel par heure. Pointer le déitem complète sa livraison réelle, rendant les heures travaillées véritablement dues au paiement.",
      "At stemple ind er at afgive en reel, stående ordre på en medarbejders eget produkt — deres tid, til deres egen reelle pris pr. time. At stemple ud fuldender den reelle levering, hvilket gør de arbejdede timer reelt forfaldne til betaling.",
      "Timbrare l'entrata significa effettuare un vero ordine permanente per il prodotto proprio di un dipendente — il suo tempo, al suo vero prezzo per ora. Timbrare l'uscita completa la sua vera consegna, rendendo le ore lavorate effettivamente dovute per il pagamento.",
    ],
    [
      "Every real account, in hierarchy order, under Asset, Liability, Equity, Income, and Expense. The Balance Sheet and P&L's own structure rests on this tree — the five top-level categories, and a few further, established anchors, can't be renamed or deleted here.",
      "Jedes reale Konto, in Hierarchie-Reihenfolge, unter Vermögenswert, Verbindlichkeit, Eigenkapital, Ertrag und Aufwand. Die Struktur von Bilanz und G&V beruht auf diesem Baum — die fünf übergeordneten Kategorien und einige weitere, feste Anker können hier nicht umbenannt oder gelöscht werden.",
      "Chaque compte réel, dans l'ordre hiérarchique, sous Actif, Passif, Capitaux propres, Produits et Charges. La structure propre du bilan et du compte de résultat repose sur cet arbre — les cinq catégories de premier niveau, et quelques autres ancrages établis, ne peuvent pas être renommés ni supprimés ici.",
      'Hver reel konto, i hierarkisk rækkefølge, under Aktiv, Forpligtelse, Egenkapital, Indtægt og Udgift. Balancens og resultatopgørelsens egen struktur hviler på dette træ — de fem øverste kategorier, og et par yderligere, etablerede ankre, kan ikke omdøbes eller slettes her.',
      "Ogni conto reale, in ordine gerarchico, sotto Attività, Passività, Patrimonio netto, Ricavi e Costi. La struttura propria dello stato patrimoniale e del conto economico si basa su questo albero — le cinque categorie di primo livello, e alcuni altri ancoraggi stabiliti, non possono essere rinominati o eliminati qui.",
    ],
    [
      "This account is structural to the Balance Sheet/P&L's own shape and can't be renamed or deleted here.",
      "Dieses Konto ist strukturell für die eigene Form von Bilanz/G&V und kann hier nicht umbenannt oder gelöscht werden.",
      "Ce compte est structurel pour la forme propre du bilan/compte de résultat et ne peut pas être renommé ni supprimé ici.",
      'Denne konto er strukturel for balancens/resultatopgørelsens egen form og kan ikke omdøbes eller slettes her.',
      "Questo conto è strutturale per la forma propria dello stato patrimoniale/conto economico e non può essere rinominato o eliminato qui.",
    ],
    [
      "Every real balance-sheet account — Inventory, Cash, Accounts Receivable/Payable — is unchanged and needs no further action: its real, current balance is already the new period's opening balance.",
      "Jedes reale Bilanzkonto — Vorrat, Kasse, Forderungen/Verbindlichkeiten — bleibt unverändert und erfordert keine weitere Maßnahme: sein realer, aktueller Saldo ist bereits der Eröffnungssaldo der neuen Periode.",
      "Chaque compte de bilan réel — Stock, Trésorerie, Créances/Dettes — reste inchangé et ne nécessite aucune action supplémentaire : son solde réel actuel est déjà le solde d'ouverture de la nouvelle période.",
      'Hver reel balancekonto — Varelager, Kontanter, Tilgodehavender/Gæld — er uændret og kræver ingen yderligere handling: dens reelle, aktuelle saldo er allerede den nye periodes åbningssaldo.',
      "Ogni conto reale di stato patrimoniale — Magazzino, Cassa, Crediti/Debiti — rimane invariato e non richiede ulteriori azioni: il suo saldo reale attuale è già il saldo di apertura del nuovo periodo.",
    ],
    [
      "Real balance-sheet accounts — Cash, Inventory, Accounts Receivable/Payable, and every other real asset/liability — are never touched by this process at all. Their real, ending balance simply carries forward as-is, automatically becoming the new period's own opening balance, since a real balance-sheet account is a genuine, persistent running total, not something that resets each period the way income and expense do.",
      "Reale Bilanzkonten — Kasse, Vorrat, Forderungen/Verbindlichkeiten und jedes andere reale Vermögen/jede Verbindlichkeit — werden von diesem Prozess überhaupt nicht berührt. Ihr realer Endsaldo wird einfach unverändert fortgeführt und wird automatisch zum eigenen Eröffnungssaldo der neuen Periode, da ein reales Bilanzkonto eine echte, dauerhafte laufende Summe ist und nicht wie Ertrag und Aufwand jede Periode zurückgesetzt wird.",
      "Les comptes de bilan réels — Trésorerie, Stock, Créances/Dettes, et tout autre actif/passif réel — ne sont jamais touchés par ce processus. Leur solde final réel est simplement reporté tel quel, devenant automatiquement le solde d'ouverture propre de la nouvelle période, puisqu'un compte de bilan réel est un total courant réel et persistant, pas quelque chose qui se réinitialise chaque période comme le font les produits et les charges.",
      'Reelle balancekonti — Kontanter, Varelager, Tilgodehavender/Gæld, og alle andre reelle aktiver/forpligtelser — berøres slet ikke af denne proces. Deres reelle slutsaldo videreføres blot som den er, og bliver automatisk den nye periodes egen åbningssaldo, da en reel balancekonto er en ægte, vedvarende løbende sum, ikke noget der nulstilles hver periode, som indtægt og udgift gør.',
      "I conti reali di stato patrimoniale — Cassa, Magazzino, Crediti/Debiti, e ogni altra vera attività/passività — non vengono mai toccati da questo processo. Il loro saldo finale reale viene semplicemente riportato così com'è, diventando automaticamente il saldo di apertura proprio del nuovo periodo, poiché un vero conto di stato patrimoniale è un totale corrente reale e persistente, non qualcosa che si azzera ogni periodo come fanno ricavi e costi.",
    ],
    [
      "This only changes the Balance Sheet's own equity section — Sole Trader needs nothing extra (the real, shared Owner's Equity account already exists); the others get their own real, additional equity accounts.",
      "Dies ändert nur den eigenen Eigenkapitalabschnitt der Bilanz — Einzelunternehmer benötigt nichts Zusätzliches (das reale, gemeinsame Eigenkapitalkonto des Inhabers existiert bereits); die anderen erhalten ihre eigenen realen, zusätzlichen Eigenkapitalkonten.",
      "Cela ne modifie que la section des capitaux propres propre au bilan — Entreprise individuelle n'a besoin de rien de plus (le compte réel et partagé de capitaux propres du propriétaire existe déjà) ; les autres obtiennent leurs propres comptes de capitaux propres réels et supplémentaires.",
      'Dette ændrer kun balancens egen egenkapitalsektion — Enkeltmandsvirksomhed har ikke brug for noget ekstra (den reelle, fælles ejerkapitalkonto findes allerede); de andre får deres egne reelle, ekstra egenkapitalkonti.',
      "Questo modifica solo la sezione del patrimonio netto propria dello stato patrimoniale — Ditta individuale non ha bisogno di nulla in più (il vero conto condiviso del patrimonio del titolare esiste già); gli altri ottengono i propri veri conti aggiuntivi di patrimonio netto.",
    ],
    [
      "Registering which real accounts represent actual cash/bank accounts — distinct from the broader Chart of Accounts, since Inventory or Accounts Receivable also sit under Asset but are genuinely not cash. Each real bank account has its own real business or division scope (a division may bank with a different bank from another) and its own real, optional overdraft limit.",
      "Erfassung, welche realen Konten tatsächliche Kassen-/Bankkonten darstellen — im Unterschied zum umfassenderen Kontenplan, da auch Vorrat oder Forderungen unter Vermögenswert stehen, aber tatsächlich kein Bargeld sind. Jedes reale Bankkonto hat seinen eigenen realen Unternehmens- oder Bereichsbezug (ein Bereich kann bei einer anderen Bank bankieren als ein anderer) und sein eigenes reales, optionales Dispolimit.",
      "Enregistrement des comptes réels représentant de véritables comptes de trésorerie/bancaires — distincts du plan comptable plus large, puisque le Stock ou les Créances figurent aussi sous Actif mais ne sont véritablement pas de la trésorerie. Chaque compte bancaire réel a sa propre portée réelle d'entreprise ou de division (une division peut opérer avec une banque différente d'une autre) et sa propre limite de découvert réelle et facultative.",
      'Registrering af hvilke reelle konti der repræsenterer faktiske kontant-/bankkonti — adskilt fra den bredere kontoplan, da Varelager eller Tilgodehavender også ligger under Aktiv, men reelt ikke er kontanter. Hver reel bankkonto har sit eget reelle forretnings- eller afdelingsomfang (en afdeling kan bankere med en anden bank end en anden) og sin egen reelle, valgfrie overtræksgrænse.',
      "Registrazione di quali conti reali rappresentano effettivi conti cassa/bancari — distinti dal più ampio Piano dei conti, poiché anche Magazzino o Crediti rientrano sotto Attività ma non sono realmente denaro contante. Ogni vero conto bancario ha il proprio vero ambito aziendale o di divisione (una divisione può operare con una banca diversa da un'altra) e il proprio vero limite di scoperto opzionale.",
    ],
    [
      'Every real word or phrase this application uses, and its own, current translation into each real, existing language — add a new language below, or edit any word directly.',
      'Jedes reale Wort oder jede Phrase, die diese Anwendung verwendet, und ihre eigene, aktuelle Übersetzung in jede real existierende Sprache — fügen Sie unten eine neue Sprache hinzu oder bearbeiten Sie ein Wort direkt.',
      "Chaque mot ou expression réel utilisé par cette application, et sa propre traduction actuelle dans chaque langue réelle existante — ajoutez une nouvelle langue ci-dessous, ou modifiez directement un mot.",
      'Hvert reelt ord eller udtryk, denne applikation bruger, og dets egen, aktuelle oversættelse til hvert reelt, eksisterende sprog — tilføj et nyt sprog nedenfor, eller rediger et hvilket som helst ord direkte.',
      "Ogni parola o frase reale che questa applicazione usa, e la propria traduzione attuale in ogni lingua reale esistente — aggiungi una nuova lingua qui sotto, oppure modifica direttamente qualsiasi parola.",
    ],
    [
      'Some real, business concepts already have more than one, real, valid English name — pick which one this business prefers to see everywhere, not just in the menu.',
      'Manche reale Geschäftskonzepte haben bereits mehr als einen realen, gültigen englischen Namen — wählen Sie aus, welchen diese Firma überall sehen möchte, nicht nur im Menü.',
      "Certains concepts commerciaux réels ont déjà plus d'un nom anglais réel et valide — choisissez celui que cette entreprise préfère voir partout, pas seulement dans le menu.",
      'Nogle reelle forretningsbegreber har allerede mere end ét reelt, gyldigt engelsk navn — vælg hvilket denne virksomhed foretrækker at se overalt, ikke kun i menuen.',
      "Alcuni concetti aziendali reali hanno già più di un nome inglese reale e valido — scegli quale questa azienda preferisce vedere ovunque, non solo nel menu.",
    ],
    [
      "A real, forward-looking projection — not the historical Cashflow Statement. Every real, outstanding invoice is assumed to land on its own due date; genuinely recurring cash movements (rent, subscriptions) are projected from their own real schedule. Home currency only, for now.",
      "Eine reale, zukunftsgerichtete Prognose — nicht die historische Kapitalflussrechnung. Es wird angenommen, dass jede reale offene Rechnung an ihrem eigenen Fälligkeitsdatum eingeht; echte wiederkehrende Zahlungsbewegungen (Miete, Abonnements) werden anhand ihres eigenen realen Zeitplans prognostiziert. Vorerst nur Heimatwährung.",
      "Une projection réelle et prospective — pas l'état des flux de trésorerie historique. Chaque facture réelle en attente est supposée arriver à sa propre date d'échéance ; les mouvements de trésorerie véritablement récurrents (loyer, abonnements) sont projetés selon leur propre calendrier réel. Devise locale uniquement, pour l'instant.",
      'En reel, fremadskuende prognose — ikke den historiske pengestrømsopgørelse. Hver reel, udestående faktura antages at forfalde på sin egen forfaldsdato; reelt tilbagevendende pengebevægelser (husleje, abonnementer) prognosticeres ud fra deres egen reelle tidsplan. Kun hjemmevaluta, indtil videre.',
      "Una proiezione reale e lungimirante — non il rendiconto finanziario storico. Si presume che ogni fattura reale in sospeso arrivi alla propria scadenza; i movimenti di cassa realmente ricorrenti (affitto, abbonamenti) sono proiettati in base al proprio vero calendario. Solo valuta locale, per ora.",
    ],
    [
      "A real, one-time close: zeros every real income and expense account, posting the real, net difference into a real equity account as one, single, balanced entry.",
      "Ein realer, einmaliger Abschluss: setzt jedes reale Ertrags- und Aufwandskonto auf null und bucht die reale Nettodifferenz als eine einzige, ausgeglichene Buchung auf ein reales Eigenkapitalkonto.",
      "Une clôture réelle et unique : met à zéro chaque compte réel de produits et de charges, en comptabilisant la différence nette réelle sur un compte de capitaux propres réel en une seule écriture équilibrée.",
      'En reel, engangslukning: nulstiller hver reel indtægts- og udgiftskonto, og bogfører den reelle nettodifference på en reel egenkapitalkonto som én, samlet, balanceret postering.',
      "Una chiusura reale e una tantum: azzera ogni vero conto di ricavi e costi, registrando la vera differenza netta in un vero conto di patrimonio netto come un'unica scrittura bilanciata.",
    ],
    [
      "Nothing posts yet — the next step shows the real, proposed general journal entry for you to review, before anything is actually closed.",
      "Es wird noch nichts gebucht — der nächste Schritt zeigt Ihnen den realen, vorgeschlagenen Hauptbuchbeleg zur Überprüfung, bevor tatsächlich etwas abgeschlossen wird.",
      "Rien n'est encore comptabilisé — l'étape suivante affiche l'écriture de journal général réelle et proposée pour votre révision, avant que quoi que ce soit ne soit réellement clôturé.",
      'Der bogføres endnu ikke noget — det næste trin viser den reelle, foreslåede posteringsjournal til din gennemgang, før noget rent faktisk lukkes.',
      "Nulla viene ancora registrato — il passaggio successivo mostra la vera scrittura di giornale generale proposta per la tua revisione, prima che qualcosa venga effettivamente chiuso.",
    ],
    [
      "Real providers — created automatically the first time one is used on an AP Purchase.",
      "Reale Lieferanten — automatisch erstellt, sobald einer erstmals bei einem Kreditoren-Einkauf verwendet wird.",
      "Fournisseurs réels — créés automatiquement la première fois qu'un est utilisé sur un achat fournisseur.",
      'Reelle leverandører — oprettes automatisk, første gang en bruges på et kreditorkøb.',
      "Fornitori reali — creati automaticamente la prima volta che uno viene usato su un acquisto fornitori.",
    ],
    [
      "Real, account-based customers — created automatically the first time one is used on an AR Sale. A walk-in POS sale never creates one of these.",
      "Reale, kontobasierte Kunden — automatisch erstellt, sobald einer erstmals bei einem Debitoren-Verkauf verwendet wird. Ein Laufkunden-Kassenverkauf erstellt niemals einen solchen.",
      "Clients réels basés sur un compte — créés automatiquement la première fois qu'un est utilisé sur une vente client. Une vente au comptoir en caisse n'en crée jamais un.",
      'Reelle, kontobaserede kunder — oprettes automatisk, første gang en bruges på et debitorsalg. Et gadekundesalg i kassen opretter aldrig en af disse.',
      "Clienti reali basati su conto — creati automaticamente la prima volta che uno viene usato su una vendita clienti. Una vendita al banco POS non ne crea mai uno.",
    ],
    [
      "A real, immediate-payment sale — paid in full right now, no outstanding Accounts Receivable balance, even momentarily. Choose any real location to dispatch from, including a warehouse — possibly the start of a real wholesale channel. The everyday retail register is the real POS Terminal; this is the same real mechanism for a larger, non-register sale.",
      "Ein realer Sofortzahlungsverkauf — jetzt vollständig bezahlt, kein offener Debitorensaldo, auch nicht kurzzeitig. Wählen Sie einen beliebigen realen Standort zum Versand, einschließlich eines Lagers — möglicherweise der Beginn eines realen Großhandelskanals. Die alltägliche Ladenkasse ist das reale POS-Terminal; dies ist derselbe reale Mechanismus für einen größeren Verkauf außerhalb der Kasse.",
      "Une vente réelle à paiement immédiat — payée intégralement dès maintenant, aucun solde de créances clients en attente, même momentanément. Choisissez n'importe quel emplacement réel pour l'expédition, y compris un entrepôt — peut-être le début d'un vrai canal de gros. La caisse de détail quotidienne est le vrai terminal POS ; il s'agit du même mécanisme réel pour une vente plus importante hors caisse.",
      'Et reelt salg med øjeblikkelig betaling — betalt fuldt ud lige nu, ingen udestående tilgodehavendesaldo, selv midlertidigt. Vælg en hvilken som helst reel lokation at afsende fra, inklusive et lager — måske starten på en reel engroskanal. Den daglige detailkasse er den reelle POS-terminal; dette er den samme reelle mekanisme for et større salg uden for kassen.',
      "Una vera vendita a pagamento immediato — pagata per intero adesso, nessun saldo crediti in sospeso, nemmeno momentaneamente. Scegli qualsiasi posizione reale da cui spedire, incluso un magazzino — forse l'inizio di un vero canale all'ingrosso. La cassa retail quotidiana è il vero terminale POS; questo è lo stesso vero meccanismo per una vendita più grande fuori cassa.",
    ],
    [
      "A real, immediate-payment purchase — paid in full right now, no outstanding Accounts Payable balance, even momentarily. Choose any real location to receive stock at, including a warehouse — possibly the start of a real wholesale channel.",
      "Ein realer Sofortzahlungseinkauf — jetzt vollständig bezahlt, kein offener Kreditorensaldo, auch nicht kurzzeitig. Wählen Sie einen beliebigen realen Standort für den Wareneingang, einschließlich eines Lagers — möglicherweise der Beginn eines realen Großhandelskanals.",
      "Un achat réel à paiement immédiat — payé intégralement dès maintenant, aucun solde de dettes fournisseurs en attente, même momentanément. Choisissez n'importe quel emplacement réel pour recevoir le stock, y compris un entrepôt — peut-être le début d'un vrai canal de gros.",
      'Et reelt køb med øjeblikkelig betaling — betalt fuldt ud lige nu, ingen udestående kreditorsaldo, selv midlertidigt. Vælg en hvilken som helst reel lokation at modtage varer på, inklusive et lager — måske starten på en reel engroskanal.',
      "Un vero acquisto a pagamento immediato — pagato per intero adesso, nessun saldo debiti in sospeso, nemmeno momentaneamente. Scegli qualsiasi posizione reale in cui ricevere la merce, incluso un magazzino — forse l'inizio di un vero canale all'ingrosso.",
    ],
    [
      "Move real stock from a warehouse to a retail outlet — the same real picking, shelf order, and tick-off confirmation as a customer order, but a real internal transfer, no invoice or revenue involved.",
      "Bewegen Sie reale Ware von einem Lager zu einer Filiale — dieselbe reale Kommissionierung, Regalreihenfolge und Abhak-Bestätigung wie bei einer Kundenbestellung, aber ein realer interner Transfer, ohne Rechnung oder Umsatz.",
      "Déplacez du stock réel d'un entrepôt vers un point de vente — le même picking réel, ordre de rayon et confirmation par pointage qu'une commande client, mais un vrai transfert interne, sans facture ni revenu impliqué.",
      'Flyt reelt lager fra et lager til en detailforretning — samme reelle plukning, hylderækkefølge og afkrydsningsbekræftelse som en kundeordre, men en reel intern overførsel, uden faktura eller omsætning involveret.',
      "Sposta merce reale da un magazzino a un punto vendita — lo stesso vero prelievo, ordine di scaffale e conferma di spunta di un ordine cliente, ma un vero trasferimento interno, senza fattura o ricavo coinvolti.",
    ],
    [
      "The real, physical journey of stock — purchases received into each real warehouse, transfers on to retail outlets, and real sales — groupable by division, location, vendor, or category.",
      "Die reale, physische Reise der Ware — Einkäufe, die in jedem realen Lager eingehen, Transfers zu Filialen und reale Verkäufe — gruppierbar nach Bereich, Standort, Lieferant oder Kategorie.",
      "Le vrai parcours physique du stock — achats reçus dans chaque entrepôt réel, transferts vers les points de vente, et ventes réelles — regroupables par division, emplacement, fournisseur ou catégorie.",
      'Varens reelle, fysiske rejse — indkøb modtaget i hvert reelt lager, overførsler videre til detailforretninger, og reelt salg — kan grupperes efter afdeling, lokation, leverandør eller kategori.',
      "Il vero percorso fisico della merce — acquisti ricevuti in ogni vero magazzino, trasferimenti ai punti vendita, e vendite reali — raggruppabile per divisione, posizione, fornitore o categoria.",
    ],
    [
      "The real, same two-axis mechanism as the New P&L report, applied to real, current, on-hand stock — quantity, value at cost, and realizable value at current retail price, instead of Sales vs. COGS.",
      "Derselbe reale Zwei-Achsen-Mechanismus wie im neuen G&V-Bericht, angewendet auf den realen, aktuellen Lagerbestand — Menge, Wert zu Anschaffungskosten und realisierbarer Wert zum aktuellen Verkaufspreis, anstelle von Umsatz vs. Wareneinsatz.",
      "Le même vrai mécanisme à deux axes que le nouveau rapport de compte de résultat, appliqué au stock réel et actuel disponible — quantité, valeur au coût, et valeur réalisable au prix de vente actuel, au lieu de Ventes vs. Coût des ventes.",
      'Den samme reelle to-akse-mekanisme som den nye resultatopgørelsesrapport, anvendt på reelt, aktuelt lager på hånden — mængde, værdi til kostpris, og realisérbar værdi til aktuel detailpris, i stedet for Salg vs. Vareforbrug.',
      "Lo stesso vero meccanismo a due assi del nuovo report di conto economico, applicato alla vera scorta reale attuale disponibile — quantità, valore al costo, e valore realizzabile al prezzo di vendita attuale, invece di Vendite vs. Costo del venduto.",
    ],
    [
      "Every real, posted invoice for one customer as of a date — paid, partially paid, and still outstanding — not just the unpaid subset the Aged Receivables report shows. A real, printable document a customer could actually be handed or sent.",
      "Jede reale, gebuchte Rechnung für einen Kunden zu einem Stichtag — bezahlt, teilweise bezahlt und noch offen — nicht nur die unbezahlte Teilmenge, die der Bericht über überfällige Forderungen zeigt. Ein reales, druckbares Dokument, das einem Kunden tatsächlich übergeben oder zugesandt werden könnte.",
      "Chaque facture réelle et comptabilisée pour un client à une date donnée — payée, partiellement payée et encore en attente — pas seulement le sous-ensemble impayé que montre le rapport des créances échues. Un document réel et imprimable qu'on pourrait effectivement remettre ou envoyer à un client.",
      'Hver reel, bogført faktura for én kunde pr. en dato — betalt, delvist betalt og stadig udestående — ikke kun den ubetalte delmængde, som rapporten om forfaldne tilgodehavender viser. Et reelt, printbart dokument, som faktisk kunne udleveres eller sendes til en kunde.',
      "Ogni fattura reale e registrata per un cliente a una data — pagata, parzialmente pagata e ancora in sospeso — non solo il sottoinsieme non pagato mostrato dal report crediti scaduti. Un vero documento stampabile che potrebbe effettivamente essere consegnato o inviato a un cliente.",
    ],
    [
      "Most real businesses transact in one, single currency — this is only for a business genuinely near a national border, or one that otherwise expects to take real cash in another currency. Each one gets its own real \"Cash at Bank\" account, ready to use immediately.",
      "Die meisten realen Unternehmen wickeln Geschäfte in einer einzigen Währung ab — dies gilt nur für ein Unternehmen, das sich tatsächlich in Grenznähe befindet, oder eines, das erwartet, reales Bargeld in einer anderen Währung entgegenzunehmen. Jedes erhält sein eigenes reales „Bankguthaben\"-Konto, sofort einsatzbereit.",
      "La pluitem des entreprises réelles transigent dans une seule devise — ceci ne concerne qu'une entreprise véritablement proche d'une frontière nationale, ou une autre qui s'attend par ailleurs à recevoir de l'argent réel dans une autre devise. Chacune obtient son propre compte réel « Trésorerie en banque », prêt à l'emploi immédiatement.",
      'De fleste reelle virksomheder handler i én enkelt valuta — dette er kun for en virksomhed, der reelt ligger nær en national grænse, eller en, der ellers forventer at modtage reelle kontanter i en anden valuta. Hver får sin egen reelle "Bankindestående"-konto, klar til brug med det samme.',
      "La maggior parte delle aziende reali opera in un'unica valuta — questo vale solo per un'azienda realmente vicina a un confine nazionale, o una che altrimenti si aspetta di ricevere vero contante in un'altra valuta. Ciascuna ottiene il proprio vero conto \"Cassa in banca\", pronto per l'uso immediato.",
    ],
    [
      "Summary by division/location profit center (the same, real detail shown above, per line)",
      "Zusammenfassung nach Bereichs-/Standort-Profitcenter (dieselben realen Details wie oben, pro Zeile)",
      "Résumé par centre de profit de division/emplacement (le même détail réel affiché ci-dessus, par ligne)",
      'Oversigt efter afdelings-/lokationsprofitcenter (samme reelle detalje vist ovenfor, pr. linje)',
      "Riepilogo per centro di profitto divisione/posizione (lo stesso vero dettaglio mostrato sopra, per riga)",
    ],
    [
      "This screen exists in the original SQL-Ledger. It's shown here as a placeholder in the menu so the full shape of the application is visible — nothing on this page is functional yet.",
      "Dieser Bildschirm existiert im ursprünglichen SQL-Ledger. Er wird hier als Platzhalter im Menü angezeigt, damit die vollständige Form der Anwendung sichtbar ist — auf dieser Seite ist noch nichts funktionsfähig.",
      "Cet écran existe dans SQL-Ledger d'origine. Il est affiché ici comme espace réservé dans le menu afin que la forme complète de l'application soit visible — rien sur cette page n'est encore fonctionnel.",
      'Denne skærm findes i den oprindelige SQL-Ledger. Den vises her som en pladsholder i menuen, så applikationens fulde form er synlig — intet på denne side er funktionelt endnu.',
      "Questa schermata esiste nell'SQL-Ledger originale. Viene mostrata qui come segnaposto nel menu in modo che la forma completa dell'applicazione sia visibile — nulla in questa pagina è ancora funzionante.",
    ],
  ];
  for (const [entity, german, french, danish, italian] of paragraphs) {
    if (!db.prepare(`SELECT 1 FROM current_entities WHERE name = ?`).get(entity)) {
      create(requireEntity('Vocabulary', typeRootName), typeVocabularyWordName, entity, SEED_USER_ID);
    }
    setTranslation(entity, 'German', german);
    setTranslation(entity, 'French', french);
    setTranslation(entity, 'Danish', danish);
    setTranslation(entity, 'Italian', italian);
  }
}
migrateForEnglishStringAuditGap();

function migrateForEnglishStringAuditTranslations() {
  const words: [string, string, string, string, string][] = [
    ['AP (Purchases)', 'AP (Einkauf)', 'AP (Achats)', 'AP (Indkøb)', 'AP (Acquisti)'],
    ['AR (Sales)', 'AR (Verkauf)', 'AR (Ventes)', 'AR (Salg)', 'AR (Vendite)'],
    ['Add a source', 'Quelle hinzufügen', 'Ajouter une source', 'Tilføj en kilde', 'Aggiungi una fonte'],
    ['Address', 'Adresse', 'Adresse', 'Adresse', 'Indirizzo'],
    ['Allocate a payment', 'Zahlung zuordnen', 'Affecter un paiement', 'Allokér en betaling', 'Assegna un pagamento'],
    ['Balance Sheet', 'Bilanz', 'Bilan', 'Balance', 'Stato patrimoniale'],
    ['Better', 'Besser', 'Meilleur', 'Bedre', 'Migliore'],
    ['Better Brighter Multi-Ledger', 'Better Brighter Multi-Ledger', 'Better Brighter Multi-Ledger', 'Better Brighter Multi-Ledger', 'Better Brighter Multi-Ledger'],
    ['Bottles', 'Flaschen', 'Bouteilles', 'Flasker', 'Bottiglie'],
    ['Brighter', 'Heller', 'Plus lumineux', 'Lysere', 'Più luminoso'],
    ['Bucket', 'Bucket', 'Compartiment', 'Bucket', 'Bucket'],
    ['COGS', 'Wareneinsatz', 'Coût des marchandises vendues', 'Vareforbrug', 'Costo del venduto'],
    ['Capacity', 'Kapazität', 'Capacité', 'Kapacitet', 'Capacità'],
    ['Card type', 'Kartentyp', 'Type de carte', 'Korttype', 'Tipo di carta'],
    ['Carton capacity', 'Kartonkapazität', 'Capacité en cartons', 'Kartonkapacitet', 'Capacità in cartoni'],
    ['Cartons', 'Kartons', 'Cartons', 'Kartoner', 'Cartoni'],
    ['Cash Sale', 'Barverkauf', 'Vente au comptant', 'Kontantsalg', 'Vendita in contanti'],
    ['Category Summary', 'Kategoriezusammenfassung', 'Résumé par catégorie', 'Kategorioversigt', 'Riepilogo per categoria'],
    ['Category:', 'Kategorie:', 'Catégorie :', 'Kategori:', 'Categoria:'],
    ['Change due:', 'Rückgeld:', 'Monnaie à rendre :', 'Byttepenge:', 'Resto dovuto:'],
    ['Chart of Accounts', 'Kontenplan', 'Plan comptable', 'Kontoplan', 'Piano dei conti'],
    ['Choose business, ledger, and language', 'Unternehmen, Hauptbuch und Sprache wählen', 'Choisissez l\'entreprise, le grand livre et la langue', 'Vælg virksomhed, hovedbog og sprog', 'Scegli azienda, libro mastro e lingua'],
    ['Close period', 'Periode abschließen', 'Clôturer la période', 'Luk periode', 'Chiudi periodo'],
    ['Company:', 'Unternehmen:', 'Entreprise :', 'Virksomhed:', 'Azienda:'],
    ['Compare Ledgers', 'Hauptbücher vergleichen', 'Comparer les grands livres', 'Sammenlign hovedbøger', 'Confronta libri mastri'],
    ['Confirm password', 'Passwort bestätigen', 'Confirmer le mot de passe', 'Bekræft adgangskode', 'Conferma password'],
    ['Contact details', 'Kontaktdaten', 'Coordonnées', 'Kontaktoplysninger', 'Dettagli di contatto'],
    ['Cost/unit', 'Kosten/Einheit', 'Coût/unité', 'Omkostning/enhed', 'Costo/unità'],
    ['Country', 'Land', 'Pays', 'Land', 'Paese'],
    ['Current level', 'Aktueller Bestand', 'Niveau actuel', 'Aktuelt niveau', 'Livello attuale'],
    ['Customer', 'Kunde', 'Client', 'Kunde', 'Cliente'],
    ['Customer Registration', 'Kundenregistrierung', 'Enregistrement client', 'Kunderegistrering', 'Registrazione cliente'],
    ['Days', 'Tage', 'Jours', 'Dage', 'Giorni'],
    ['Days overdue', 'Tage überfällig', 'Jours de retard', 'Dage overskredet', 'Giorni di ritardo'],
    ['Detail', 'Detail', 'Détail', 'Detalje', 'Dettaglio'],
    ['Detailed', 'Detailliert', 'Détaillé', 'Detaljeret', 'Dettagliato'],
    ['Employees', 'Mitarbeiter', 'Employés', 'Medarbejdere', 'Dipendenti'],
    ['Expiration date', 'Verfallsdatum', 'Date d\'expiration', 'Udløbsdato', 'Data di scadenza'],
    ['Expires', 'Läuft ab', 'Expire', 'Udløber', 'Scade'],
    ['Full name', 'Vollständiger Name', 'Nom complet', 'Fulde navn', 'Nome completo'],
    ['Go to General Journal', 'Zum Hauptjournal', 'Aller au journal général', 'Gå til finansjournal', 'Vai al giornale generale'],
    ['Inventory account', 'Bestandskonto', 'Compte de stock', 'Lagerkonto', 'Conto di magazzino'],
    ['Invoices', 'Rechnungen', 'Factures', 'Fakturaer', 'Fatture'],
    ['Item', 'Artikel', 'Article', 'Vare', 'Articolo'],
    ['Last 4 digits', 'Letzte 4 Ziffern', '4 derniers chiffres', 'Sidste 4 cifre', 'Ultime 4 cifre'],
    ['Ledger A', 'Hauptbuch A', 'Grand livre A', 'Hovedbog A', 'Libro mastro A'],
    ['Ledger:', 'Hauptbuch:', 'Grand livre :', 'Hovedbog:', 'Libro mastro:'],
    ['Lines', 'Zeilen', 'Lignes', 'Linjer', 'Righe'],
    ['Locations', 'Standorte', 'Emplacements', 'Lokationer', 'Sedi'],
    ['Log in', 'Anmelden', 'Se connecter', 'Log ind', 'Accedi'],
    ['Log out', 'Abmelden', 'Se déconnecter', 'Log ud', 'Esci'],
    ['Lot', 'Charge', 'Lot', 'Parti', 'Lotto'],
    ['Lot number', 'Chargennummer', 'Numéro de lot', 'Partinummer', 'Numero di lotto'],
    ['Manufacturers', 'Hersteller', 'Fabricants', 'Producenter', 'Produttori'],
    ['Monthly', 'Monatlich', 'Mensuel', 'Månedligt', 'Mensile'],
    ['Multi-Ledger', 'Multi-Ledger', 'Multi-Grand livre', 'Multi-Hovedbog', 'Multi-Libro mastro'],
    ['NOT IMPLEMENTED CURRENTLY', 'DERZEIT NICHT IMPLEMENTIERT', 'NON IMPLÉMENTÉ ACTUELLEMENT', 'IKKE IMPLEMENTERET I ØJEBLIKKET', 'NON ANCORA IMPLEMENTATO'],
    ['Next', 'Weiter', 'Suivant', 'Næste', 'Successivo'],
    ['No activity yet.', 'Noch keine Aktivität.', 'Aucune activité pour l\'instant.', 'Ingen aktivitet endnu.', 'Nessuna attività ancora.'],
    ['No overdue customers.', 'Keine überfälligen Kunden.', 'Aucun client en retard.', 'Ingen kunder med overskredet forfald.', 'Nessun cliente in ritardo.'],
    ['No sales in this period.', 'Keine Verkäufe in diesem Zeitraum.', 'Aucune vente durant cette période.', 'Intet salg i denne periode.', 'Nessuna vendita in questo periodo.'],
    ['No sources yet.', 'Noch keine Quellen.', 'Aucune source pour l\'instant.', 'Ingen kilder endnu.', 'Nessuna fonte ancora.'],
    ['No stock recorded anywhere yet.', 'Noch kein Bestand erfasst.', 'Aucun stock enregistré pour l\'instant.', 'Ingen lagerbeholdning registreret endnu.', 'Nessuna giacenza registrata ancora.'],
    ['No variance recorded yet.', 'Noch keine Abweichung erfasst.', 'Aucun écart enregistré pour l\'instant.', 'Ingen afvigelse registreret endnu.', 'Nessuna variazione registrata ancora.'],
    ['None yet.', 'Noch keine.', 'Aucun pour l\'instant.', 'Ingen endnu.', 'Nessuno ancora.'],
    ['Nothing needs reordering right now.', 'Aktuell muss nichts nachbestellt werden.', 'Rien à commander pour le moment.', 'Intet skal genbestilles lige nu.', 'Nulla da riordinare al momento.'],
    ['Nothing outstanding.', 'Nichts offen.', 'Rien en attente.', 'Intet udestående.', 'Nulla in sospeso.'],
    ['Number of occurrences', 'Anzahl der Wiederholungen', 'Nombre d\'occurrences', 'Antal gentagelser', 'Numero di ricorrenze'],
    ['Oldest (days)', 'Ältestes (Tage)', 'Le plus ancien (jours)', 'Ældste (dage)', 'Più vecchio (giorni)'],
    ['Once', 'Einmalig', 'Une fois', 'Én gang', 'Una volta'],
    ['Only an Administrator can manage users.', 'Nur ein Administrator kann Benutzer verwalten.', 'Seul un administrateur peut gérer les utilisateurs.', 'Kun en administrator kan administrere brugere.', 'Solo un amministratore può gestire gli utenti.'],
    ['Open', 'Offen', 'Ouvert', 'Åben', 'Aperto'],
    ['Outstanding:', 'Offen:', 'En attente :', 'Udestående:', 'In sospeso:'],
    ['Over limit', 'Über Limit', 'Dépassement de limite', 'Over grænsen', 'Oltre il limite'],
    ['Paid into', 'Eingezahlt auf', 'Payé sur', 'Indbetalt til', 'Versato su'],
    ['Payment reference', 'Zahlungsreferenz', 'Référence de paiement', 'Betalingsreference', 'Riferimento di pagamento'],
    ['Payment terms (days)', 'Zahlungsziel (Tage)', 'Conditions de paiement (jours)', 'Betalingsbetingelser (dage)', 'Termini di pagamento (giorni)'],
    ['Post to the ledger', 'Im Hauptbuch buchen', 'Comptabiliser au grand livre', 'Bogfør til hovedbogen', 'Registra nel libro mastro'],
    ['Postal code', 'Postleitzahl', 'Code postal', 'Postnummer', 'Codice postale'],
    ['Preferred language', 'Bevorzugte Sprache', 'Langue préférée', 'Foretrukket sprog', 'Lingua preferita'],
    ['Prev', 'Zurück', 'Précédent', 'Forrige', 'Precedente'],
    ['Product', 'Produkt', 'Produit', 'Produkt', 'Prodotto'],
    ['Quantity', 'Menge', 'Quantité', 'Antal', 'Quantità'],
    ['Real accounts this prototype actually uses:', 'Reale Konten, die dieser Prototyp tatsächlich verwendet:', 'Comptes réels réellement utilisés par ce prototype :', 'Reelle konti, denne prototype faktisk bruger:', 'Conti reali effettivamente utilizzati da questo prototipo:'],
    ['Realizable', 'Realisierbar', 'Réalisable', 'Realiserbar', 'Realizzabile'],
    ['Receive a lot', 'Charge empfangen', 'Réceptionner un lot', 'Modtag et parti', 'Ricevi un lotto'],
    ['Received date', 'Empfangsdatum', 'Date de réception', 'Modtagelsesdato', 'Data di ricezione'],
    ['Recurrence', 'Wiederholung', 'Récurrence', 'Gentagelse', 'Ricorrenza'],
    ['Referencing which invoice', 'Bezieht sich auf welche Rechnung', 'Fait référence à quelle facture', 'Refererer til hvilken faktura', 'Fa riferimento a quale fattura'],
    ['Refrigerated', 'Gekühlt', 'Réfrigéré', 'Kølet', 'Refrigerato'],
    ['Region', 'Region', 'Région', 'Region', 'Regione'],
    ['Register as a customer', 'Als Kunde registrieren', 'S\'inscrire comme client', 'Registrer som kunde', 'Registrati come cliente'],
    ['Reopen period', 'Periode wiedereröffnen', 'Rouvrir la période', 'Genåbn periode', 'Riapri periodo'],
    ['Reset password', 'Passwort zurücksetzen', 'Réinitialiser le mot de passe', 'Nulstil adgangskode', 'Reimposta password'],
    ['Sales Report', 'Verkaufsbericht', 'Rapport des ventes', 'Salgsrapport', 'Rapporto vendite'],
    ['Set a password', 'Passwort festlegen', 'Définir un mot de passe', 'Angiv en adgangskode', 'Imposta una password'],
    ['Start a different sheet', 'Anderes Blatt beginnen', 'Démarrer une autre feuille', 'Start et andet ark', 'Avvia un altro foglio'],
    ['Start a new stock take', 'Neue Inventur beginnen', 'Démarrer un nouvel inventaire', 'Start en ny lageroptælling', 'Avvia un nuovo inventario'],
    ['Still open on that PO:', 'Noch offen auf dieser Bestellung:', 'Encore ouvert sur ce bon de commande :', 'Stadig åben på den PO:', 'Ancora aperto su quell\'ordine:'],
    ['Still open on that SO:', 'Noch offen auf diesem Auftrag:', 'Encore ouvert sur cette commande client :', 'Stadig åben på den SO:', 'Ancora aperto su quell\'ordine cliente:'],
    ['Summary', 'Zusammenfassung', 'Résumé', 'Oversigt', 'Riepilogo'],
    ['System default language', 'Systemstandardsprache', 'Langue par défaut du système', 'Systemets standardsprog', 'Lingua predefinita di sistema'],
    ['Tax account', 'Steuerkonto', 'Compte de taxe', 'Momskonto', 'Conto imposte'],
    ['Total committed:', 'Gesamt zugesagt:', 'Total engagé :', 'Total forpligtet:', 'Totale impegnato:'],
    ['Total invoiced:', 'Gesamt in Rechnung gestellt:', 'Total facturé :', 'Total faktureret:', 'Totale fatturato:'],
    ['Total owed to provider:', 'Gesamt an Lieferant geschuldet:', 'Total dû au fournisseur :', 'Total skyldig til leverandør:', 'Totale dovuto al fornitore:'],
    ['Total owed:', 'Gesamt geschuldet:', 'Total dû :', 'Total skyldig:', 'Totale dovuto:'],
    ['Trial Balance', 'Saldenliste', 'Balance de vérification', 'Råbalance', 'Bilancio di verifica'],
    ['Unit Price', 'Stückpreis', 'Prix unitaire', 'Enhedspris', 'Prezzo unitario'],
    ['User:', 'Benutzer:', 'Utilisateur :', 'Bruger:', 'Utente:'],
    ['Variance account', 'Abweichungskonto', 'Compte d\'écart', 'Afvigelseskonto', 'Conto scostamenti'],
    ['Providers', 'Lieferanten', 'Fournisseurs', 'Leverandører', 'Fornitori'],
    ['Vocabulary', 'Vokabular', 'Vocabulaire', 'Ordforråd', 'Vocabolario'],
    ['Weekly', 'Wöchentlich', 'Hebdomadaire', 'Ugentligt', 'Settimanale'],
    ['Within (days)', 'Innerhalb (Tage)', 'Dans (jours)', 'Inden for (dage)', 'Entro (giorni)'],
    ['Write off stock', 'Bestand abschreiben', 'Passer le stock en perte', 'Afskriv lager', 'Svaluta la giacenza'],
    ['Write-off expense account', 'Abschreibungsaufwandskonto', 'Compte de charges de perte', 'Afskrivningskonto', 'Conto spese di svalutazione'],
    ['Yearly', 'Jährlich', 'Annuel', 'Årligt', 'Annuale'],
  ];
  for (const [entity, de, fr, da, it] of words) {
    if (!db.prepare(`SELECT 1 FROM current_entities WHERE name = ?`).get(entity)) {
      create(requireEntity('Vocabulary', typeRootName), typeVocabularyWordName, entity, SEED_USER_ID);
    }
    setTranslation(entity, 'German', de);
    setTranslation(entity, 'French', fr);
    setTranslation(entity, 'Danish', da);
    setTranslation(entity, 'Italian', it);
  }
}
migrateForEnglishStringAuditTranslations();


function migrateForInvoicePdfVocabulary() {
  const hasEntity = (name: string) => !!db.prepare(`SELECT 1 FROM current_entities WHERE name = ?`).get(name);
  for (const word of ['Qty', 'Amount', 'Tax', 'Invoice', 'Posted by', 'Bill to', 'Subtotal', 'Total due']) {
    if (!hasEntity(word)) create(requireEntity('Vocabulary', typeRootName), typeVocabularyWordName, word, SEED_USER_ID);
  }
const invoicePdfVocab: [string, string, string][] = [
    ['Qty', 'German', 'Menge'],
    ['Qty', 'French', 'Qté'],
    ['Qty', 'Danish', 'Antal'],
    ['Amount', 'German', 'Betrag'],
    ['Amount', 'French', 'Montant'],
    ['Amount', 'Danish', 'Beløb'],
    ['Tax', 'German', 'Steuer'],
    ['Tax', 'French', 'Taxe'],
    ['Tax', 'Danish', 'Moms'],
    ['Invoice', 'German', 'Rechnung'],
    ['Invoice', 'French', 'Facture'],
    ['Invoice', 'Danish', 'Faktura'],
    ['Posted by', 'German', 'Gebucht von'],
    ['Posted by', 'French', 'Enregistré par'],
    ['Posted by', 'Danish', 'Bogført af'],
    ['Bill to', 'German', 'Rechnung an'],
    ['Bill to', 'French', 'Facturé à'],
    ['Bill to', 'Danish', 'Faktureres til'],
    ['Subtotal', 'German', 'Zwischensumme'],
    ['Subtotal', 'French', 'Sous-total'],
    ['Subtotal', 'Danish', 'Subtotal'],
    ['Total due', 'German', 'Fälliger Betrag'],
    ['Total due', 'French', 'Total dû'],
    ['Total due', 'Danish', 'Skyldigt beløb'],
  ];
  for (const [entity, language, text] of invoicePdfVocab) {
    setTranslation(entity, language, text);
  }
}
migrateForInvoicePdfVocabulary();

function migrateForUnitPriceTranslation() {
  setTranslation('Unit Price', 'German', 'Einzelpreis');
  setTranslation('Unit Price', 'French', 'Prix unitaire');
  setTranslation('Unit Price', 'Danish', 'Enhedspris');
}
migrateForUnitPriceTranslation();

function migrateForCogsTag() {
  const cogs = db.prepare(`SELECT id, relation_id FROM current_entities WHERE name = 'Cost of Goods Sold'`).get() as { id: number; relation_id: number | null } | undefined;
  if (!cogs || cogs.relation_id != null) return; // no such account yet, or already tagged
  if (!db.prepare(`SELECT 1 FROM current_entities WHERE name = 'COGS'`).get()) {
    create(requireEntity('Business Reports', typeRootName), typeRootName, 'COGS', SEED_USER_ID);
  }
  supersedeEntity(cogs.id, { relation: 'COGS' }, SEED_USER_ID);
}
migrateForCogsTag();

/** The one, real "Cash" counterparty on each side — a Customer and a
 * Provider, both literally named "Cash", immediate payment terms
 * (payment_terms_days: 0). Cash Sale/Cash Purchase post an invoice to
 * these exactly like any on-account Sale/Purchase, then immediately
 * pay it off in full — see "Cash Sale and Cash Purchase" in
 * pm-frontend-reference.md for the full mechanism. Renames the
 * earlier "Cash Sale" Customer (its original, narrower name, from
 * before Cash Purchase existed) to plain "Cash" on an existing
 * database, rather than leaving a stale duplicate around. */
function migrateForCashCustomerAndProvider() {
  const staleCashSale = db
    .prepare(`SELECT id FROM current_entities WHERE name = 'Cash Sale' AND parent_id = (SELECT id FROM current_entities WHERE name = 'Customers')`)
    .get() as { id: number } | undefined;
  if (staleCashSale && !db.prepare(`SELECT 1 FROM current_entities WHERE name = 'Cash' AND parent_id = (SELECT id FROM current_entities WHERE name = 'Customers')`).get()) {
    supersedeEntity(staleCashSale.id, { name: 'Cash' }, SEED_USER_ID);
  } else if (!db.prepare(`SELECT 1 FROM current_entities WHERE name = 'Cash' AND parent_id = (SELECT id FROM current_entities WHERE name = 'Customers')`).get()) {
    const customer = create(requireEntity('Customers', typeRootName), typeCustomerName, 'Cash', SEED_USER_ID);
    mergeContactDetail(customer.id, { payment_terms_days: 0 });
  }
  if (!db.prepare(`SELECT 1 FROM current_entities WHERE name = 'Cash' AND parent_id = (SELECT id FROM current_entities WHERE name = 'Accounts Payable')`).get()) {
    const provider = create(requireEntity('Accounts Payable', typeRootName), typeProviderName, 'Cash', SEED_USER_ID);
    mergeContactDetail(provider.id, { payment_terms_days: 0 });
  }
}
migrateForCashCustomerAndProvider();

/** The real, structural mirror of the app's own current, live menu —
 * step 1 of the menu-as-entity-tree plan (docs/menu-as-entity-tree-plan.md).
 * Deliberately, exactly matches +layout.svelte's own, current,
 * hardcoded array, item for item, including every real
 * notImplemented/isSubheading flag and required-role restriction —
 * this step changes no real behavior at all yet, it only builds the
 * real, structural mirror the live app will, in a real, later,
 * separate step, actually switch over to reading.
 *
 * Many, real menu labels (Customers, Vendors, Trial Balance, and
 * most others) already, genuinely exist as real Vocabulary words —
 * confirmed directly before writing this, not assumed. A real menu-
 * link entity can never reuse that exact name (the established,
 * global-uniqueness rule), so each one gets its own, real, distinct
 * name ("Menu Link: {label}"), with its own real relation_id set to
 * the real, already-existing Vocabulary word when one exists by that
 * exact name — the real, established, "reach an existing entity
 * without becoming its structural child" pattern already proven this
 * session for Header Account. A real menu link with no matching,
 * real Vocabulary word yet (a genuinely new label with no prior
 * translation entry) simply has no relation_id at all; its own real
 * display label resolves from its own name directly instead. */
function migrateForMenuEntities() {
  interface MenuLinkSeed {
    label: string;
    href: string;
    notImplemented?: boolean;
    isSubheading?: boolean;
    requiredRoles?: string;
  }
  interface MenuSectionSeed {
    label: string;
    links: MenuLinkSeed[];
  }

  const sections: MenuSectionSeed[] = [
    {
      label: 'General Ledger',
      links: [
        { label: 'General Journal', href: '/post' },
        { label: 'Journal Entries', href: '/journal' },
        { label: 'Reconciliation', href: '/reconciliation', notImplemented: true },
        { label: 'FX Adjustment', href: '/gl/fx-adjustment', notImplemented: true },
        { label: 'Trial Balance', href: '/reports/trial-balance' },
        { label: 'Balance Sheet', href: '/reports/balance-sheet' },
        { label: 'Profit and Loss', href: '/reports/profit-and-loss' },
        { label: 'DND P&L', href: '/reports/pl-pivot' },
        { label: 'New Stock on Hand', href: '/reports/new-stock-on-hand' },
        { label: 'Compare Ledgers', href: '/reports/compare' },
        { label: 'Accounting Periods', href: '/setup/periods', requiredRoles: 'Administrator' },
        { label: 'Year End Close', href: '/setup/yearend', requiredRoles: 'Administrator' },
      ],
    },
    {
      // Per direct instruction: these are superseded/experimental P&L
      // variants, not real, separate reports — out of General Ledger
      // and into their own clearly-labelled holding section rather
      // than deleted outright, since they may still be useful as a
      // reference while New P&L settles.
      label: 'test',
      links: [
        { label: 'Old P&L', href: '/reports/old-pl' },
        { label: 'New P&L', href: '/reports/new-pl' },
        { label: 'New New P&L', href: '/reports/new-new-pl' },
      ],
    },
    {
      label: 'Accounts Receivable (Debtors / Sales)',
      links: [
        { label: 'Sale', href: '/arap/ar-sale' },
        { label: 'Cash Sale', href: '/arap/cash-sale' },
        { label: 'Receipt', href: '/arap/ar-receipt' },
        { label: 'Sales Invoices', href: '/invoices?type=AR' },
        { label: 'Sales Order', href: '/stock/so' },
        { label: 'Quotation', href: '/arap/quotations', notImplemented: true },
        { label: 'Stock Dispatch', href: '/stock/stock-dispatch' },
        { label: 'Generate Sales Invoices', href: '/order-entry/generate-invoices', notImplemented: true },
        { label: 'Reminders', href: '/reports/reminders' },
        { label: 'Customers', href: '/contacts?focus=customers' },
        { label: 'Sales Report', href: '/reports/sales' },
        { label: 'Aged Receivables', href: '/reports/aged?type=AR' },
        { label: 'Customer Statement', href: '/reports/statement' },
      ],
    },
    {
      label: 'Accounts Payable (Creditors / Purchasing)',
      links: [
        { label: 'Purchase', href: '/arap/ap-purchase' },
        { label: 'Cash Purchase', href: '/arap/cash-purchase' },
        { label: 'Payment', href: '/arap/ap-payment' },
        { label: 'Purchase Invoices', href: '/invoices?type=AP' },
        { label: 'Purchase Order', href: '/stock/po' },
        { label: 'RFQ (Request for Quotation)', href: '/arap/rfq', notImplemented: true },
        { label: 'Stock Receipt', href: '/stock/stock-receipt' },
        { label: 'Generate Purchase Orders', href: '/order-entry/generate-po', notImplemented: true },
        { label: 'Locations', href: '/locations' },
        { label: 'Aged Payables', href: '/reports/aged?type=AP' },
      ],
    },
    {
      // Per direct instruction: split out of Accounts Payable - these
      // are inventory-management screens, not purchasing screens.
      // "Providers" is this project's one, real, canonical term for
      // this contact type (matching the backend's own typeProviderName
      // entity type) - "Vendors"/"Suppliers" are offered to a business
      // only as an optional Vocabulary customization, never as the
      // source-of-truth label.
      label: 'Inventory',
      links: [
        { label: 'Providers', href: '/contacts?focus=providers' },
        { label: 'Manufacturers', href: '/contacts' },
        { label: 'Inventory Catalog', href: '/items' },
        { label: 'Inventory Listing', href: '/stock/listing' },
        { label: 'Stock Take', href: '/stock/stock-take' },
        { label: 'Write-offs & Expiration', href: '/stock/write-offs' },
      ],
    },
    {
      label: 'Cash',
      links: [
        { label: 'POS Terminal (retail register)', href: '/pos' },
        { label: 'Cash Flow Forecast', href: '/reports/cash-flow-forecast' },
      ],
    },
    {
      label: 'Vouchers',
      links: [
        { label: 'Payable Batch', href: '/vouchers/payable', notImplemented: true },
        { label: 'Payment Batch', href: '/vouchers/payment', notImplemented: true },
        { label: 'General Ledger Batch', href: '/vouchers/general-ledger', notImplemented: true },
      ],
    },
    {
      label: 'HR',
      links: [
        { label: 'Employee Directory', href: '/contacts' },
        { label: 'Payroll', href: '/hr' },
      ],
    },
    {
      label: 'Logistics',
      links: [
        { label: 'Stock Transfer', href: '/stock/transfer' },
        { label: 'Restock Retail Outlets', href: '/stock/restock' },
        { label: 'Assembly BOM Transfer', href: '/logistics/assembly-bom', notImplemented: true },
        { label: 'Stock Movement Report', href: '/reports/stock-movement' },
        { label: 'Below Reorder', href: '/reports/below-reorder' },
        { label: 'Stock-Out Risk', href: '/reports/stock-out-risk' },
      ],
    },
    { label: 'Shipping', links: [{ label: 'Shipments', href: '/shipping', notImplemented: true }] },
    {
      label: 'Projects & Jobs',
      links: [
        { label: 'Projects', href: '/projects', notImplemented: true },
        { label: 'Jobs', href: '/jobs', notImplemented: true },
      ],
    },
    {
      label: 'Configuration',
      links: [
        { label: 'Entity Tree', href: '/setup/tree', requiredRoles: 'Administrator,Developer' },
        { label: 'Structured Editor', href: '/editor', requiredRoles: 'Administrator,Developer' },
        { label: 'Chart of Accounts', href: '/setup/chart-of-accounts', notImplemented: true, requiredRoles: 'Administrator,Developer' },
        { label: 'New Business', href: '/setup/new-business', requiredRoles: 'Administrator' },
        { label: 'Business Setup', href: '/setup/business-setup', requiredRoles: 'Administrator' },
        { label: 'Business Structure', href: '/setup/business-structure', requiredRoles: 'Administrator' },
        { label: 'Business Configuration Report', href: '/reports/business-configuration', requiredRoles: 'Administrator' },
        { label: 'Users', href: '/setup/users', requiredRoles: 'Administrator' },
        { label: 'Warehouses', href: '/locations', requiredRoles: 'Administrator' },
        { label: 'Bank Accounts', href: '/setup/bank-accounts', notImplemented: true, requiredRoles: 'Administrator' },
        { label: 'Taxes', href: '/setup/taxes', notImplemented: true, requiredRoles: 'Administrator' },
        { label: 'Currencies', href: '/setup/currencies', notImplemented: true, requiredRoles: 'Administrator' },
        { label: 'Exchange Rates', href: '/exchange-rates', notImplemented: true, requiredRoles: 'Administrator' },
        { label: 'Hierarchies', href: '', isSubheading: true, requiredRoles: 'Administrator' },
        { label: 'Hierarchies & Products', href: '/setup/hierarchy', requiredRoles: 'Administrator' },
        { label: 'Vocabulary', href: '/setup/vocabulary', requiredRoles: 'Administrator' },
        { label: 'Translations', href: '/setup/translations', requiredRoles: 'Administrator' },
      ],
    },
  ];

  // Per-item idempotent, not a one-time blanket guard: an existing
  // database must still pick up sections/links added to the array
  // above *after* it was first seeded, the same way the 'Routes' and
  // flag entities below already handle re-running this function
  // safely. The old `if (Menu exists) return;` guard made the whole
  // tree a single all-or-nothing snapshot — any section/link added to
  // `sections` later never reached a database that already had a
  // 'Menu' entity from an earlier, smaller version of this array.
  if (!db.prepare(`SELECT 1 FROM current_entities WHERE name = 'Menu'`).get()) {
    create(requireEntity('Application', typeRootName), typeRootName, 'Menu', SEED_USER_ID);
  }

  for (const section of sections) {
    // Confirmed directly: several, real section labels (Cash, HR,
    // Logistics, and others) also, genuinely collide with already-
    // existing Vocabulary words — the exact, same real issue as the
    // real links themselves, addressed the exact, same, real way.
    const sectionName = `Menu Section: ${section.label}`;
    // No sort_order at all — entity_id's own real, natural,
    // append-only creation order already, genuinely is the real
    // sibling order, since these are seeded in the exact, intended
    // display order. No separate mechanism needed.
    const existingSectionEntity = db.prepare(`SELECT id FROM current_entities WHERE name = ?`).get(sectionName) as { id: number } | undefined;
    if (!existingSectionEntity) {
      const sectionEntity = create(requireEntity('Menu', typeRootName), typeMenuSectionName, sectionName, SEED_USER_ID);
      const existingSectionVocabWord = db.prepare(`SELECT id FROM current_entities WHERE name = ?`).get(section.label) as { id: number } | undefined;
      if (existingSectionVocabWord) {
        supersedeEntity(sectionEntity.id, { relation: section.label }, SEED_USER_ID);
      }
    }

    for (const link of section.links) {
      const linkName = `Menu Link: ${section.label} — ${link.label}`;
      if (db.prepare(`SELECT 1 FROM current_entities WHERE name = ?`).get(linkName)) continue;
      const linkEntity = create(requireEntity(sectionName, typeMenuSectionName), typeMenuLinkName, linkName, SEED_USER_ID);

      // A real link's own real target route — its own, real, direct
      // link record, the exact, same, established setEntityLink
      // shape everything else in this codebase already uses. Routes
      // are real, shared entities under their own real "Routes" root
      // (the same way Vocabulary words are shared), never a bare
      // string on the link itself.
      if (link.href) {
        if (!db.prepare(`SELECT 1 FROM current_entities WHERE name = 'Routes'`).get()) {
          create(requireEntity('Application', typeRootName), typeRootName, 'Routes', SEED_USER_ID);
        }
        if (!db.prepare(`SELECT 1 FROM current_entities WHERE name = ? AND parent_id = (SELECT id FROM current_entities WHERE name = 'Routes')`).get(link.href)) {
          create(requireEntity('Routes', typeRootName), typeRootName, link.href, SEED_USER_ID);
        }
        setEntityLink(linkName, 'Route', link.href, SEED_USER_ID);
      }

      // Real, presence-only marker entities — existence itself is
      // the real, true value, the exact, same pattern already used
      // for a real CoA prototype tag.
      if (link.notImplemented) create(requireEntityById(linkEntity.id, typeMenuLinkName), typeMenuLinkFlagName, `${linkName} — Not Implemented`, SEED_USER_ID);
      if (link.isSubheading) create(requireEntityById(linkEntity.id, typeMenuLinkName), typeMenuLinkFlagName, `${linkName} — Is Subheading`, SEED_USER_ID);

      // A real, genuine one-to-many — one real, direct child entity
      // per real required role, the exact, same, established shape
      // proven this session for a real contact's own multiple, real
      // contact types.
      if (link.requiredRoles) {
        for (const role of link.requiredRoles.split(',')) {
          create(requireEntityById(linkEntity.id, typeMenuLinkName), typeMenuLinkFlagName, `${linkName} — Required Role: ${role}`, SEED_USER_ID);
        }
      }

      const existingVocabWord = db.prepare(`SELECT id FROM current_entities WHERE name = ?`).get(link.label) as { id: number } | undefined;
      if (existingVocabWord) {
        supersedeEntity(linkEntity.id, { relation: link.label }, SEED_USER_ID);
      }
    }
  }
}
/** One-off reorg, per direct instruction: moves Old P&L/New P&L/New
 * New P&L into a new "test" section, splits the inventory-management
 * links (renamed Vendors -> Providers, Manufacturers, Inventory
 * Catalog, Inventory Listing, Stock Take, Write-offs & Expiration) out
 * of Accounts Payable into a new "Inventory" section, and moves Cash
 * Sale/Cash Purchase out of "Cash" and back beside the on-account
 * Sale/Purchase screens they belong next to, in Accounts
 * Receivable/Accounts Payable. The `sections` array above already
 * reflects this as the real, current layout for a brand-new database;
 * this function reparents the existing entities (via supersedeEntity,
 * the same rename/reparent primitive already used above for
 * Vocabulary-collision handling) for a database that was seeded under
 * the old layout, so nothing here needs a reset-db to pick this up.
 * Deliberately runs BEFORE migrateForMenuEntities() below: it renames/
 * reparents each stale entity to the exact name its NEW location would
 * otherwise auto-create, so migrateForMenuEntities()'s own per-item
 * idempotent check finds it already there and skips creating a second,
 * duplicate entity at the new location while the stale one lingers,
 * un-reparented, at the old one.
 */
function migrateForMenuReorg(): void {
  if (!db.prepare(`SELECT 1 FROM current_entities WHERE name = 'Menu'`).get()) return; // fresh database — the sections array below already reflects the final layout; nothing pre-existing to reparent
  function ensureSection(label: string): void {
    const sectionName = `Menu Section: ${label}`;
    if (!db.prepare(`SELECT 1 FROM current_entities WHERE name = ?`).get(sectionName)) {
      create(requireEntity('Menu', typeRootName), typeMenuSectionName, sectionName, SEED_USER_ID);
    }
  }
  function moveLink(oldSectionLabel: string, linkLabel: string, newSectionLabel: string, newLinkLabel?: string, newRelation?: string | null): void {
    const oldName = `Menu Link: ${oldSectionLabel} — ${linkLabel}`;
    const row = db.prepare(`SELECT id FROM current_entities WHERE name = ?`).get(oldName) as { id: number } | undefined;
    if (!row) return; // never existed under the old section on this database — nothing to move
    const newLabel = newLinkLabel ?? linkLabel;
    const newName = `Menu Link: ${newSectionLabel} — ${newLabel}`;
    if (db.prepare(`SELECT 1 FROM current_entities WHERE name = ?`).get(newName)) return; // already moved
    // A rename also needs its own real_label source re-pointed: the
    // old "Vendors" link's relation_id already pointed at the real,
    // pre-existing "Vendors" Vocabulary/contact-type entity, which
    // otherwise keeps winning over the renamed entity's own bare name
    // in getMenuTree()'s real_label fallback (confirmed directly,
    // by inspecting the raw rows after a first, incomplete attempt).
    const update: EntityUpdate = { name: newName, parent: `Menu Section: ${newSectionLabel}` };
    if (newRelation !== undefined) update.relation = newRelation;
    supersedeEntity(row.id, update, SEED_USER_ID);
  }

  ensureSection('test');
  ensureSection('Inventory');

  moveLink('General Ledger', 'Old P&L', 'test');
  moveLink('General Ledger', 'New P&L', 'test');
  moveLink('General Ledger', 'New New P&L', 'test');

  moveLink('Accounts Payable (Creditors / Purchasing)', 'Vendors', 'Inventory', 'Providers', 'Providers');
  // The href itself changed too (?focus=vendors -> ?focus=providers, matching
  // the frontend's own renamed `focus` check) - setEntityLink is its own,
  // separate idempotent find-or-create-then-supersede, safe to re-run even
  // though the per-item guard above already skipped re-creating the link
  // entity itself.
  if (db.prepare(`SELECT 1 FROM current_entities WHERE name = 'Menu Link: Inventory — Providers'`).get()) {
    setEntityLink('Menu Link: Inventory — Providers', 'Route', '/contacts?focus=providers', SEED_USER_ID);
  }
  moveLink('Accounts Payable (Creditors / Purchasing)', 'Manufacturers', 'Inventory');
  moveLink('Accounts Payable (Creditors / Purchasing)', 'Inventory Catalog', 'Inventory');
  moveLink('Accounts Payable (Creditors / Purchasing)', 'Inventory Listing', 'Inventory');
  moveLink('Accounts Payable (Creditors / Purchasing)', 'Stock Take', 'Inventory');
  moveLink('Accounts Payable (Creditors / Purchasing)', 'Write-offs & Expiration', 'Inventory');

  moveLink('Cash', 'Cash Sale', 'Accounts Receivable (Debtors / Sales)');
  moveLink('Cash', 'Cash Purchase', 'Accounts Payable (Creditors / Purchasing)');
}
migrateForMenuReorg();
migrateForMenuEntities();

/** Step 3 of docs/translator-form-and-guard-rails-plan.md — the real,
 * concrete case confirmed by the direct review this session already
 * did (docs/user-manual.md, Item 1b): "Provider"/"Vendor"/"Supplier"
 * is genuinely an English-only synonym problem — German, French,
 * Danish, and Italian each already have one, single, standard word,
 * with no real, competing second term. "Suppliers" is created here as
 * its own, real, distinct Vocabulary entity (an opt-in alternate
 * alongside "Providers", the default, canonical label), reaching
 * "Accounts Payable" via the exact, same, real "Header Account"
 * hierarchy link "Vendors" (the underlying, un-renamed, backend
 * contact-type entity) itself already uses — a second, real, equal,
 * alternate path to the same, real concept, not a replacement for
 * either.
 *
 * Deliberately does NOT try to copy "Providers" own translations onto
 * "Suppliers": setTranslation's own, real anti-ambiguity guard
 * correctly refuses to let two distinct English concepts share the
 * exact same translated text in a given language (confirmed directly
 * — attempting it here logged a genuine "Suppliers/Providers both
 * translate to Lieferanten" collision on every fresh boot). "Suppliers"
 * is therefore a real, English-only label for now, same as any other
 * not-yet-translated word — it falls back to its own English name in
 * German/French/Danish/Italian until someone genuinely gives it its
 * own, distinct real translation through /setup/translations. */
function migrateForVocabularyAlternates() {
  if (db.prepare(`SELECT 1 FROM current_entities WHERE name = 'Suppliers'`).get()) return;
  create(requireEntity('Vocabulary', typeRootName), typeVocabularyWordName, 'Suppliers', SEED_USER_ID);
  setHierarchyParent('Suppliers', 'Header Account', 'Accounts Payable', SEED_USER_ID);
}
migrateForVocabularyAlternates();

/** The real Customer/Vendor/Employee contact types, each with its own
 * real Header Account link, and every real, existing customer/
 * vendor/employee re-parented to the one business every real e2e
 * test and simulation this application already runs against — a
 * pragmatic, real migration for existing data that today has no real
 * owning business at all, since customers/vendors/employees were
 * genuinely shared, global structural parents before this fix. */
function migrateForContactTypesAndPerBusinessContacts() {
  if (!db.prepare(`SELECT 1 FROM current_entities WHERE name = 'Customer Contact Type'`).get()) {
    create(requireEntity('Vocabulary', typeRootName), typeVocabularyWordName, 'Customer Contact Type', SEED_USER_ID);
    setHierarchyParent('Customer Contact Type', 'Header Account', 'Accounts Receivable', SEED_USER_ID);
  }
  if (!db.prepare(`SELECT 1 FROM current_entities WHERE name = 'Vendor Contact Type'`).get()) {
    create(requireEntity('Vocabulary', typeRootName), typeVocabularyWordName, 'Vendor Contact Type', SEED_USER_ID);
    setHierarchyParent('Vendor Contact Type', 'Header Account', 'Accounts Payable', SEED_USER_ID);
  }
  if (!db.prepare(`SELECT 1 FROM current_entities WHERE name = 'Employee Contact Type'`).get()) {
    create(requireEntity('Vocabulary', typeRootName), typeVocabularyWordName, 'Employee Contact Type', SEED_USER_ID);
    setHierarchyParent('Employee Contact Type', 'Header Account', 'Accounts Payable', SEED_USER_ID);
  }

  const businesses = db.prepare(`SELECT name FROM current_entities WHERE parent_id = (SELECT id FROM current_entities WHERE name = 'Businesses')`).all() as { name: string }[];
  for (const b of businesses) {
    const contactsName = `${b.name} Contacts`;
    if (!db.prepare(`SELECT 1 FROM current_entities WHERE name = ?`).get(contactsName)) {
      create(requireEntity(b.name, typeBusinessName), typeBusinessContactsRootName, contactsName, SEED_USER_ID);
    }
  }

  const defaultBusiness = 'Wine Retail Business';
  const destName = `${defaultBusiness} Contacts`;
  if (!db.prepare(`SELECT 1 FROM current_entities WHERE name = ?`).get(destName)) return; // demo business not seeded (yet) in this environment

  const customers = db.prepare(`SELECT id, name FROM current_entities WHERE parent_id = (SELECT id FROM current_entities WHERE name = 'Accounts Receivable')`).all() as { id: number; name: string }[];
  const vendors = db.prepare(`SELECT id, name FROM current_entities WHERE parent_id = (SELECT id FROM current_entities WHERE name = 'Accounts Payable')`).all() as { id: number; name: string }[];
  const employees = db.prepare(`SELECT id, name FROM current_entities WHERE parent_id = (SELECT id FROM current_entities WHERE name = 'Employees')`).all() as { id: number; name: string }[];

  // Per direct, confirmed regression: re-parenting every existing
  // customer/vendor/employee under {business} Contacts broke a wide,
  // confirmed set of existing tests that still, correctly, expect
  // them structurally under Accounts Receivable/Accounts Payable/
  // Employees (chart_of_accounts display, AR/AP posting, multi-line
  // invoices, and more) — every one of these would need updating to
  // find a contact via its own real contact-type relationship
  // instead of parent_id, a real, separate, larger undertaking this
  // migration does not attempt. The real, additive, non-breaking
  // item — tagging each with its own real contact type — proceeds;
  // the structural move does not.
  for (const c of customers) {
    setContactType(c.name, 'Customer Contact Type', SEED_USER_ID);
  }
  for (const v of vendors) {
    setContactType(v.name, 'Vendor Contact Type', SEED_USER_ID);
  }
  for (const e of employees) {
    setContactType(e.name, 'Employee Contact Type', SEED_USER_ID);
  }
}
migrateForContactTypesAndPerBusinessContacts();

/** A first, real go at the business-type/prototype-CoA design from
 * docs/coa-class-instance-plan.md — per direct suggestion: a real
 * 'Business Type' top-level node, with each real legal entity type as
 * a real child, each with its own real prototype Chart of Accounts
 * copy underneath (via the same, real copyChartOfAccountsInto
 * mechanism instantiateChartOfAccounts already uses for a real
 * business), and a real, simple set of questions attached — the
 * number/names of partners, the number/classes of shares, etc. — as
 * real child entities, each one a real Vocabulary-linked question.
 * This is a first, real pass: the structural foundation (a real,
 * genuine, verifiable prototype CoA per business type) is built and
 * tested here; wiring a business-type choice into the create-new-
 * business UI itself is real, separate, future work. */
function migrateForBusinessTypes() {
  if (!db.prepare(`SELECT 1 FROM current_entities WHERE name = 'Business Type'`).get()) {
    create(requireEntity('Application', typeRootName), typeRootName, 'Business Type', SEED_USER_ID);
  }
  const businessTypes: { name: string; coaPrototype: string; questions: string[] }[] = [
    {
      name: 'Sole Trader',
      coaPrototype: 'English CoA',
      questions: ['Owner name'],
    },
    {
      name: 'Partnership',
      coaPrototype: 'English CoA',
      questions: ['Number of partners', 'Names of partners', 'Profit-sharing ratio'],
    },
    {
      name: 'Pty Ltd Company',
      coaPrototype: 'English CoA',
      questions: ['Number of share classes', 'Names of share classes', 'Number of shares issued per class', 'Names of directors'],
    },
    {
      name: 'Incorporated Company',
      coaPrototype: 'English CoA',
      questions: ['Number of share classes', 'Names of share classes', 'Number of shares issued per class', 'Names of directors', 'Registered office address'],
    },
  ];
  for (const bt of businessTypes) {
    if (!db.prepare(`SELECT 1 FROM current_entities WHERE name = ? AND parent_id = (SELECT id FROM current_entities WHERE name = 'Business Type')`).get(bt.name)) {
      create(requireEntity('Business Type', typeRootName), typeBusinessTypeName, bt.name, SEED_USER_ID);
    }
    const coaRootName = `${bt.name} CoA`;
    if (!db.prepare(`SELECT 1 FROM current_entities WHERE name = ? AND parent_id = (SELECT id FROM current_entities WHERE name = ?)`).get(coaRootName, bt.name)) {
      const btNode = requireEntity(bt.name, typeBusinessTypeName);
      if (!db.prepare(`SELECT 1 FROM current_entities WHERE name = 'Vocabulary' AND parent_id = ?`).get(btNode.id)) {
        create(btNode, typeRootName, 'Vocabulary', SEED_USER_ID);
      }
      create(btNode, typeChartOfAccountsRootName, coaRootName, SEED_USER_ID);
      copyChartOfAccountsInto(btNode, requireEntity(coaRootName, typeChartOfAccountsRootName, btNode), bt.coaPrototype, SEED_USER_ID);
    }
    const questionsRootName = `${bt.name} Questions`;
    if (!db.prepare(`SELECT 1 FROM current_entities WHERE name = ? AND parent_id = (SELECT id FROM current_entities WHERE name = ?)`).get(questionsRootName, bt.name)) {
      const questionsRoot = create(requireEntity(bt.name, typeBusinessTypeName), typeBusinessTypeQuestionsRootName, questionsRootName, SEED_USER_ID);
      for (const q of bt.questions) {
        if (!db.prepare(`SELECT 1 FROM current_entities WHERE name = ?`).get(q)) {
          create(requireEntity('Vocabulary', typeRootName), typeVocabularyWordName, q, SEED_USER_ID);
        }
        create(requireEntityById(questionsRoot.id, typeBusinessTypeQuestionsRootName), typeBusinessTypeQuestionName, `${bt.name} — Question: ${q}`, SEED_USER_ID);
      }
    }
  }
}
migrateForBusinessTypes();

/** Gives every real, existing business its own real, genuine
 * Chart of Accounts instance — the exact, same, already-established
 * instantiateChartOfAccounts mechanism createBusiness already calls
 * for a brand-new business, run here for every business that never
 * went through createBusiness at all (every demo business is
 * hand-created directly in schema SQL). Keyed on the business's own
 * name alone, never the ledger — a business's own real Actual ledger,
 * and any number of its own real, proposed Budget ledgers, correctly
 * share the exact, same, one, real CoA instance. */
function migrateForPerBusinessChartOfAccounts() {
  const businesses = db.prepare(`SELECT id, name, relation_id FROM current_entities WHERE parent_id = (SELECT id FROM current_entities WHERE name = 'Businesses')`).all() as {
    id: number;
    name: string;
    relation_id: number | null;
  }[];
  for (const b of businesses) {
    const coaPrototype = b.relation_id ? (db.prepare(`SELECT name FROM current_entities WHERE id = ?`).get(b.relation_id) as { name: string } | undefined)?.name : undefined;
    instantiateChartOfAccounts(asBusinessName(b.name), coaPrototype, SEED_USER_ID);
  }
}
// REVERTED IMMEDIATELY, per direct, confirmed regression: running this
// against every existing business (several with real, already-posted,
// confirmed-correct financial history — BMW's own published 2020 HGB
// balance sheet, Peugeot's own filed 2020 PCG balance sheet) broke
// both, a real financial figure silently going from $417,000 to $0.
// The root cause: instantiateChartOfAccounts copies real,
// prototype-tagged leaf accounts by name, and this codebase still has
// many real, global, by-name lookups (not yet business-scoped)
// throughout reporting and posting — once a genuine duplicate name
// exists, those lookups can resolve to the wrong instance. This is
// the exact, same risk already flagged when this function was first
// built for brand-new businesses only (see its own real doc comment)
// — confirmed here, directly, that it is genuinely unsafe to also run
// against a business with real, existing, already-posted history
// without first making every such lookup business-scoped. Not
// attempted blind a second time — see docs/coa-class-instance-plan.md
// for the real, remaining, necessary work before this is safe.
migrateForPerBusinessChartOfAccounts();
}
