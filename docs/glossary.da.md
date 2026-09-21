# Ordliste

Rigtige begreber, som denne applikation faktisk bruger — hvor to ord betyder præcis det samme rigtige i denne applikation, siges det direkte, ikke overladt til gætteri.

Dette er et levende dokument, opbygget sideløbende med et rigtigt konsistenstjek af applikationens egne skærmbilleder — begreber tilføjes, efterhånden som de faktisk dukker op, ikke opfundet på forhånd.

*Oversat fra den engelske original (`docs/glossary.md`), med henvisning til de rigtige, offentliggjorte oversættelser fra LedgerSMB og GnuCash, hvor de passede — og til den ordforråd, applikationen selv allerede bruger, for at være i overensstemmelse med det, brugeren faktisk ser på skærmen.*

---

### Konto (Account)

En rigtig, almindelig **entitet** (se nedenfor), der kan have en **saldo** — en løbende sum i mindste enheder (øre). Ikke en separat slags ting i databasen; enhver entitet bliver en konto, i det øjeblik der bogføres noget på den. Se `docs/entity-model.md`.

### Kreditorer (AP) = Leverandørgæld

Den rigtige samlekonto, som hver rigtig **leverandør** ligger under, og den side af bøgerne, der holder styr på, hvad virksomheden skylder. "Accounts Payable" og "Creditors" (kreditorer) er præcis den samme rigtige ting — applikationens egne menuer viser begge udtryk side om side, da forskellige mennesker og regnskabstraditioner bruger det ene eller det andet.

### Debitorer (AR) = Tilgodehavender

Spejlbilledet af kreditorer — den rigtige samlekonto, som hver rigtig **kunde** ligger under, og som holder styr på, hvad kunder skylder virksomheden. "Accounts Receivable" og "Debtors" (debitorer) er den samme rigtige ting.

### Statusopgørelse / Balance (Balance Sheet)

En rigtig rapport: alt, hvad virksomheden ejer (**aktiver**), skal være lig med alt, hvad den skylder, plus hvad ejerne har indskudt eller tjent (**passiver** + **egenkapital**), på én bestemt dato. Går det ikke op, er der reelt noget galt.

### Virksomhed (Business)

En rigtig, øverste entitet, der repræsenterer én virksomhed eller organisation — har sine egne rigtige kontoplan-blade (se **kontoplan-prototype**), sine egne **hovedbøger** og sine egne **lokationer**.

### Kategori (produktkategori)

Enhver rigtig entitet under "Parts" (varer), der har mindst ét rigtigt barn (uanset om det barn er endnu en, dybere kategori eller et faktisk produkt) — f.eks. er "Beer" (øl) en kategori, "Ale" er en underkategori derunder. Reelt konfigurerbart af brugeren: kategorier oprettes, omdøbes eller nestes gennem varesiden eller den strukturerede editor, helt uden kodeændringer, og de rigtige salgs-/vareforbrugskonti på hovedbogssiden afspejler automatisk, hvilken form kategoritræet reelt har.

### Kontoplan (Chart of Accounts, CoA)

Det rigtige træ af hver konto, en virksomhed kan bogføre på — aktiver, passiver, egenkapital, indtægter og omkostninger er de fem, reelt universelle øverste kategorier, som enhver rigtig virksomhed (i ethvert land) grupperer sine konti i.

### Kontoplan-prototype (CoA prototype)

Et rigtigt, landespecifikt sæt af bladkonti under kontoplanen — bekræftet direkte, ikke antaget, at disse reelt er forskellige entiteter, ikke bare forskellige visningsnavne: "Cash and Bank" (engelsk/generisk), "Bankkontokorrent" (tysk), "Banca c/c" (italiensk), "Kasse" (schweizisk) er alle rigtige, selvstændige konti. En ny virksomhed vælger, hvilken rigtig prototype den vil genbruge, i stedet for at opfinde en ny.

### Lukket periode (Closed period)

Et rigtigt datointerval, en virksomhed har låst — ingen nye posteringer eller ændringer er tilladt på eller før lukkedatoen. Se **Årsafslutning**.

### Vareforbrug (COGS, Cost of Goods Sold)

Den rigtige omkostningskonto, der holder styr på, hvad et produkt reelt har kostet virksomheden — bogført i det øjeblik det sælges, ikke når det blev købt. Mærket via **relation**, så beregninger af **bruttoresultat** fanger den korrekt.

### Kontaktperson (Contact)

Den rigtige adresse, telefon, e-mail og betalingsbetingelser, der er knyttet til enhver entitet — en kunde, leverandør, medarbejder, producent eller lokation kan alle have kontaktoplysninger, via præcis samme mekanisme.

### Kunde = en rigtig debitorkonto

En kunde er ikke en separat slags post — det er en rigtig entitet, der tilfældigvis ligger under debitorer. Den samme entitet kunne i princippet også være leverandør eller medarbejder, hvis den også var placeret et andet sted (i dag er hver rolle dog en separat, rigtig entitet).

### Afdeling (Division)

