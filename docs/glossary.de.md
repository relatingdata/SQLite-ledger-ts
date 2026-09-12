# Glossar

Reale Begriffe, die diese Anwendung tatsächlich verwendet — wo zwei Wörter genau dasselbe reale Ding bezeichnen, wird das direkt gesagt, nicht dem Erraten überlassen.

Dies ist ein lebendiges Dokument, aufgebaut im Rahmen einer echten Konsistenzprüfung der Bildschirme dieser Anwendung — Begriffe werden hinzugefügt, sobald sie tatsächlich auftauchen, nicht im Voraus erfunden.

*Übersetzt aus dem englischen Original (`docs/glossary.md`), unter Bezug auf die echten, veröffentlichten Übersetzungen von LedgerSMB und GnuCash, wo diese passten — siehe die Anmerkung am Ende zu einer echten, interessanten Abweichung beim Begriff „Summen- und Saldenliste".*

---

### Konto (Account)

Eine reale, gewöhnliche **Entität** (siehe unten), die einen **Saldo** führen kann — eine laufende Summe in kleinsten Einheiten (Cent). In der Datenbank keine eigene Art von Ding; jede Entität wird zum Konto, sobald etwas darauf gebucht wird. Siehe `docs/entity-model.md`.

### Verbindlichkeiten (AP) = Kreditoren

Das reale Sammelkonto, unter dem jeder reale **Lieferant** liegt, und die Seite der Bücher, die festhält, was dieses Unternehmen schuldet. „Accounts Payable" und „Creditors" (Kreditoren) sind exakt dasselbe reale Ding — die Menüs dieser Anwendung nennen beide Begriffe nebeneinander, da unterschiedliche Personen und Buchhaltungstraditionen den einen oder den anderen Begriff verwenden.

### Forderungen (AR) = Debitoren

Das Spiegelbild der Verbindlichkeiten — das reale Sammelkonto, unter dem jeder reale **Kunde** liegt, und das festhält, was Kunden diesem Unternehmen schulden. „Accounts Receivable" und „Debtors" (Debitoren) sind dasselbe reale Ding.

### Bilanz (Balance Sheet)

Ein realer Bericht: alles, was das Unternehmen besitzt (**Aktiva**), muss gleich sein mit allem, was es schuldet, plus dem, was die Eigentümer eingebracht oder erwirtschaftet haben (**Passiva** + **Eigenkapital**), zu einem bestimmten Stichtag. Stimmt sie nicht, liegt tatsächlich ein Fehler vor.

### Unternehmen (Business)

Eine reale, oberste Entität, die eine Firma oder Organisation darstellt — hat eigene reale Kontenrahmen-Blätter (siehe **Kontenrahmen-Familie**), eigene **Hauptbücher** und eigene **Standorte**.

### Kategorie (Produktkategorie)

Jede reale Entität unter „Parts" (Artikel), die mindestens ein reales Kind hat (egal ob dieses Kind eine weitere, tiefere Kategorie oder ein tatsächliches Produkt ist) — z. B. ist „Beer" (Bier) eine Kategorie, „Ale" eine Unterkategorie darunter. Echt vom Anwender konfigurierbar: Kategorien werden über die Artikelseite oder den Strukturierten Editor angelegt, umbenannt oder verschachtelt, ganz ohne Codeänderungen, und die realen Erlös-/Wareneinsatzkonten auf der Hauptbuchseite spiegeln automatisch, welche Form der Kategoriebaum tatsächlich hat.

### Kontenrahmen (Chart of Accounts, CoA)

Der reale Baum jedes Kontos, auf das ein Unternehmen buchen kann — Aktiva, Passiva, Eigenkapital, Ertrag und Aufwand sind die fünf, wirklich universellen obersten Kategorien, in die jedes reale Unternehmen (in jedem Land) seine Konten einordnet.

### Kontenrahmen-Familie (CoA family)

Ein realer, länderspezifischer Satz von Blattkonten unter dem Kontenrahmen — direkt bestätigt, nicht angenommen, dass dies wirklich unterschiedliche Entitäten sind, nicht nur unterschiedliche Anzeigenamen: „Cash and Bank" (Englisch/allgemein), „Bankkontokorrent" (Deutsch), „Banca c/c" (Italienisch), „Kasse" (Schweiz) sind alles reale, eigenständige Konten. Ein neues Unternehmen wählt aus, welche reale Familie es weiterverwenden will, statt eine neue zu erfinden.

