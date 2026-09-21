# Glossaire

Termes réels utilisés par cette application — lorsque deux mots désignent exactement la même chose réelle dans cette application, cela est dit directement, sans laisser le lecteur deviner.

Ceci est un document vivant, construit parallèlement à un véritable audit de cohérence des écrans de l'application — les termes sont ajoutés au fur et à mesure qu'ils sont réellement rencontrés, pas inventés à l'avance.

*Traduit à partir de l'original anglais (`docs/glossary.md`), en s'appuyant sur les traductions réelles et publiées de LedgerSMB et GnuCash lorsqu'elles convenaient — et sur le vocabulaire déjà établi dans cette application elle-même, pour rester cohérent avec ce que l'utilisateur voit réellement à l'écran.*

---

### Compte (Account)

Une **entité** réelle et ordinaire (voir plus bas) qui peut porter un **solde** — un total courant en plus petites unités (centimes). Ce n'est pas un type de chose distinct dans la base de données ; toute entité devient un compte dès qu'une écriture y est passée. Voir `docs/entity-model.md`.

### Comptes fournisseurs (AP) = Créditeurs

Le compte-titre réel sous lequel se trouve chaque **fournisseur** réel, et le côté des livres qui suit ce que cette entreprise doit. « Accounts Payable » et « Creditors » (créditeurs) sont exactement la même chose réelle — les menus de cette application affichent les deux termes côte à côte, car différentes personnes et traditions comptables emploient l'un ou l'autre.

### Comptes clients (AR) = Débiteurs

Le miroir des comptes fournisseurs — le compte-titre réel sous lequel se trouve chaque **client** réel, et qui suit ce que les clients doivent à cette entreprise. « Accounts Receivable » et « Debtors » (débiteurs) sont la même chose réelle.

### Bilan (Balance Sheet)

Un rapport réel : tout ce que l'entreprise possède (**Actif**) doit être égal à tout ce qu'elle doit, plus ce que les propriétaires y ont apporté ou qu'elle a gagné (**Passif** + **Capitaux propres**), à une date donnée. S'il ne s'équilibre pas, quelque chose est réellement faux.

### Entreprise (Business)

Une entité réelle de premier niveau représentant une société ou une organisation — possède ses propres feuilles réelles de plan comptable (voir **prototype de plan comptable**), ses propres **journaux/livres**, et ses propres **emplacements**.

### Catégorie (catégorie de produit)

Toute entité réelle sous « Parts » (articles) ayant au moins un enfant réel (que cet enfant soit une catégorie plus profonde ou un produit réel) — par exemple, « Beer » (bière) est une catégorie, « Ale » en est une sous-catégorie. Véritablement configurable par l'utilisateur : les catégories se créent, se renomment ou s'imbriquent depuis la page Articles ou l'Éditeur structuré, sans aucune modification de code, et les comptes réels de vente/coût des marchandises vendues du côté comptable reflètent automatiquement la forme réelle de l'arbre de catégories.

### Plan comptable (Chart of Accounts, CoA)

L'arbre réel de chaque compte sur lequel une entreprise peut passer une écriture — Actif, Passif, Capitaux propres, Produits et Charges sont les cinq catégories de premier niveau véritablement universelles dans lesquelles toute entreprise réelle (dans n'importe quel pays) regroupe ses comptes.

### Prototype de plan comptable (CoA prototype)

Un ensemble réel et spécifique à un pays de comptes-feuilles sous le plan comptable — confirmé directement, non supposé, que ce sont réellement des entités distinctes, pas de simples noms d'affichage différents : « Cash and Bank » (anglais/générique), « Bankkontokorrent » (allemand), « Banca c/c » (italien), « Kasse » (suisse) sont tous des comptes réels et distincts. Une nouvelle entreprise choisit quel prototype réel réutiliser plutôt que d'en inventer un nouveau.

### Période clôturée (Closed period)

Une plage de dates réelle qu'une entreprise a verrouillée — aucune nouvelle écriture ni modification n'est autorisée à la date de clôture ou avant. Voir **Clôture de fin d'exercice**.

### Coût des marchandises vendues (COGS)

Le compte de charge réel qui suit ce qu'un produit a réellement coûté à l'entreprise, comptabilisé au moment de la vente — pas au moment de l'achat. Marqué via **relation** pour que les calculs de **marge brute** le prennent correctement en compte.

### Contact

L'adresse, le téléphone, l'e-mail et les conditions de paiement réels rattachés à n'importe quelle entité — un client, fournisseur, employé, fabricant ou emplacement peut tous avoir des coordonnées, via exactement le même mécanisme.

### Client = un compte client réel

Un client n'est pas un type d'enregistrement distinct — c'est une entité réelle qui se trouve être sous les comptes clients. La même entité pourrait, en principe, être aussi fournisseur ou employé si elle était également rattachée ailleurs (aujourd'hui, chaque rôle est une entité réelle distincte).

### Division