En rigtig, almindelig entitet under "Divisions", der repræsenterer et resultat- eller omkostningscenter — kan selv være nestet (f.eks. "Retail" → "Retail North"), samme rigtige hierarki som en produktkategori kan have. Et **resultatcenter** kan bogføre på indtægter eller omkostninger; et **omkostningscenter** er begrænset til omkostninger. Årsafslutningen overfører korrekt hver afdelings eget resultat til dens egen rigtige overført resultat-linje, ikke ét sammenblandet tal.

### Entitet (Entity)

Den ene, rigtige, universelle byggesten, hele denne applikation er lavet af — hver virksomhed, hovedbog, konto, kunde, leverandør, produkt, lokation og afdeling er den samme underliggende slags post (et navn, en rigtig forælder til hierarkiet, en valgfri, lateral **relation**), bare brugt et andet sted i træet. Se `docs/entity-model.md` for den fulde begrundelse.

### Entitetstræ-editor / Struktureret editor

Den ene, generiske skærm, der kan oprette, omdøbe, flytte eller ændre relationen for enhver entitet direkte — "nødløsningen", der virker, selv hvor der endnu ikke findes en dedikeret skærm. Flere dedikerede skærme (produktkategorier, afdelinger) har nu ikke længere brug for den til deres eget, almindelige tilfælde.

### Regnskabsår (Financial year)

Den étårige periode, en virksomheds budgethovedbog udarbejdes for (f.eks. "2026-27") — fri tekst, ikke beregnet ud fra dagens dato, da en reel regnskabsårs-start reelt varierer fra land til land.

### Bruttoresultat (Gross Profit)

Reel salgsomsætning minus reelt vareforbrug, for en given periode — hvad en virksomhed har tjent på det, den har solgt, før øvrige driftsomkostninger.

### Hovedbog (Ledger)

Et rigtigt, navngivet sæt af posteringer under én virksomhed — "Actual" for de rigtige, løbende bøger; en budgethovedbog er en rigtig, separat hovedbog med en plan at sammenligne "Actual" imod, via præcis samme mekanisme (bogføre posteringer, køre de samme rapporter) som rigtig bogføring.

### Lokation (Location)

Et rigtigt, fysisk sted, hvor varer befinder sig — et lager eller en butik. Afgrænset pr. virksomhed (hver virksomhed har sin egen rigtige "{virksomhed} Locations"-overgruppe). Holder styr på rigtig flaske-/kasse-kapacitet, opdelt i reol- og kølelager, hvor relevant.

### Producent (Manufacturer)

En rigtig entitet, der repræsenterer, hvem der faktisk fremstiller et produkt — adskilt fra **leverandøren** (hvem virksomheden køber hos), da de to ikke altid er den samme virksomhed.

### Kasseterminal = Kasseapparat (POS Terminal = Cash Register)

Præcis den samme rigtige ting, to forskellige navne for den — den rigtige, personalevendte skærm til at ekspedere et salg i butikken (scanne eller søge efter et produkt, tage imod kontant eller kort, udskrive en kvittering). "Kasseapparat" (eller blot "kasse") er det ældre, i daglig tale stadig meget udbredte udtryk for præcis samme funktion; denne applikation kalder skærmen "Kasseterminal", men begge udtryk kan bruges om hinanden.

### Vare = Produkt (Part = Product)

Kan bruges om hinanden i denne applikation — en rigtig, sælgelig/købelig ting, der ligger under en rigtig **kategori**.

### Vareforsyningskilde (Part Source)

Den rigtige forbindelse mellem et produkt og en leverandør/producent, der leverer det — bærer det leverandørspecifikke varenummer, pris og pakningsstørrelse, da disse reelt varierer efter, hvem man køber hos.

### Reference

Den rigtige, menneskevalgte identifikation af én postering (f.eks. "GJ-1001", "PO-4021") — påkrævet ved enhver rigtig postering.

### Relation

Den ene, rigtige, valgfrie, laterale peger, enhver entitet kan have, adskilt fra dens rigtige forælder — bruges f.eks. til at mærke en konto som hørende til en rapportkategori, eller som en vareforbrugs-markør. Adskilt fra **forælder** (Parent), som er den rigtige position i hierarkiet.

### Overført resultat (Retained Earnings)

Den rigtige egenkapitalkonto, der akkumulerer en virksomheds resultat (eller underskud) over tid, på tværs af hver periode, den nogensinde har afsluttet.

### Foreløbig status (Trial Balance)

En rigtig rapport, der lister hver kontos eget rigtige saldo, opdelt i dens debet- eller kreditside — det mest grundlæggende, rigtige tjek af, at bøgerne er internt konsistente (samlet debet skal være lig samlet kredit).

### Leverandør = Supplier = en rigtig kreditorkonto

Præcis den samme rigtige ting, tre forskellige ord for det. En leverandør oprettes ved at oprette en entitet under "Accounts Payable" — der findes ingen separat posttype "Supplier".

### Årsafslutning (Year End Close)

En rigtig postering, der nulstiller hver rigtig indtægts- og omkostningskonto og overfører nettodifferencen til overført resultat — den sædvanlige, rigtige måde, en virksomhed "lukker bøgerne" for en periode. Håndterer korrekt flere rigtige afdelinger, og overfører hver afdelings eget resultat til dens egen rigtige overført resultat-linje.