### Geschlossene Periode (Closed period)

Ein realer Datumsbereich, den ein Unternehmen gesperrt hat — keine neuen Buchungen oder Änderungen sind am oder vor dem Abschlussdatum erlaubt. Siehe **Jahresabschluss**.

### Wareneinsatz (COGS, Cost of Goods Sold)

Das reale Aufwandskonto, das festhält, was ein Produkt das Unternehmen tatsächlich gekostet hat — erfasst im Moment des Verkaufs, nicht im Moment des Einkaufs. Über **Relation** markiert, damit **Rohertrag**-Berechnungen es korrekt erfassen.

### Kontakt (Contact)

Die reale Adresse, Telefonnummer, E-Mail und Zahlungsbedingungen, die an jeder Entität hängen können — ein Kunde, Lieferant, Mitarbeiter, Hersteller oder Standort kann alle Kontaktdaten haben, über exakt denselben Mechanismus.

### Kunde = ein reales Forderungskonto

Ein Kunde ist kein eigener Datensatztyp — es ist eine reale Entität, die zufällig unter den Forderungen liegt. Dieselbe Entität könnte im Prinzip auch Lieferant oder Mitarbeiter sein, wenn sie auch anderswo eingeordnet wäre (heute ist jede Rolle aber eine eigene, reale Entität).

### Abteilung (Division)

Eine reale, gewöhnliche Entität unter „Divisions", die ein Profit- oder Kostenzentrum darstellt — kann selbst verschachtelt sein (z. B. „Retail" → „Retail North"), dieselbe reale Hierarchie, die eine Produktkategorie haben kann. Ein **Profit-Center** kann auf Ertrag oder Aufwand buchen; ein **Kosten-Center** ist auf Aufwand beschränkt. Der Jahresabschluss überträgt den Nettoertrag jeder Abteilung korrekt in ihre eigene reale Gewinnvortrag-Zeile, nicht in eine vermischte Summe.

### Entität (Entity)

Der eine, reale, universelle Baustein, aus dem diese gesamte Anwendung besteht — jedes Unternehmen, Hauptbuch, Konto, jeder Kunde, Lieferant, jedes Produkt, jeder Standort und jede Abteilung ist dieselbe zugrundeliegende Art von Datensatz (ein Name, ein realer übergeordneter Knoten für die Hierarchie, eine optionale seitliche **Relation**), nur an einer anderen Stelle im Baum verwendet. Siehe `docs/entity-model.md` für die vollständige Begründung.

### Entitätsbaum-Editor / Strukturierter Editor

Der eine, allgemeine Bildschirm, der jede Entität direkt anlegen, umbenennen, neu einordnen oder deren Relation ändern kann — die „Rückfalllösung", die auch dort funktioniert, wo es noch keinen eigenen Bildschirm gibt. Mehrere eigene Bildschirme (Produktkategorien, Abteilungen) benötigen ihn inzwischen für ihren eigenen, häufigen Fall nicht mehr.

### Geschäftsjahr (Financial year)