Une entité réelle et ordinaire sous « Divisions », représentant un centre de profit ou un centre de coûts — peut elle-même être imbriquée (par exemple « Retail » → « Retail North »), la même hiérarchie réelle qu'une catégorie de produit peut avoir. Un **centre de profit** peut passer des écritures en produits ou en charges ; un **centre de coûts** est limité aux charges. La clôture de fin d'exercice reporte correctement le résultat net de chaque division dans sa propre ligne réelle de report à nouveau, pas dans un chiffre unique mélangé.

### Entité (Entity)

L'unique brique réelle et universelle dont toute cette application est faite — chaque entreprise, journal/livre, compte, client, fournisseur, produit, emplacement et division est le même type de fond d'enregistrement (un nom, un parent réel pour la hiérarchie, une **relation** latérale optionnelle), simplement utilisé à un endroit différent de l'arbre. Voir `docs/entity-model.md` pour le raisonnement complet.

### Éditeur d'arbre d'entités / Éditeur structuré

L'unique écran générique capable de créer, renommer, redéplacer ou modifier la relation de n'importe quelle entité directement — la « solution de secours » qui fonctionne même là où un écran dédié n'existe pas encore. Plusieurs écrans dédiés (catégories de produits, divisions) n'en ont désormais plus besoin pour leur cas d'usage courant.

### Exercice comptable (Financial year)

La période d'un an pour laquelle le journal Budget d'une entreprise est préparé (par exemple « 2026-27 ») — texte libre, non calculé à partir de la date du jour, car le début réel d'un exercice comptable varie réellement selon les pays.

### Marge brute (Gross Profit)

Le chiffre d'affaires réel des ventes moins le coût des marchandises vendues réel, pour une période donnée — ce que l'entreprise a gagné sur ce qu'elle a vendu, avant les autres charges d'exploitation.

### Journal / Livre (Ledger)

Un ensemble réel et nommé d'écritures sous une entreprise — « Actual » pour les livres réels et courants ; un journal Budget est un journal réel et distinct contenant un plan auquel comparer l'« Actual », via exactement le même mécanisme (passer des écritures, exécuter les mêmes rapports) que la comptabilité réelle.

### Emplacement (Location)

Un lieu physique réel où se trouve le stock — un entrepôt ou un point de vente. Rattaché à chaque entreprise séparément (chaque entreprise possède son propre groupe réel « {entreprise} Locations »). Suit la capacité réelle en bouteilles/cartons, répartie entre stockage en rayon et stockage réfrigéré le cas échéant.

### Fabricant (Manufacturer)

Une entité réelle représentant qui fabrique réellement un produit — distincte du **fournisseur** (chez qui l'entreprise achète), car les deux ne sont pas toujours la même société.

### Terminal de caisse = Caisse enregistreuse (POS Terminal = Cash Register)

Exactement la même chose réelle, deux noms différents pour la désigner — l'écran réel, destiné au personnel, pour encaisser une vente en magasin (scanner ou rechercher un produit, encaisser en espèces ou par carte, imprimer un reçu). « Caisse enregistreuse » est le terme plus ancien, encore très courant dans le langage quotidien, pour exactement la même fonction ; cette application appelle cet écran « Terminal de caisse », mais les deux termes sont interchangeables.

### Article = Produit (Part = Product)

Interchangeables dans cette application — un bien réel, vendable/achetable, se trouvant sous une **catégorie** réelle.

### Source d'approvisionnement (Part Source)

Le lien réel entre un produit et un fournisseur/fabricant qui le fournit — porte la référence spécifique au fournisseur, le prix et la taille du colis, car ceux-ci varient réellement selon chez qui on achète.

### Référence (Reference)

L'identifiant réel, choisi par une personne, d'une écriture (par exemple « GJ-1001 », « PO-4021 ») — requis sur chaque écriture réelle.

### Relation

L'unique pointeur latéral réel et optionnel que chaque entité peut avoir, distinct de son parent réel — utilisé par exemple pour marquer un compte comme appartenant à une catégorie de rapport, ou comme marqueur de coût des marchandises vendues. Différent du **parent**, qui est la position réelle dans la hiérarchie.

### Report à nouveau (Retained Earnings)

Le compte de capitaux propres réel qui accumule le résultat net (ou la perte) d'une entreprise dans le temps, sur chaque période jamais clôturée.

### Balance de vérification (Trial Balance)

Un rapport réel listant le solde réel de chaque compte, réparti entre son côté débit ou crédit — la vérification réelle la plus élémentaire que les livres sont cohérents en interne (le total des débits doit être égal au total des crédits).

### Fournisseur = Supplier = un compte fournisseur réel

Exactement la même chose réelle, trois mots différents pour la désigner. Un fournisseur se crée en créant une entité sous « Accounts Payable » — il n'existe pas de type d'enregistrement distinct « Supplier ».

### Clôture de fin d'exercice (Year End Close)

Une écriture réelle qui ramène à zéro chaque compte réel de produits et de charges, et transfère la différence nette vers le report à nouveau — la façon réelle et habituelle dont une entreprise « clôture les livres » d'une période. Traite correctement plusieurs divisions réelles, en reportant le résultat net de chaque division dans sa propre ligne réelle de report à nouveau.
