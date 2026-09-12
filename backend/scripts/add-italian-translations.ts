import { setTranslation, db } from '../src/db.js';

const translations: Record<string, string> = {
  Add: 'Aggiungi', 'Aged Payables': 'Debiti scaduti', 'Aged Receivables': 'Crediti scaduti',
  'Below Reorder': 'Sotto il livello di riordino', 'Bill to': 'Fatturare a', 'Billing Address': 'Indirizzo di fatturazione',
  Bought: 'Acquistato', Cancel: 'Annulla', Category: 'Categoria', 'Change Password': 'Cambia password',
  City: 'Città', Complete: 'Completa', 'Confirm New Password': 'Conferma nuova password', Continue: 'Continua',
  'Could Not Log In': 'Accesso non riuscito', Counted: 'Contato', 'Current Password': 'Password attuale',
  'Current Year Earnings': "Utile dell'esercizio corrente", Delete: 'Elimina', Draft: 'Bozza', Edit: 'Modifica',
  'Entity Tree': 'Albero delle entità', Expected: 'Previsto', 'Expiration Date': 'Data di scadenza',
  'Expiring Stock': 'Scorte in scadenza', From: 'Da', 'General Journal': 'Giornale generale', History: 'Cronologia',
  Level: 'Livello', 'Log In': 'Accedi', 'Log Out': 'Esci', 'Logging In': 'Accesso in corso',
  'Lot Number': 'Numero di lotto', Memo: 'Nota', Name: 'Nome', New: 'Nuovo', 'New Password': 'Nuova password',
  Newer: 'Più recente', 'No Entries Yet': 'Nessuna registrazione ancora', Older: 'Meno recente',
  'On Hand': 'Disponibile', Outstanding: 'Insoluto', Parent: 'Elemento superiore',
  'Password Changed': 'Password modificata', Payment: 'Pagamento', Purchase: 'Acquisto',
  'Purchase Invoices': "Fatture d'acquisto", Qty: 'Qtà', Rack: 'Scaffale', Reason: 'Motivo',
  Receipt: 'Ricevuta', 'Received Date': 'Data di ricezione', 'Record The First One': 'Registra il primo',
  Reminders: 'Solleciti', 'Reorder Level': 'Livello di riordino', Reset: 'Reimposta',
  Retail: 'Vendita al dettaglio', Sale: 'Vendita', Save: 'Salva', Send: 'Invia', Setup: 'Configurazione',
  'Shelf Side': 'Lato scaffale', Relation: 'Relazione', Sold: 'Venduto', Status: 'Stato',
  'Stock Take': 'Inventario', 'Stock Transfer': 'Trasferimento scorte', 'Structured Editor': 'Editor strutturato',
  Subtotal: 'Subtotale', Switch: 'Cambia', Tax: 'Imposta', To: 'A', 'Total due': 'Totale dovuto',
  Type: 'Tipo', 'Username And Password Required': 'Nome utente e password richiesti', Variance: 'Scostamento',
  Warehouse: 'Magazzino', 'Write-offs & Expiration': 'Svalutazioni e scadenze',
};

let added = 0;
for (const [en, it] of Object.entries(translations)) {
  setTranslation(en, 'Italian', it);
  added++;
}
console.log('Added', added, 'Italian translations');

const remaining = db
  .prepare(
    `SELECT e.name FROM current_entities e
     WHERE e.parent_id = (SELECT id FROM current_entities WHERE name = 'Vocabulary')
     AND e.name NOT IN (SELECT entity FROM translation_entry WHERE language = 'Italian')`
  )
  .all() as { name: string }[];
console.log('Still missing after this pass:', remaining.length, JSON.stringify(remaining.map((r) => r.name)));