Der einjährige Zeitraum, für den das Budget-Hauptbuch eines Unternehmens erstellt wird (z. B. „2026-27") — Freitext, nicht aus dem heutigen Datum berechnet, da der reale Beginn eines Geschäftsjahres tatsächlich von Land zu Land verschieden ist.

### Rohertrag (Gross Profit)

Realer Verkaufserlös minus realer Wareneinsatz, für einen bestimmten Zeitraum — was ein Unternehmen an dem verdient hat, was es verkauft hat, vor sonstigen Betriebsaufwendungen.

### Hauptbuch (Ledger)

Eine reale, benannte Menge von Buchungen unter einem Unternehmen — „Actual" für die echten, laufenden Bücher; ein Budget-Hauptbuch ist ein reales, eigenes Hauptbuch mit einem Plan, gegen den man das „Actual" vergleicht, über denselben Mechanismus (Buchungen erfassen, dieselben Berichte laufen lassen) wie die echte Buchführung.

### Standort (Location)

Ein realer, physischer Ort, an dem Ware liegt — ein Lager oder eine Verkaufsstelle. Je Unternehmen abgegrenzt (jedes Unternehmen hat seine eigene reale „{Unternehmen} Locations"-Übergruppe). Erfasst reale Flaschen-/Kartonkapazität, aufgeteilt in Regal- und Kühllagerung, wo relevant.

### Hersteller (Manufacturer)

Eine reale Entität, die darstellt, wer ein Produkt tatsächlich herstellt — zu unterscheiden vom **Lieferanten** (bei wem ein Unternehmen einkauft), da beide nicht immer dieselbe Firma sind.

### Kassenterminal = Kasse (POS Terminal = Cash Register)

Dasselbe reale Ding, zwei unterschiedliche Namen dafür — der reale, für das Personal gedachte Bildschirm zum Abkassieren eines Verkaufs vor Ort (Produkt scannen oder suchen, bar oder mit Karte bezahlen, Beleg drucken). „Kasse" ist der ältere, im Alltag nach wie vor sehr gebräuchliche Begriff für genau dieselbe Funktion; diese Anwendung nennt den Bildschirm „Kassenterminal", beide Begriffe sind aber austauschbar.

### Artikel = Produkt (Part = Product)

In dieser Anwendung austauschbar — ein reales, verkauf-/einkaufbares Ding, das unter einer realen **Kategorie** liegt.

### Bezugsquelle (Part Source)

Die reale Verknüpfung zwischen einem Produkt und einem Lieferanten/Hersteller, der es liefert — trägt die lieferantenspezifische Artikelnummer, den Preis und die Gebindemenge, da diese sich tatsächlich danach richten, bei wem man einkauft.

### Referenz (Reference)

Die reale, vom Menschen gewählte Kennung einer Buchung (z. B. „GJ-1001", „PO-4021") — bei jeder realen Buchung erforderlich.

### Relation

Der eine, reale, optionale seitliche Zeiger, den jede Entität haben kann, getrennt von ihrem realen übergeordneten Knoten — verwendet z. B. um ein Konto als zu einer Berichtskategorie gehörend zu markieren, oder als Wareneinsatz-Markierung. Zu unterscheiden vom **übergeordneten Knoten** (Parent), der die reale Position in der Hierarchie ist.

### Gewinnvortrag (Retained Earnings)

Das reale Eigenkapitalkonto, das den Nettoertrag (oder -verlust) eines Unternehmens über die Zeit ansammelt, über jede Periode hinweg, die je abgeschlossen wurde.

### Summen- und Saldenliste (Trial Balance)

Ein realer Bericht, der den realen Saldo jedes Kontos auflistet, aufgeteilt in Soll- oder Habenseite — die grundlegendste reale Prüfung, dass die Bücher in sich stimmig sind (Soll-Summe muss gleich Haben-Summe sein).

*Eine echte, interessante Abweichung, nicht verschwiegen: GnuCash übersetzt „Trial Balance" mit „Rohbilanz", einem eher klassischen/lehrbuchhaften Begriff. Diese Anwendung verwendet stattdessen „Summen- und Saldenliste", den in moderner deutscher Buchhaltungssoftware (SAP, DATEV und ähnliche) gebräuchlicheren Begriff — beide sind reale, verwendete Begriffe im Deutschen.*

### Lieferant = Supplier = ein reales Verbindlichkeitskonto

Genau dasselbe reale Ding, drei verschiedene Wörter dafür. Ein Lieferant wird angelegt, indem eine Entität unter „Accounts Payable" erstellt wird — es gibt keinen eigenen Datensatztyp „Supplier".

### Jahresabschluss (Year End Close)

Eine reale Buchung, die jedes reale Ertrags- und Aufwandskonto auf null setzt und die Nettodifferenz in den Gewinnvortrag überträgt — die übliche, reale Art, wie ein Unternehmen die Bücher für eine Periode „abschließt". Behandelt mehrere reale Abteilungen korrekt und überträgt den Nettoertrag jeder Abteilung in ihre eigene reale Gewinnvortrag-Zeile.
