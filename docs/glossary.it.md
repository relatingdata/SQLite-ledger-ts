# Glossario

Termini reali effettivamente usati da questa applicazione — dove due parole indicano esattamente la stessa cosa reale in questa applicazione, ciò viene detto direttamente, non lasciato indovinare.

Questo è un documento vivo, costruito insieme a una vera verifica di coerenza delle schermate stesse dell'applicazione — i termini vengono aggiunti man mano che vengono effettivamente incontrati, non inventati in anticipo.

*Tradotto dall'originale inglese (`docs/glossary.md`), facendo riferimento alle traduzioni reali e pubblicate di LedgerSMB e GnuCash dove pertinenti — e al vocabolario già stabilito in questa stessa applicazione, per restare coerenti con ciò che l'utente vede realmente a schermo.*

---

### Conto (Account)

Un'**entità** reale e ordinaria (vedi sotto) che può avere un **saldo** — un totale corrente nelle unità minime (centesimi). Non un tipo di cosa separato nel database; qualsiasi entità diventa un conto nel momento in cui vi si registra qualcosa. Vedi `docs/entity-model.md`.

### Debiti verso fornitori (AP) = Conti fornitori

Il conto/mastro reale sotto il quale si trova ogni **fornitore** reale, e il lato dei libri che tiene traccia di ciò che questa azienda deve. "Accounts Payable" e "Creditors" (creditori) sono esattamente la stessa cosa reale — i menu di questa applicazione mostrano entrambi i termini fianco a fianco, poiché persone e tradizioni contabili diverse usano l'uno o l'altro.

### Crediti verso clienti (AR) = Conti clienti

Lo specchio dei debiti verso fornitori — il conto/mastro reale sotto il quale si trova ogni **cliente** reale, che tiene traccia di ciò che i clienti devono a questa azienda. "Accounts Receivable" e "Debtors" (debitori) sono la stessa cosa reale.

### Stato patrimoniale (Balance Sheet)

Un report reale: tutto ciò che l'azienda possiede (**attivo**) deve essere uguale a tutto ciò che deve, più ciò che i proprietari vi hanno conferito o guadagnato (**passivo** + **patrimonio netto**), a una data specifica. Se non torna, c'è realmente qualcosa che non va.

### Azienda (Business)

Un'entità reale di primo livello che rappresenta una società o un'organizzazione — ha le proprie foglie reali del piano dei conti (vedi **famiglia del piano dei conti**), i propri **mastri/registri**, e le proprie **sedi**.

### Categoria (categoria di prodotto)

Qualsiasi entità reale sotto "Parts" (articoli) che abbia almeno un figlio reale (che quel figlio sia un'altra categoria più profonda o un prodotto vero e proprio) — ad esempio "Beer" (birra) è una categoria, "Ale" ne è una sottocategoria. Realmente configurabile dall'utente: le categorie si creano, rinominano o annidano dalla pagina Articoli o dall'Editor strutturato, senza alcuna modifica al codice, e i conti reali di vendita/costo del venduto sul lato contabile rispecchiano automaticamente qualunque forma abbia realmente l'albero delle categorie.

### Piano dei conti (Chart of Accounts, CoA)

L'albero reale di ogni conto su cui un'azienda può registrare — Attivo, Passivo, Patrimonio netto, Ricavi e Costi sono le cinque categorie di primo livello realmente universali in cui ogni azienda reale (in qualsiasi paese) raggruppa i propri conti.

### Famiglia del piano dei conti (CoA family)

Un insieme reale e specifico per paese di conti foglia sotto il piano dei conti — confermato direttamente, non presunto, che si tratta realmente di entità distinte, non solo di nomi visualizzati diversi: "Cash and Bank" (inglese/generico), "Bankkontokorrent" (tedesco), "Banca c/c" (italiano), "Kasse" (svizzero) sono tutti conti reali e distinti. Una nuova azienda sceglie quale famiglia reale riutilizzare, invece di inventarne una nuova.

### Periodo chiuso (Closed period)

Un intervallo di date reale che un'azienda ha bloccato — non sono consentite nuove registrazioni o modifiche alla data di chiusura o prima. Vedi **Chiusura di fine anno**.

### Costo del venduto (COGS, Cost of Goods Sold)

Il conto di costo reale che tiene traccia di quanto un prodotto sia realmente costato all'azienda, rilevato nel momento in cui viene venduto — non quando è stato acquistato. Contrassegnato tramite **relazione**, in modo che i calcoli del **margine lordo** lo considerino correttamente.

### Contatto (Contact)

L'indirizzo, il telefono, l'email e le condizioni di pagamento reali collegati a qualsiasi entità — un cliente, fornitore, dipendente, produttore o sede possono tutti avere dati di contatto, tramite esattamente lo stesso meccanismo.

### Cliente = un conto clienti reale

Un cliente non è un tipo di record separato — è un'entità reale che si trova sotto i conti clienti. La stessa entità potrebbe, in linea di principio, essere anche un fornitore o un dipendente se fosse collocata anche altrove (oggi però ogni ruolo è un'entità reale distinta).

### Divisione (Division)

