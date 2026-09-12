import { setTranslation, createEntity, db } from '../src/db.js';

// The 39 real menu labels confirmed missing from the vocabulary
// entirely, across all four non-English languages this app supports.
const translations: Record<string, Record<string, string>> = {
  'Accounting Periods': { German: 'Buchungsperioden', French: 'Périodes comptables', Danish: 'Regnskabsperioder', Italian: 'Periodi contabili' },
  'Assembly BOM Transfer': { German: 'Stücklisten-Übertragung', French: 'Transfert de nomenclature', Danish: 'Stykliste-overførsel', Italian: 'Trasferimento distinta base' },
  'Bank Accounts': { German: 'Bankkonten', French: 'Comptes bancaires', Danish: 'Bankkonti', Italian: 'Conti bancari' },
  Cash: { German: 'Bargeld', French: 'Espèces', Danish: 'Kontant', Italian: 'Contanti' },
  'Cash Sale / Receipt': { German: 'Barverkauf / Quittung', French: 'Vente au comptant / Reçu', Danish: 'Kontantsalg / Kvittering', Italian: 'Vendita in contanti / Ricevuta' },
  Currencies: { German: 'Währungen', French: 'Devises', Danish: 'Valutaer', Italian: 'Valute' },
  'Employee Directory': { German: 'Mitarbeiterverzeichnis', French: 'Annuaire des employés', Danish: 'Medarbejderoversigt', Italian: 'Rubrica dipendenti' },
  'Exchange Rates': { German: 'Wechselkurse', French: 'Taux de change', Danish: 'Valutakurser', Italian: 'Tassi di cambio' },
  'FX Adjustment': { German: 'Währungsanpassung', French: 'Ajustement de change', Danish: 'Valutaregulering', Italian: 'Rettifica cambio' },
  'General Ledger Batch': { German: 'Hauptbuch-Sammelbuchung', French: 'Lot de grand livre', Danish: 'Hovedbog-batch', Italian: 'Lotto libro mastro' },
  'Generate Purchase Orders': { German: 'Bestellungen erzeugen', French: 'Générer les bons de commande', Danish: 'Generer indkøbsordrer', Italian: 'Genera ordini di acquisto' },
  'Generate Sales Invoices': { German: 'Rechnungen erzeugen', French: 'Générer les factures de vente', Danish: 'Generer salgsfakturaer', Italian: 'Genera fatture di vendita' },
  'Goods & Services': { German: 'Waren & Dienstleistungen', French: 'Biens & services', Danish: 'Varer & tjenester', Italian: 'Beni & servizi' },
  HR: { German: 'Personal', French: 'RH', Danish: 'HR', Italian: 'Risorse umane' },
  Jobs: { German: 'Aufträge', French: 'Travaux', Danish: 'Opgaver', Italian: 'Commesse' },
  Logistics: { German: 'Logistik', French: 'Logistique', Danish: 'Logistik', Italian: 'Logistica' },
  'New Business': { German: 'Neues Unternehmen', French: 'Nouvelle entreprise', Danish: 'Ny virksomhed', Italian: 'Nuova azienda' },
  'POS Terminal': { German: 'Kassenterminal', French: 'Terminal de caisse', Danish: 'Kasseterminal', Italian: 'Terminale POS' },
  'Inventory Catalog': { German: 'Artikelkatalog', French: 'Catalogue des articles', Danish: 'Varekatalog', Italian: 'Catalogo articoli' },
  'Payable Batch': { German: 'Sammelbuchung Verbindlichkeiten', French: 'Lot de factures fournisseurs', Danish: 'Kreditor-batch', Italian: 'Lotto fatture fornitori' },
  'Payment Batch': { German: 'Zahlungsstapel', French: 'Lot de paiements', Danish: 'Betalings-batch', Italian: 'Lotto pagamenti' },
  Payroll: { German: 'Lohnabrechnung', French: 'Paie', Danish: 'Løn', Italian: 'Buste paga' },
  'Profit and Loss': { German: 'Gewinn und Verlust', French: 'Compte de résultat', Danish: 'Resultatopgørelse', Italian: 'Conto economico' },
  Projects: { German: 'Projekte', French: 'Projets', Danish: 'Projekter', Italian: 'Progetti' },
  'Projects & Jobs': { German: 'Projekte & Aufträge', French: 'Projets & travaux', Danish: 'Projekter & opgaver', Italian: 'Progetti & commesse' },
  'Purchase Order': { German: 'Bestellung', French: 'Bon de commande', Danish: 'Indkøbsordre', Italian: 'Ordine di acquisto' },
  Quotation: { German: 'Angebot', French: 'Devis', Danish: 'Tilbud', Italian: 'Preventivo' },
  'RFQ (Request for Quotation)': { German: 'Ausschreibung (Angebotsanfrage)', French: 'Demande de devis', Danish: 'Tilbudsforespørgsel', Italian: 'Richiesta di preventivo' },
  Reconciliation: { German: 'Abstimmung', French: 'Rapprochement', Danish: 'Afstemning', Italian: 'Riconciliazione' },
  'Recurring Transactions': { German: 'Wiederkehrende Buchungen', French: 'Transactions récurrentes', Danish: 'Gentagne transaktioner', Italian: 'Transazioni ricorrenti' },
  'Sales Order': { German: 'Auftragsbestätigung', French: 'Commande client', Danish: 'Salgsordre', Italian: 'Ordine di vendita' },
  Shipments: { German: 'Sendungen', French: 'Expéditions', Danish: 'Forsendelser', Italian: 'Spedizioni' },
  'Stock Dispatch': { German: 'Warenausgang', French: 'Sortie de stock', Danish: 'Lagerafsendelse', Italian: 'Uscita merce' },
  'Stock Receipt': { German: 'Wareneingang', French: 'Réception de stock', Danish: 'Lagermodtagelse', Italian: 'Ricevimento merce' },
  Taxes: { German: 'Steuern', French: 'Taxes', Danish: 'Skatter', Italian: 'Imposte' },
  Users: { German: 'Benutzer', French: 'Utilisateurs', Danish: 'Brugere', Italian: 'Utenti' },
  Vouchers: { German: 'Belege', French: 'Pièces justificatives', Danish: 'Bilag', Italian: 'Giustificativi' },
  Warehouses: { German: 'Lagerhäuser', French: 'Entrepôts', Danish: 'Lagre', Italian: 'Magazzini' },
  'Year End Close': { German: 'Jahresabschluss', French: "Clôture de fin d'exercice", Danish: 'Årsafslutning', Italian: 'Chiusura di fine anno' },
  Debtors: { German: 'Debitoren', French: 'Débiteurs', Danish: 'Debitorer', Italian: 'Debitori' },
  Creditors: { German: 'Kreditoren', French: 'Créditeurs', Danish: 'Kreditorer', Italian: 'Creditori' },
};

let added = 0;
for (const [english, langs] of Object.entries(translations)) {
  const exists = db.prepare('SELECT 1 FROM current_entities WHERE name = ?').get(english);
  if (!exists) {
    createEntity({ name: english, parent: 'Vocabulary' }, 1);
  }
  for (const [lang, text] of Object.entries(langs)) {
    setTranslation(english, lang, text);
    added++;
  }
}
console.log('Added', added, 'translations across', Object.keys(translations).length, 'real menu terms.');

const distinctAfter = (db.prepare('SELECT COUNT(DISTINCT entity) AS c FROM localized_text').get() as { c: number }).c;
console.log('Total distinct vocabulary words now:', distinctAfter);
