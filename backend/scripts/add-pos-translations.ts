import { setTranslation, createEntityRaw, create, requireEntity, typeRootName, typeVocabularyWordName, db } from '../src/db.js';

const translations: Record<string, Record<string, string>> = {
  Cart: { German: 'Warenkorb', French: 'Panier', Danish: 'Kurv', Italian: 'Carrello' },
  'Sale complete': { German: 'Verkauf abgeschlossen', French: 'Vente terminée', Danish: 'Salg gennemført', Italian: 'Vendita completata' },
  'Cash tendered': { German: 'Erhaltener Betrag', French: 'Montant reçu', Danish: 'Modtaget beløb', Italian: 'Importo ricevuto' },
  'Payment method': { German: 'Zahlungsart', French: 'Mode de paiement', Danish: 'Betalingsmetode', Italian: 'Metodo di pagamento' },
  'Scan or search a product': { German: 'Produkt scannen oder suchen', French: 'Scanner ou rechercher un produit', Danish: 'Scan eller søg efter et produkt', Italian: 'Scansiona o cerca un prodotto' },
  Store: { German: 'Filiale', French: 'Magasin', Danish: 'Butik', Italian: 'Negozio' },
  Approve: { German: 'Genehmigen', French: 'Approuver', Danish: 'Godkend', Italian: 'Approva' },
  'Card on file': { German: 'Hinterlegte Karte', French: 'Carte enregistrée', Danish: 'Gemt kort', Italian: 'Carta registrata' },
  Card: { German: 'Karte', French: 'Carte', Danish: 'Kort', Italian: 'Carta' },
  'Line total': { German: 'Zeilensumme', French: 'Total de la ligne', Danish: 'Linjetotal', Italian: 'Totale riga' },
  Loading: { German: 'Wird geladen…', French: 'Chargement…', Danish: 'Indlæser…', Italian: 'Caricamento in corso…' },
  'New sale': { German: 'Neuer Verkauf', French: 'Nouvelle vente', Danish: 'Nyt salg', Italian: 'Nuova vendita' },
  'No items yet': { German: 'Noch keine Artikel', French: "Aucun article pour l'instant", Danish: 'Ingen varer endnu', Italian: 'Nessun articolo ancora' },
  'Print receipt': { German: 'Beleg drucken', French: 'Imprimer le reçu', Danish: 'Udskriv kvittering', Italian: 'Stampa ricevuta' },
  Reject: { German: 'Ablehnen', French: 'Refuser', Danish: 'Afvis', Italian: 'Rifiuta' },
  'Unit price': { German: 'Einzelpreis', French: 'Prix unitaire', Danish: 'Enhedspris', Italian: 'Prezzo unitario' },
};

let added = 0;
for (const [english, langs] of Object.entries(translations)) {
  const exists = db.prepare('SELECT 1 FROM current_entities WHERE name = ?').get(english);
  if (!exists) create(requireEntity('Vocabulary', typeRootName), typeVocabularyWordName, english, 1);
  for (const [lang, text] of Object.entries(langs)) {
    setTranslation(english, lang, text);
    added++;
  }
}
console.log('Added', added, 'translations across', Object.keys(translations).length, 'POS terms.');
