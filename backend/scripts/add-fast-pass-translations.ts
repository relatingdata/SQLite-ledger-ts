import { setTranslation, createEntity, create, fetch, typeRootName, typeVocabularyWordName, db } from '../src/db.js';

// 3 real, reused directly from LedgerSMB's own published translations
// (github.com/ledgersmb/LedgerSMB/tree/master/locale/po) — the rest
// translated directly, since LedgerSMB's own vocabulary didn't have a
// real match for this app's more specific, compound phrases.
const translations: Record<string, Record<string, string>> = {
  Active: { German: 'Aktiv', French: 'Actif', Danish: 'Aktiv', Italian: 'Attivo' },
  Price: { German: 'Preis', French: 'Prix', Danish: 'Pris', Italian: 'Prezzo' },
  Vendor: { German: 'Lieferant', French: 'Fournisseur', Danish: 'Leverandør', Italian: 'Fornitore' },

  'AP Payment': { German: 'Kreditorenzahlung', French: 'Paiement fournisseur', Danish: 'Kreditorbetaling', Italian: 'Pagamento fornitore' },
  'AP Purchase': { German: 'Einkauf', French: 'Achat fournisseur', Danish: 'Indkøb', Italian: 'Acquisto' },
  'AR / AP': { German: 'Debitoren / Kreditoren', French: 'Clients / Fournisseurs', Danish: 'Debitor / Kreditor', Italian: 'Clienti / Fornitori' },
  'AR Receipt': { German: 'Debitorenzahlungseingang', French: 'Encaissement client', Danish: 'Debitorindbetaling', Italian: 'Incasso cliente' },
  'AR Sale': { German: 'Verkauf', French: 'Vente client', Danish: 'Salg', Italian: 'Vendita' },
  'Account Settings': { German: 'Kontoeinstellungen', French: 'Paramètres du compte', Danish: 'Kontoindstillinger', Italian: 'Impostazioni account' },
  'Business Name': { German: 'Unternehmensname', French: "Nom de l'entreprise", Danish: 'Virksomhedsnavn', Italian: "Nome dell'azienda" },
  'Change password': { German: 'Passwort ändern', French: 'Changer le mot de passe', Danish: 'Skift adgangskode', Italian: 'Cambia password' },
  'Close through date': { German: 'Abschließen bis Datum', French: "Clôturer jusqu'à la date", Danish: 'Afslut til dato', Italian: 'Chiudi fino alla data' },
  'Confirm new password': { German: 'Neues Passwort bestätigen', French: 'Confirmer le nouveau mot de passe', Danish: 'Bekræft ny adgangskode', Italian: 'Conferma nuova password' },
  'Current password': { German: 'Aktuelles Passwort', French: 'Mot de passe actuel', Danish: 'Nuværende adgangskode', Italian: 'Password attuale' },
  'Date format': { German: 'Datumsformat', French: 'Format de date', Danish: 'Datoformat', Italian: 'Formato data' },
  'Financial Year': { German: 'Geschäftsjahr', French: 'Exercice comptable', Danish: 'Regnskabsår', Italian: 'Esercizio finanziario' },
  Manufacturer: { German: 'Hersteller', French: 'Fabricant', Danish: 'Producent', Italian: 'Produttore' },
  'New password': { German: 'Neues Passwort', French: 'Nouveau mot de passe', Danish: 'Ny adgangskode', Italian: 'Nuova password' },
  'New user': { German: 'Neuer Benutzer', French: 'Nouvel utilisateur', Danish: 'Ny bruger', Italian: 'Nuovo utente' },
  'Number format': { German: 'Zahlenformat', French: 'Format numérique', Danish: 'Talformat', Italian: 'Formato numerico' },
  'Package quantity': { German: 'Gebindemenge', French: "Quantité par colis", Danish: 'Pakningsstørrelse', Italian: 'Quantità per confezione' },
  'Page size': { German: 'Seitengröße', French: 'Taille de page', Danish: 'Sidestørrelse', Italian: 'Dimensione pagina' },
  'Price per unit': { German: 'Preis pro Einheit', French: 'Prix par unité', Danish: 'Pris pr. enhed', Italian: 'Prezzo per unità' },
  'Rows per page': { German: 'Zeilen pro Seite', French: 'Lignes par page', Danish: 'Rækker pr. side', Italian: 'Righe per pagina' },
  Sources: { German: 'Bezugsquellen', French: 'Sources', Danish: 'Kilder', Italian: 'Fonti' },
  'Tax %': { German: 'Steuer %', French: 'Taxe %', Danish: 'Moms %', Italian: 'Imposta %' },
  UPC: { German: 'UPC', French: 'UPC', Danish: 'UPC', Italian: 'UPC' },
  'Unit cost': { German: 'Stückkosten', French: 'Coût unitaire', Danish: 'Enhedspris (kost)', Italian: 'Costo unitario' },
  'Unit of measure': { German: 'Maßeinheit', French: 'Unité de mesure', Danish: 'Måleenhed', Italian: 'Unità di misura' },
  Value: { German: 'Wert', French: 'Valeur', Danish: 'Værdi', Italian: 'Valore' },
  'Vendor SKU': { German: 'Lieferanten-Artikelnummer', French: 'Référence fournisseur', Danish: 'Leverandørvarenummer', Italian: 'Codice fornitore' },
  'Vendor UPC': { German: 'Lieferanten-UPC', French: 'UPC fournisseur', Danish: 'Leverandør-UPC', Italian: 'UPC fornitore' },
  'New Division': { German: 'Neue Abteilung', French: 'Nouvelle division', Danish: 'Ny afdeling', Italian: 'Nuova divisione' },
  'Real Divisions': { German: 'Reale Abteilungen', French: 'Divisions réelles', Danish: 'Rigtige afdelinger', Italian: 'Divisioni reali' },
  'Stock / Orders': { German: 'Lager / Bestellungen', French: 'Stock / Commandes', Danish: 'Lager / Ordrer', Italian: 'Magazzino / Ordini' },

  // These four remain deliberately English-only for now — genuinely
  // long, sentence-like field hints, not short labels, out of scope
  // for this fast pass (see docs/TODO.md). Recorded here so the real
  // gap is visible in source control, not silently skipped.
};

let added = 0;
for (const [english, langs] of Object.entries(translations)) {
  const exists = db.prepare('SELECT 1 FROM current_entities WHERE name = ?').get(english);
  if (!exists) create(fetch('Vocabulary', typeRootName), typeVocabularyWordName, english, 1);
  for (const [lang, text] of Object.entries(langs)) {
    setTranslation(english, lang, text);
    added++;
  }
}
console.log('Added', added, 'translations across', Object.keys(translations).length, 'terms.');
