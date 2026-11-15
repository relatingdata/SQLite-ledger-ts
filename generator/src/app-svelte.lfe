;;; Svelte (web) screens from the configuration entities.
;;;
;;; Each template is an ordinary function, run while the application is
;;; generated: it takes a screen's configuration and returns the page's
;;; text. Smaller functions (a field, a column's header and cell, a money
;;; input) are shared between templates. Nothing here is copied from the
;;; old hand-written pages; what a page shows and calls comes from the
;;; entities.

(defmodule app-svelte
  (export (screen 2)))

(defun val (s id rel) (app-entities:value s id rel))
(defun val (s id rel default) (app-entities:value s id rel default))

;; The page for a screen, by its Template.
(defun screen (s id)
  (case (val s id #"Template")
    (#"line-items-transaction" (line-items-transaction s id))
    (other (error (tuple 'no-template other (app-entities:name s id))))))

;; --- text helpers ---------------------------------------------------------------

(defun js (bin)
  (let* ((a (binary:replace bin #"\\" #"\\\\" '(global)))
         (b (binary:replace a #"'" #"\\'" '(global)))
         (c (binary:replace b #"\n" #"\\n" '(global))))
    (list #"'" c #"'")))

;; A word on screen: its translation, by vocabulary key.
(defun t (word) (list #"{t(" (js word) #")}"))

;; The branded-name wrapper the API module expects for a value of this name.
(defun brand (name)
  (case name
    (#"business" #"asBusinessName")
    (#"ledger" #"asLedgerName")
    (#"locationName" #"asLocationName")
    (#"vendorName" #"asProviderName")
    (#"customerName" #"asCustomerName")
    (#"itemName" #"asItemName")
    (_ 'none)))

(defun branded (name expr)
  (case (brand name) ('none expr) (fn (list fn #"(" expr #")"))))

;; --- the line-items transaction template -----------------------------------------
;;
;; Header fields, a grid of line items (one row per item, a blank row added
;; whenever every row is filled), a total, more fields, and one submit
;; call whose input object is built from the fields, the lines, the fixed
;; contact and the session's business and ledger.

(defun line-items-transaction (s id)
  (let* ((parts (app-entities:things s id))
         (fields (lists:filter (lambda (p) (== (app-entities:kind s p) #"Field")) parts))
         (columns (lists:filter (lambda (p) (== (app-entities:kind s p) #"Column")) parts))
         (inputs (lists:filter (lambda (c) (=/= (val s c #"Control") #"storage-badge")) columns))
         (badge? (lists:any (lambda (c) (== (val s c #"Control") #"storage-badge")) columns))
         (submit (app-entities:target s id #"Submit"))
         (client (val s submit #"Client"))
         (party-arg (val s id #"Party Argument"))
         (choices (lists:filter (lambda (f) (== (val s f #"Control") #"choose")) fields))
         (choice-clients (lists:map (lambda (f) (val s (app-entities:target s f #"Choices") #"Client")) choices))
         (before (lists:takewhile (lambda (p) (=/= (app-entities:kind s p) #"Column")) parts))
         (after (lists:filter (lambda (p) (and (== (app-entities:kind s p) #"Field") (not (lists:member p before)))) parts)))
    (list
      (script s id fields inputs badge? client party-arg choices choice-clients)
      #"\n"
      #"<svelte:head><title>" (t (val s id #"Title")) #"</title></svelte:head>\n\n"
      #"<fieldset class='page-title'>\n"
      #"  <legend>" (t (val s id #"Title")) #"</legend>\n"
      #"  <p class='intro'>" (t (val s id #"Intro")) #"</p>\n\n"
      #"  {#if loading}\n    <p class='center-text'>Loading&hellip;</p>\n  {:else}\n"
      #"    <p class='context-line'>\n"
      #"      <strong>{business}</strong> &mdash; {ledger} &mdash; " (t (val s id #"Party Label")) #": <strong>" (t (val s id #"Party")) #"</strong>\n"
      #"    </p>\n"
      (lists:map (lambda (f) (field s f)) before)
      (grid s inputs badge?)
      #"    {#if lines.length > 0}\n"
      #"      <p class='total-line'>" (t (val s id #"Total Label")) #": <strong>{fmt(totalMinor)}</strong> (" (t #"Tax") #": {fmt(taxMinor)})</p>\n"
      #"    {/if}\n"
      (lists:map (lambda (f) (field s f)) after)
      #"    {#if error}<p class='error'>{error}</p>{/if}\n"
      #"    {#if result}\n"
      #"      <p class='success'>" (t (val s id #"Done Label")) #": {result.reference} &mdash; {fmt(result.totalMinor)}</p>\n"
      #"    {/if}\n"
      #"    <button class='btn' onclick={submit} disabled={submitting || lines.filter((l) => l.itemName.trim()).length === 0}>\n"
      #"      {submitting ? 'Completing\\u2026' : t(" (js (val s id #"Submit Label")) #")}\n"
      #"    </button>\n"
      #"  {/if}\n"
      #"</fieldset>\n\n"
      (style))))

(defun script (s id fields inputs badge? client party-arg choices choice-clients)
  (let ((imports (lists:usort (++ (list #"getLedgers" client #"asBusinessName" #"asLedgerName" #"asItemName" #"ApiError")
                                  choice-clients
                                  (if badge? (list #"listItems" #"type ItemSummary") '())
                                  (lists:filtermap (lambda (n) (case (brand n) ('none 'false) (b (tuple 'true b))))
                                                   (cons party-arg (lists:map (lambda (f) (val s f #"Name")) fields)))))))
    (list
      #"<script lang='ts'>\n"
      #"  // Generated from application/application.entities (screen " (app-entities:name s id) #",\n"
      #"  // template line-items-transaction). Not source: change the entities.\n"
      #"  import { auth, session, translations } from '$lib/state.svelte';\n"
      #"  import { formatAmount } from '$lib/format';\n"
      #"  import { onMount } from 'svelte';\n"
      #"  import { " (lists:join #", " imports) #" } from '$lib/api';\n\n"
      #"  const t = (word: string) => translations.current[word] ?? word;\n"
      #"  const fmt = (minor: number) => formatAmount(minor, auth.current?.user.number_format ?? '1 000.00');\n\n"
      #"  let business = $state('');\n"
      #"  let ledger = $state('');\n"
      #"  let ledgers: { id: number; name: string }[] = $state([]);\n"
      (if badge? #"  let items: ItemSummary[] = $state([]);\n" #"")
      (lists:map (lambda (f) (field-state s f)) fields)
      #"\n  type Line = { key: number; " (lists:map (lambda (c) (list (val s c #"Name") #": " (line-type s c) #"; ")) inputs) #"};\n"
      #"  const newLine = (key: number): Line => ({ key, " (lists:join #", " (lists:map (lambda (c) (list (val s c #"Name") #": " (line-default s c))) inputs)) #" });\n"
      #"  let lines: Line[] = $state([newLine(0)]);\n"
      #"  let nextKey = 1;\n"
      #"  // A blank row is added whenever every row has an item.\n"
      #"  $effect(() => {\n    if (lines.length > 0 && lines.every((l) => l.itemName.trim())) lines = [...lines, newLine(nextKey++)];\n  });\n"
      #"  const removeLine = (key: number) => (lines = lines.filter((l) => l.key !== key));\n"
      #"  let subtotalMinor = $derived(lines.reduce((sum, l) => sum + l.quantity * l.unitPriceMinor, 0));\n"
      #"  let taxMinor = $derived(lines.reduce((sum, l) => sum + l.taxMinor, 0));\n"
      #"  let totalMinor = $derived(subtotalMinor + taxMinor);\n\n"
      #"  let loading = $state(true);\n  let submitting = $state(false);\n  let error = $state('');\n"
      #"  let result: { reference: string; totalMinor: number } | null = $state(null);\n\n"
      (if badge?
        (list #"  let itemsByName = $derived(new Map(items.map((i) => [i.name, i])));\n"
              #"  const storageOf = (name: string) => (name.trim() ? (itemsByName.get(name)?.storage_origin ?? null) : null);\n\n")
        #"")
      #"  onMount(async () => {\n"
      #"    try {\n"
      #"      if (!session.current) return;\n"
      #"      business = session.current.businessName;\n"
      (if badge? #"      items = (await listItems(business)).rows;\n" #"")
      #"      ledgers = await getLedgers(asBusinessName(business));\n"
      #"      const current = session.current.ledgerName;\n"
      #"      ledger = ledgers.some((l) => l.name === current) ? current : (ledgers[0]?.name ?? '');\n"
      (lists:zipwith (lambda (f c)
                       (let ((n (val s f #"Name")))
                         (list #"      " n #"Choices = await " c #"(asBusinessName(business));\n"
                               #"      if (!" n #" && " n #"Choices.length > 0) " n #" = " n #"Choices[0].name;\n")))
                     choices choice-clients)
      #"    } catch (e) {\n      error = e instanceof ApiError ? e.message : 'Failed to load.';\n"
      #"    } finally {\n      loading = false;\n    }\n  });\n\n"
      #"  async function submit() {\n"
      #"    if (!business || !ledger" (lists:map (lambda (f) (list #" || !" (val s f #"Name"))) choices) #") return;\n"
      #"    submitting = true;\n    error = '';\n    result = null;\n"
      #"    try {\n"
      #"      const filled = lines.filter((l) => l.itemName.trim()).map(({ key, ...l }) => ({ ...l, itemName: asItemName(l.itemName) }));\n"
      #"      const res = await " client #"({\n"
      #"        business: asBusinessName(business),\n"
      #"        ledger: asLedgerName(ledger),\n"
      (lists:map (lambda (f) (let ((n (val s f #"Name"))) (list #"        " n #": " (branded n n) #",\n"))) fields)
      #"        " party-arg #": " (branded party-arg (js (val s id #"Party"))) #",\n"
      #"        taxAccount: " (js (val s id #"Tax Account")) #",\n"
      #"        lines: filled,\n"
      #"      });\n"
      #"      result = { reference: res.reference, totalMinor: res.totalMinor };\n"
      #"      lines = [];\n"
      #"    } catch (e) {\n      error = e instanceof ApiError ? e.message : t(" (js (val s id #"Fail Text")) #");\n"
      #"    } finally {\n      submitting = false;\n    }\n  }\n"
      #"</script>\n")))

(defun field-state (s f)
  (let ((n (val s f #"Name")))
    (case (val s f #"Control")
      (#"date" (list #"  let " n #" = $state(new Date().toISOString().slice(0, 10));\n"))
      (#"choose" (list #"  let " n #" = $state('');\n  let " n #"Choices: { name: string }[] = $state([]);\n"))
      (#"one-of" (list #"  let " n #" = $state(" (js (val s f #"Default" #"")) #");\n"))
      (_ (list #"  let " n #" = $state('');\n")))))

(defun line-type (s c)
  (case (val s c #"Control") (#"text" #"string") (_ #"number")))

(defun line-default (s c)
  (case (val s c #"Control")
    (#"text" #"''")
    (_ (val s c #"Default" #"0"))))

;; --- fields and columns ---------------------------------------------------------

(defun field (s f)
  (let ((n (val s f #"Name"))
        (label (t (val s f #"Label" (val s f #"Name")))))
    (case (val s f #"Control")
      (#"date"
       (list #"    <div class='row-3'><fieldset><legend>" label #"</legend><input type='date' bind:value={" n #"} /></fieldset></div>\n"))
      (#"choose"
       (list #"    <div class='row-2'><fieldset><legend>" label #"</legend>\n"
             #"      <select bind:value={" n #"}>{#each " n #"Choices as choice}<option value={t(choice.name)}>{t(choice.name)}</option>{/each}</select>\n"
             #"    </fieldset></div>\n"))
      (#"one-of"
       (list #"    <fieldset class='one-of'><legend>" label #"</legend>\n"
             ;; Options are "value=Label value=Label".
             (lists:map (lambda (o)
                          (let (((list v l) (binary:split o #"=")))
                            (list #"      <label><input type='radio' bind:group={" n #"} value=" (js v) #" /> " (t l) #"</label>\n")))
                        (binary:split (val s f #"Options" #"") #" " '(global trim_all)))
             #"    </fieldset>\n"))
      (_ (list #"    <fieldset><legend>" label #"</legend><input bind:value={" n #"} /></fieldset>\n")))))

(defun grid (s inputs badge?)
  (list
    #"    <table class='lines-table'>\n      <thead><tr>"
    (lists:map (lambda (c) (list #"<th" (align s c) #">" (t (val s c #"Label")) #"</th>")) inputs)
    (if badge? (list #"<th>" (t #"Storage") #"</th>") #"")
    #"<th></th></tr></thead>\n"
    #"      <tbody>\n        {#each lines as line (line.key)}\n          <tr>\n"
    (lists:map (lambda (c) (list #"            <td" (align s c) #">" (cell s c) #"</td>\n")) inputs)
    (if badge?
      (list #"            <td class='storage-cell'>{#if storageOf(line.itemName) === 'Cold'}<span class='storage-tag cold'>" (t #"Cold")
            #"</span>{:else if storageOf(line.itemName) === 'Hot'}<span class='storage-tag shelf'>" (t #"Hot") #"</span>{/if}</td>\n")
      #"")
    #"            <td>{#if lines.length > 1}<button type='button' class='btn secondary small' onclick={() => removeLine(line.key)}>&#x2715;</button>{/if}</td>\n"
    #"          </tr>\n        {/each}\n      </tbody>\n    </table>\n"))

(defun align (s c)
  (case (val s c #"Control") (#"text" #"") (_ #" class='num'")))

(defun cell (s c)
  (let ((n (val s c #"Name")))
    (case (val s c #"Control")
      (#"text" (list #"<input bind:value={line." n #"} placeholder=" (js (val s c #"Placeholder" #"")) #" />"))
      (#"number" (list #"<input type='number' min=" (js (val s c #"Min" #"0")) #" bind:value={line." n #"} class='num-input' />"))
      (#"money" (money-input (list #"line." n))))))

;; An amount typed as currency, held in minor units.
(defun money-input (place)
  (list #"<input type='number' min='0' step='0.01' class='num-input' value={(" place #" / 100).toFixed(2)} "
        #"oninput={(e) => (" place #" = Math.round(Number(e.currentTarget.value) * 100))} />"))

(defun style ()
  #"<style>
  .intro { max-width: 70ch; }
  .center-text { text-align: center; }
  .context-line {
    font-size: var(--font-size-base);
    color: var(--ink-soft);
    margin: 0 0 0.8rem;
    padding-bottom: 0.6rem;
    border-bottom: 1px solid var(--rule);
  }
  .row-3, .row-2 { display: flex; gap: 1rem; margin-top: 0.6rem; }
  .row-3 fieldset, .row-2 fieldset { flex: 1; }
  .lines-table th, .lines-table td { padding: 0.35rem 0.5rem; border-bottom: 1px solid var(--rule); text-align: start; }
  .num { text-align: end; }
  .num-input { width: 6rem; text-align: end; }
  .storage-cell { white-space: nowrap; }
  .storage-tag { display: inline-block; padding: 0.1rem 0.5rem; border-radius: 4px; font-size: var(--font-size-small); font-weight: 600; }
  .storage-tag.cold { background: #e3f0fb; color: #1e5f8f; }
  .storage-tag.shelf { background: #f5efe3; color: #8a6a2a; }
  .btn.small { padding: 0.2rem 0.5rem; font-size: var(--font-size-small); }
  .total-line { font-size: var(--font-size-medium); color: var(--ink-soft); margin: 0.8rem 0; }
  .one-of { margin: 0.8rem 0; display: flex; align-items: center; gap: 1.2rem; }
  .one-of label { display: flex; align-items: center; gap: 0.3rem; font-weight: normal; }
  .error { color: var(--debit, #a33a2e); }
  .success { padding: 0.5rem 0.7rem; border-radius: 5px; background: #eaf5ea; color: #2a5c2a; }
</style>
")