Un'entità reale e ordinaria sotto "Divisions", che rappresenta un centro di profitto o un centro di costo — può essere essa stessa annidata (ad es. "Retail" → "Retail North"), la stessa gerarchia reale che può avere una categoria di prodotto. Un **centro di profitto** può registrare su ricavi o costi; un **centro di costo** è limitato ai costi. La chiusura di fine anno trasferisce correttamente l'utile netto di ogni divisione nella propria voce reale di utili portati a nuovo, non in un'unica cifra mescolata.

### Entità (Entity)

L'unico mattone reale e universale di cui è fatta questa intera applicazione — ogni azienda, mastro/registro, conto, cliente, fornitore, prodotto, sede e divisione è lo stesso tipo sottostante di record (un nome, un genitore reale per la gerarchia, una **relazione** laterale opzionale), semplicemente usato in un punto diverso dell'albero. Vedi `docs/entity-model.md` per il ragionamento completo.

### Editor dell'albero delle entità / Editor strutturato

L'unica schermata generica in grado di creare, rinominare, riassegnare il genitore o modificare la relazione di qualsiasi entità direttamente — la "via di fuga" che funziona anche dove non esiste ancora una schermata dedicata. Diverse schermate dedicate (categorie di prodotto, divisioni) ora non ne hanno più bisogno per il loro caso d'uso comune.

### Esercizio finanziario (Financial year)

Il periodo di un anno per cui viene preparato il mastro Budget di un'azienda (ad es. "2026-27") — testo libero, non calcolato dalla data odierna, poiché l'inizio reale di un esercizio finanziario varia realmente da paese a paese.

### Margine lordo (Gross Profit)

I ricavi di vendita reali meno il costo del venduto reale, per un dato periodo — ciò che un'azienda ha guadagnato su ciò che ha venduto, prima delle altre spese operative.

### Mastro / Registro (Ledger)

Un insieme reale e nominato di registrazioni sotto un'azienda — "Actual" per i libri reali e correnti; un mastro Budget è un mastro reale e separato che contiene un piano con cui confrontare l'"Actual", tramite esattamente lo stesso meccanismo (registrare movimenti, eseguire gli stessi report) della contabilità reale.

### Sede (Location)

Un luogo fisico reale dove si trova la merce — un magazzino o un punto vendita. Definita per ogni singola azienda (ogni azienda ha il proprio gruppo reale "{azienda} Locations"). Tiene traccia della capacità reale in bottiglie/cartoni, suddivisa in stoccaggio a scaffale e refrigerato dove pertinente.

### Produttore (Manufacturer)

Un'entità reale che rappresenta chi produce realmente un prodotto — distinta dal **fornitore** (presso cui l'azienda acquista), poiché i due non sono sempre la stessa società.

### Terminale POS = Registratore di cassa (POS Terminal = Cash Register)

Esattamente la stessa cosa reale, due nomi diversi per indicarla — la schermata reale, rivolta al personale, per registrare una vendita in negozio (scansionare o cercare un prodotto, incassare in contanti o con carta, stampare uno scontrino). "Registratore di cassa" è il termine più tradizionale, ancora molto diffuso nel linguaggio quotidiano, per esattamente la stessa funzione; questa applicazione chiama questa schermata "Terminale POS", ma i due termini sono intercambiabili.

### Articolo = Prodotto (Part = Product)

Intercambiabili in questa applicazione — un bene reale, vendibile/acquistabile, collocato sotto una **categoria** reale.

### Fonte di approvvigionamento (Part Source)

Il collegamento reale tra un prodotto e un fornitore/produttore che lo fornisce — porta il codice specifico del fornitore, il prezzo e la quantità per confezione, poiché questi variano realmente a seconda di presso chi si acquista.

### Riferimento (Reference)

L'identificativo reale, scelto da una persona, di una registrazione (ad es. "GJ-1001", "PO-4021") — richiesto in ogni registrazione reale.

### Relazione (Relation)

L'unico puntatore laterale reale e opzionale che ogni entità può avere, distinto dal suo genitore reale — usato ad esempio per contrassegnare un conto come appartenente a una categoria di report, o come marcatore di costo del venduto. Diverso dal **genitore** (Parent), che è la posizione reale nella gerarchia.

### Utili portati a nuovo (Retained Earnings)

Il conto di patrimonio netto reale che accumula l'utile netto (o la perdita) di un'azienda nel tempo, su ogni periodo mai chiuso.

### Bilancio di verifica (Trial Balance)

Un report reale che elenca il saldo reale di ogni conto, suddiviso nel suo lato dare o avere — la verifica reale più elementare che i libri siano internamente coerenti (il totale dare deve essere uguale al totale avere).

### Fornitore = Supplier = un conto fornitori reale

Esattamente la stessa cosa reale, tre parole diverse per indicarla. Un fornitore si crea creando un'entità sotto "Accounts Payable" — non esiste un tipo di record separato "Supplier".

### Chiusura di fine anno (Year End Close)

Una registrazione reale che azzera ogni conto reale di ricavi e costi e trasferisce la differenza netta agli utili portati a nuovo — il modo reale e consueto in cui un'azienda "chiude i libri" per un periodo. Gestisce correttamente più divisioni reali, trasferendo l'utile netto di ogni divisione nella propria voce reale di utili portati a nuovo.
