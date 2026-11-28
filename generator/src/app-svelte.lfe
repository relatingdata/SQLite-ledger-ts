;;; Svelte (web) screens from the configuration entities.
;;;
;;; Each template is an ordinary function, run while the application is
;;; generated: it takes a screen's configuration and returns the page's
;;; text. Smaller functions (a field, a column's header and cell, a money
;;; input) are shared between templates. Behaviour a screen names (its
;;; choice sources, totals rule and action) lives in $lib/screen-runtime;
;;; styling lives in the Rule entities (see app-css). The templates are
;;; ASCII only: HTML entities and \u escapes stand for anything else.

(defmodule app-svelte
  (export (screen 2)))

(defun val (s id rel) (app-view:val s id rel))
(defun val (s id rel default) (app-view:val s id rel default))
(defun kind (s id) (app-view:kind s id))

;; The page for a screen, by its Template.
(defun screen (s id)
  (case (val s id #"Template")
    (#"transaction" (transaction s id))
    (#"not-implemented" (not-implemented s id))
    (#"tiles" (tiles s id))
    (#"compose" (compose s id))
    (#"report" (report s id))
    (#"drill" (drill s id))
    (#"pivot" (pivot s id))
    (other (error (tuple 'no-template other (app-entities:name s id))))))

;; --- text helpers ------------------------------------------------------------

(defun js (bin)
  (let* ((a (binary:replace bin #"\\" #"\\\\" '(global)))
         (b (binary:replace a #"'" #"\\'" '(global)))
         (c (binary:replace b #"\n" #"\\n" '(global))))
    (list #"'" c #"'")))

;; A word on screen: its translation, by vocabulary key.
(defun t (word) (list #"{t(" (js word) #")}"))

(defun header (s id)
  (list #"  // Generated from application/application.entities (screen " (app-entities:name s id) #",\n"
        #"  // template " (val s id #"Template") #"). Not source: change the entities.\n"))

;; --- small templates -------------------------------------------------------

;; A screen that is not built yet: its title and what it will do.
(defun not-implemented (s id)
  (list #"<script lang='ts'>\n" (header s id)
        #"  import NotImplemented from '$lib/NotImplemented.svelte';\n</script>\n\n"
        #"<NotImplemented title={" (js (val s id #"Title")) #"} description={" (js (val s id #"Description" #"")) #"} />\n"))

;; A section's index: one tile per screen in it, each a link with what the
;; screen does.
(defun tiles (s id)
  (list #"<script lang='ts'>\n" (header s id)
        #"  import '$lib/generated.css';\n"
        #"  import { translations } from '$lib/state.svelte';\n"
        #"  const t = (word: string) => translations.current[word] ?? word;\n</script>\n\n"
        #"<svelte:head><title>" (t (val s id #"Title")) #"</title></svelte:head>\n\n"
        #"<fieldset class='page-title generated'>\n"
        #"  <legend>" (t (val s id #"Title")) #"</legend>\n"
        (case (val s id #"Intro") ('undefined #"") (i (list #"  <p class='intro'>" (t i) #"</p>\n")))
        #"  <div class='tiles'>\n"
        (lists:map (lambda (tile)
                     (list #"    <a class='card tile' href=" (js (val s tile #"Href")) #">"
                           #"<h3>" (t (val s tile #"Title")) #"</h3><p>" (t (val s tile #"Description" #"")) #"</p></a>\n"))
                   (lists:filter (lambda (p) (== (kind s p) #"Tile")) (app-view:things s id)))
        #"  </div>\n</fieldset>\n"))

;; A screen that is one or more existing components, each with fixed props.
(defun compose (s id)
  (let ((uses (lists:filter (lambda (p) (== (kind s p) #"Use")) (app-view:things s id))))
    (list #"<script lang='ts'>\n" (header s id)
          (lists:map (lambda (c) (list #"  import " c #" from '$lib/components/" c #".svelte';\n"))
                     (lists:usort (lists:map (lambda (u) (app-entities:name s (app-view:target s u #"Component"))) uses)))
          #"</script>\n\n"
          (lists:map (lambda (u)
                       (list #"<" (app-entities:name s (app-view:target s u #"Component"))
                             (lists:filtermap (lambda (r)
                                                (case r
                                                  ((tuple (binary "Prop " (prop binary)) v) (tuple 'true (list #" " prop #"={" (js v) #"}")))
                                                  (_ 'false)))
                                              (app-view:relations s u))
                             #" />\n"))
                     uses))))

;; --- the transaction template ------------------------------------------------
;;
;; Fields, then optionally a grid of line items (one row per item, a blank
;; row added whenever every row has an item) with its totals, then the
;; fields after the grid, and one button that runs the screen's Action.

(defun transaction (s id)
  (let* ((parts (app-view:things s id))
         (fields (lists:filter (lambda (p) (== (kind s p) #"Field")) parts))
         (columns (lists:filter (lambda (p) (== (kind s p) #"Column")) parts))
         (inputs (lists:filter (lambda (c) (=/= (val s c #"Control") #"storage-badge")) columns))
         (badge? (lists:any (lambda (c) (== (val s c #"Control") #"storage-badge")) columns))
         (before (lists:filter (lambda (p) (== (kind s p) #"Field")) (lists:takewhile (lambda (p) (=/= (kind s p) #"Column")) parts)))
         (after (lists:filter (lambda (p) (andalso (== (kind s p) #"Field") (not (lists:member p before)))) parts)))
    (list
      (transaction-script s id fields inputs badge?)
      #"\n<svelte:head><title>" (t (val s id #"Title")) #"</title></svelte:head>\n\n"
      #"<fieldset class='page-title generated'>\n"
      #"  <legend>" (t (val s id #"Title")) #"</legend>\n"
      #"  <p class='intro'>" (t (val s id #"Intro")) #"</p>\n\n"
      #"  {#if loading}\n    <p class='center-text'>Loading&hellip;</p>\n  {:else}\n"
      #"    <p class='context-line'><strong>{business}</strong> &mdash; {ledger}"
      (case (val s id #"Party Label")
        ('undefined #"")
        (label (list #" &mdash; " (t label) #": <strong>" (t (val s id #"Party")) #"</strong>")))
      #"</p>\n"
      #"    <div class='row'>\n" (lists:map (lambda (f) (field s f)) before) #"    </div>\n"
      #"    {#if info}<p class='dim'>{info}</p>{/if}\n"
      (if (== columns '()) #"" (grid s id inputs badge?))
      (if (== after '()) #"" (list #"    <div class='row'>\n" (lists:map (lambda (f) (field s f)) after) #"    </div>\n"))
      (if (andalso (== columns '()) (=/= (val s id #"Totals") 'undefined))
        (list #"    {#if sums.totalMinor > 0}<p class='total-line'>" (t (val s id #"Total Label" #"Total")) #": <strong>{fmt(sums.totalMinor)}</strong>"
              #"{#if sums.taxMinor > 0} (" (t #"Tax") #": {fmt(sums.taxMinor)}){/if}</p>{/if}\n")
        #"")
      #"    {#if error}<p class='error'>{error}</p>{/if}\n"
      #"    {#if message}<p class='success'>{message}</p>{/if}\n"
      #"    <button class='btn' onclick={submit} disabled={submitting" (if (== columns '()) #"" #" || filled.length === 0") #"}>\n"
      #"      {submitting ? t('Saving') + '\\u2026' : t(" (js (val s id #"Submit Label" #"Save")) #")}\n"
      #"    </button>\n"
      (if (records? s id) (record-list s id) #"")
      #"  {/if}\n"
      #"</fieldset>\n")))

(defun transaction-script (s id fields inputs badge?)
  (let ((choices (lists:filter (lambda (f) (== (val s f #"Control") #"choose")) fields))
        (lines? (=/= inputs '())))
    (list
      #"<script lang='ts'>\n" (header s id)
      #"  import { onMount } from 'svelte';\n"
      #"  import '$lib/generated.css';\n"
      #"  import { auth, session, translations } from '$lib/state.svelte';\n"
      #"  import { formatAmount } from '$lib/format';\n"
      #"  import { getLedgers, asBusinessName, ApiError" (if badge? #", listItems, type ItemSummary" #"") #" } from '$lib/api';\n"
      #"  import { sources, totals, actions, filters, reactions, "
      (if (records? s id) #"records, commands, type Row, " #"")
      #"Invalid, type Choice, type Patch } from '$lib/screen-runtime';\n"
      (if (andalso (records? s id) (paged? s id)) #"  import PageButtons from '$lib/PageButtons.svelte';\n  import { pageRows, pageCount, movePage, pageSize } from '$lib/pagination';\n" #"")
      #"\n"
      #"  const t = (word: string) => translations.current[word] ?? word;\n"
      #"  const fmt = (minor: number) => formatAmount(minor, auth.current?.user.number_format ?? '1 000.00');\n\n"
      #"  let business = $state('');\n  let ledger = $state('');\n"
      #"  let loading = $state(true);\n  let submitting = $state(false);\n"
      #"  let error = $state('');\n  let message = $state('');\n\n"
      #"  const initial = (): Record<string, string> => ({ "
      (lists:join #", " (lists:map (lambda (f) (list (val s f #"Name") #": " (initial s f))) fields))
      #" });\n"
      #"  let values = $state(initial());\n"
      #"  let choices: Record<string, Choice[]> = $state({});\n"
      #"  // Choices a reaction has narrowed, unless the user asked to see all.\n"
      #"  let narrowed: Record<string, Choice[] | undefined> = $state({});\n"
      #"  let showAll: Record<string, boolean> = $state({});\n"
      #"  let info = $state('');\n"
      #"  const context = () => ({ business, ledger, party: " (js (val s id #"Party" #""))
      (case (val s id #"Side") ('undefined #"") (side (list #", side: " (js side)))) #" });\n"
      #"  const apply = (patch: Patch) => {\n"
      #"    if (patch.values) Object.assign(values, patch.values);\n"
      #"    if (patch.choices) for (const [k, v] of Object.entries(patch.choices)) narrowed[k] = v;\n"
      #"    if (patch.info !== undefined) info = patch.info;\n"
      #"  };\n"
      (lists:map (lambda (f) (reaction s f)) (lists:filter (lambda (f) (=/= (val s f #"Reacts") 'undefined)) fields))
      (if lines?
        (lines-state s id inputs badge?)
        (case (val s id #"Totals")
          ('undefined #"")
          (tot (list #"  let sums = $derived(totals." tot #"([], values));\n"))))
      #"\n  onMount(async () => {\n"
      #"    try {\n"
      #"      if (!session.current) return;\n"
      #"      business = session.current.businessName;\n"
      #"      const ledgers = await getLedgers(asBusinessName(business));\n"
      #"      const current = session.current.ledgerName;\n"
      #"      ledger = ledgers.some((l) => l.name === current) ? current : (ledgers[0]?.name ?? '');\n"
      (if badge? #"      items = (await listItems(business)).rows;\n" #"")
      (lists:map (lambda (f) (load-choices s f)) choices)
      (if (records? s id) #"      await refresh();\n" #"")
      #"    } catch (e) {\n      error = e instanceof ApiError ? e.message : 'Failed to load.';\n"
      #"    } finally {\n      loading = false;\n    }\n  });\n\n"
      #"  async function submit() {\n"
      #"    error = '';\n    message = '';\n    submitting = true;\n"
      #"    try {\n"
      #"      message = await actions." (val s id #"Action") #"(context(), values, "
      (if lines? #"filled.map(({ key, ...l }) => l)" #"[]") #");\n"
      (lists:filtermap (lambda (f) (case (val s f #"Reset")
                                     ('undefined 'false)
                                     (_ (tuple 'true (list #"      values." (val s f #"Name") #" = initial()." (val s f #"Name") #";\n")))))
                       fields)
      (if lines? #"      lines = [newLine(nextKey++)];\n" #"")
      (if (records? s id) #"      await refresh();\n" #"")
      #"    } catch (e) {\n"
      #"      error = e instanceof ApiError || e instanceof Invalid ? e.message : t(" (js (val s id #"Fail Text" #"Could not save.")) #");\n"
      #"    } finally {\n      submitting = false;\n    }\n  }\n"
      (if (records? s id) (records-script s id) #"")
      #"</script>\n")))

;; --- listed records ------------------------------------------------------------
;;
;; A screen with Records lists them below its form: one Entry per column,
;; and per record a button for each Command whose When names its status.

(defun records? (s id) (=/= (val s id #"Records") 'undefined))

;; The Paged trait: a list longer than the user's page size shows a page at
;; a time, with the shared page buttons. On unless the screen says Paged=no;
;; Paged=server asks the report for one page at a time (limit and offset)
;; and pages by the total it returns.
(defun paged? (s id) (not (lists:member (val s id #"Paged" #"yes") (list #"no" #"server"))))
(defun server-paged? (s id) (== (val s id #"Paged" #"yes") #"server"))

(defun records-script (s id)
  (list
    #"\n  let rows: Row[] = $state([]);\n"
    (if (paged? s id) #"  let page = $state(0);\n" #"")
    #"  const refresh = async () => {\n    rows = await records." (val s id #"Records") #"(context());\n  };\n"
    #"  async function run(command: string, row: Row) {\n"
    #"    error = '';\n    message = '';\n"
    #"    try {\n      message = await commands[command](context(), row);\n      await refresh();\n"
    #"    } catch (e) {\n      error = e instanceof ApiError ? e.message : t(" (js (val s id #"Command Fail Text" #"Could not update this record.")) #");\n    }\n  }\n"))

(defun record-list (s id)
  (let* ((parts (app-view:things s id))
         (entries (lists:filter (lambda (p) (== (kind s p) #"Entry")) parts))
         (commands (lists:filter (lambda (p) (== (kind s p) #"Command")) parts)))
    (list
      #"    <table class='record-list'>\n      <thead><tr>"
      (lists:map (lambda (e) (list #"<th>" (t (val s e #"Label")) #"</th>")) entries)
      (if (== commands '()) #"" #"<th></th>")
      #"</tr></thead>\n      <tbody>\n        {#each " (if (paged? s id) #"pageRows(rows, page)" #"rows") #" as row}\n          <tr>\n"
      (lists:map (lambda (e) (list #"            <td>" (entry s e) #"</td>\n")) entries)
      (if (== commands '()) #""
        (list #"            <td class='record-actions'>\n"
              (lists:map (lambda (c) (command s c)) commands)
              #"            </td>\n"))
      #"          </tr>\n        {:else}\n          <tr><td colspan='"
      (integer_to_binary (+ (length entries) (if (== commands '()) 0 1)))
      #"'>" (t (val s id #"Empty Text" #"Nothing yet.")) #"</td></tr>\n        {/each}\n      </tbody>\n    </table>\n"
      (if (paged? s id)
        #"    {#if rows.length > pageSize()}<PageButtons page={Math.min(page, pageCount(rows.length) - 1)} totalPages={pageCount(rows.length)} go={(to) => (page = movePage(page, rows.length, to))} />{/if}\n"
        #""))))

(defun entry (s e)
  (let ((n (val s e #"Name")))
    (case (val s e #"Control")
      (#"status" (list #"<span class='chip chip-{row." n #"}'>{t(row." n #")}</span>"))
      (_ (list #"{row." n #"}")))))

(defun command (s c)
  (let ((statuses (binary:split (val s c #"When" #"") #" " '(global trim_all))))
    (list #"              {#if " (if (== statuses '()) #"true"
                                   (lists:join #" || " (lists:map (lambda (w) (list #"row.status === " (js w))) statuses)))
          #"}<button class='btn secondary small" (case (val s c #"Style") ('undefined #"") (st (list #" " st)))
          #"' onclick={() => run(" (js (val s c #"Command")) #", row)}>" (t (val s c #"Label")) #"</button>{/if}\n")))

;; A field that Reacts: when its value changes, run the named reaction and
;; apply what it returns.
(defun reaction (s f)
  (let ((n (val s f #"Name")))
    (list #"  let last_" n #" = '';\n"
          #"  $effect(() => {\n"
          #"    const now = values." n #" ?? '';\n"
          #"    if (now === last_" n #") return;\n"
          #"    last_" n #" = now;\n"
          #"    reactions." (val s f #"Reacts") #"(context(), $state.snapshot(values)).then(apply).catch(() => {});\n"
          #"  });\n")))

;; The choices a select shows: narrowed by a reaction, or filtered.
(defun shown (s f)
  (let* ((n (val s f #"Name"))
         (all (list #"(choices." n #" ?? [])"))
         (filtered (case (val s f #"Filter") ('undefined all) (fl (list #"filters." fl #"(" all #", values)")))))
    (list #"(narrowed." n #" && !showAll." n #" ? narrowed." n #" : " filtered #")")))

(defun initial (s f)
  (case (tuple (val s f #"Control") (val s f #"Default"))
    ((tuple #"date" #"") #"''")
    ((tuple #"date" _) #"new Date().toISOString().slice(0, 10)")
    ((tuple _ 'undefined) #"''")
    ((tuple #"choose" #"first") #"''")
    ((tuple _ d) (js d))))

(defun load-choices (s f)
  (let ((n (val s f #"Name")))
    (list #"      choices." n #" = await sources." (val s f #"Choices") #"(business, ledger);\n"
          (if (== (val s f #"Default") #"first")
            (list #"      if (!values." n #" && choices." n #".length > 0) values." n #" = choices." n #"[0].value;\n")
            #""))))

(defun lines-state (s id inputs badge?)
  (list
    #"  type Line = { key: number; " (lists:map (lambda (c) (list (val s c #"Name") #": " (line-type s c) #"; ")) inputs) #"};\n"
    #"  const newLine = (key: number): Line => ({ key, "
    (lists:join #", " (lists:map (lambda (c) (list (val s c #"Name") #": " (line-default s c))) inputs)) #" });\n"
    #"  let lines: Line[] = $state([newLine(0)]);\n"
    #"  let nextKey = 1;\n"
    #"  $effect(() => {\n    if (lines.length > 0 && lines.every((l) => l.itemName.trim())) lines = [...lines, newLine(nextKey++)];\n  });\n"
    #"  const removeLine = (key: number) => (lines = lines.filter((l) => l.key !== key));\n"
    #"  let filled = $derived(lines.filter((l) => l.itemName.trim()));\n"
    #"  let sums = $derived(totals." (val s id #"Totals" #"lineTax") #"(lines, values));\n"
    (if badge?
      (list #"  let items: ItemSummary[] = $state([]);\n"
            #"  let itemsByName = $derived(new Map(items.map((i) => [i.name, i])));\n"
            #"  const storageOf = (name: string) => (name.trim() ? (itemsByName.get(name)?.storage_origin ?? null) : null);\n")
      #"")))

(defun line-type (s c)
  (case (val s c #"Control") (#"text" #"string") (_ #"number")))

(defun line-default (s c)
  (case (val s c #"Control")
    (#"text" #"''")
    (_ (val s c #"Default" #"0"))))

;; --- fields and columns ------------------------------------------------------

(defun field (s f)
  (case (val s f #"Unless")
    ('undefined (control s f))
    (other (list #"      {#if !values." other #"}\n" (control s f) #"      {/if}\n"))))

(defun control (s f)
  (let* ((n (list #"values." (val s f #"Name")))
         (label (t (val s f #"Label" (val s f #"Name"))))
         (open (list #"      <fieldset" (if (== (val s f #"Grow") 'undefined) #"" #" class='grow'") #"><legend>" label #"</legend>")))
    (case (val s f #"Control")
      (#"date" (list open #"<input type='date' bind:value={" n #"} /></fieldset>\n"))
      (#"percent" (list open #"<input bind:value={" n #"} placeholder='0' inputmode='decimal' /></fieldset>\n"))
      (#"number" (list open #"<input type='number' value={" n #"} oninput={(e) => (" n #" = e.currentTarget.value)} /></fieldset>\n"))
      (#"quantity" (list open #"<input bind:value={" n #"} placeholder='0' inputmode='numeric' /></fieldset>\n"))
      (#"amount" (list open #"<input bind:value={" n #"} placeholder='0.00' inputmode='decimal' /></fieldset>\n"))
      (#"checkbox" (list #"      <label class='checkbox-label'><input type='checkbox' checked={" n #" === 'yes'} onchange={(e) => (" n
                         #" = e.currentTarget.checked ? 'yes' : '')} /> " label #"</label>\n"))
      (#"textarea" (list open #"<textarea bind:value={" n #"}></textarea></fieldset>\n"))
      (#"choose"
       (list open #"\n        <select bind:value={" n #"}>"
             (case (val s f #"Empty") ('undefined #"") (e (list #"<option value=''>" (t e) #"</option>")))
             (if (== (val s f #"Grouped") #"yes")
               ;; Grouped=yes: each choice under its group, as an optgroup.
               (list #"{#each groupsOf(" (shown s f) #") as g}{#if g.label}<optgroup label={t(g.label)}>{#each g.choices as choice}<option value={choice.value}>{t(choice.label)}</option>{/each}</optgroup>"
                     #"{:else}{#each g.choices as choice}<option value={choice.value}>{t(choice.label)}</option>{/each}{/if}{/each}</select>\n")
               (list #"{#each " (shown s f) #" as choice}<option value={t(choice.value)}>{t(choice.label)}</option>{/each}</select>\n"))
             (case (val s f #"Show All Label")
               ('undefined #"")
               (label (let ((n (val s f #"Name")))
                        (list #"        {#if narrowed." n #"}<button type='button' class='link-button' onclick={() => (showAll." n #" = !showAll." n #")}>"
                              #"{showAll." n #" ? t('Known only') : t(" (js label) #")}</button>{/if}\n"))))
             #"      </fieldset>\n"))
      (#"pick"
       (list open #"<select bind:value={" n #"}>"
             (lists:map (lambda (o)
                          (let (((list v l) (binary:split o #"=")))
                            (list #"<option value=" (js v) #">" (t (spaced l)) #"</option>")))
                        (binary:split (val s f #"Options" #"") #" " '(global trim_all)))
             #"</select></fieldset>\n"))
      (#"toggle"
       (list #"      <div class='toggle-group'>"
             (lists:map (lambda (o)
                          (let (((list v l) (binary:split o #"=")))
                            (list #"<button type='button' class='btn secondary' class:active={" n #" === " (js v) #"} onclick={() => (" n #" = " (js v) #")}>" (t (spaced l)) #"</button>")))
                        (binary:split (val s f #"Options" #"") #" " '(global trim_all)))
             #"</div>\n"))
      (#"one-of"
       (list #"      <fieldset class='one-of'><legend>" label #"</legend>\n"
             ;; Options are "value=Label value=Label".
             (lists:map (lambda (o)
                          (let (((list v l) (binary:split o #"=")))
                            (list #"        <label><input type='radio' bind:group={" n #"} value=" (js v) #" /> " (t (spaced l)) #"</label>\n")))
                        (binary:split (val s f #"Options" #"") #" " '(global trim_all)))
             #"      </fieldset>\n"))
      (_ (list open #"<input type='text' bind:value={" n #"}"
               (case (val s f #"Placeholder") ('undefined #"") (p (list #" placeholder=" (js p))))
               #" /></fieldset>\n")))))

(defun grid (s id inputs badge?)
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
    #"          </tr>\n        {/each}\n      </tbody>\n    </table>\n"
    #"    {#if sums.subtotalMinor > 0}\n"
    #"      <p class='total-line'>" (t (val s id #"Total Label" #"Total")) #": <strong>{fmt(sums.totalMinor)}</strong> (" (t #"Tax") #": {fmt(sums.taxMinor)})</p>\n"
    #"    {/if}\n"))

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
;; --- the report template -----------------------------------------------------
;;
;; Parameter fields (a Control=ledger field chooses the ledger), then the
;; report the screen names, reloaded whenever a parameter changes: columns
;; of groups, each a table with one Entry per column (Control tree, text,
;; mono or amount), a footer, and the report's status line and note.

(defun report (s id)
  (let* ((parts (app-view:things s id))
         (fields (lists:filter (lambda (p) (== (kind s p) #"Field")) parts))
         (params (lists:filter (lambda (f) (=/= (val s f #"Control") #"ledger")) fields))
         (ledger? (lists:any (lambda (f) (== (val s f #"Control") #"ledger")) fields))
         (dates (lists:filter (lambda (f) (== (val s f #"Control") #"date")) params))
         (entries (lists:filter (lambda (p) (== (kind s p) #"Entry")) parts))
         (commands (lists:filter (lambda (p) (== (kind s p) #"Command")) parts))
         (queries (lists:filter (lambda (f) (=/= (val s f #"Query") 'undefined)) params))
         (chooses (lists:filter (lambda (f) (== (val s f #"Control") #"choose")) params)))
    (list
      #"<script lang='ts'>\n" (header s id)
      #"  import { onMount } from 'svelte';\n"
      #"  import '$lib/generated.css';\n"
      #"  import { session, translations } from '$lib/state.svelte';\n"
      #"  import { getLedgers, asBusinessName, ApiError } from '$lib/api';\n"
      #"  import { todayIsoDate } from '$lib/format';\n"
      (if (orelse (paged? s id) (server-paged? s id)) #"  import PageButtons from '$lib/PageButtons.svelte';\n  import { pageRows, pageCount, movePage, pageSize } from '$lib/pagination';\n" #"")
      #"  import { reports, " (if (== commands '()) #"" #"commands, ") (if (== chooses '()) #"" #"sources, filters, type Choice, ")
      #"type Report } from '$lib/screen-runtime';\n\n"
      (if (== chooses '()) #""
        #"  let choices: Record<string, Choice[]> = $state({});\n  let narrowed: Record<string, Choice[] | undefined> = $state({});\n  let showAll: Record<string, boolean> = $state({});\n")
      #"  const t = (word: string) => translations.current[word] ?? word;\n"
      #"  let business = $state('');\n  let ledger = $state('');\n  let ledgers: { name: string }[] = $state([]);\n"
      #"  let ready = $state(false);\n  let loading = $state(true);\n  let error = $state('');\n  let message = $state('');\n"
      #"  let report: Report | null = $state(null);\n"
      #"  let values: Record<string, string> = $state({ "
      (lists:join #", " (lists:map (lambda (f) (list (val s f #"Name") #": "
                                                     (case (tuple (val s f #"Control") (val s f #"Default"))
                                                       ((tuple #"date" #"today") #"todayIsoDate()")
                                                       ((tuple #"choose" #"first") #"''")
                                                       ((tuple _ 'undefined) #"''")
                                                       ((tuple _ d) (js d)))))
                                   params))
      #" });\n"
      #"  let open = $state(new Set<string>());\n"
      #"  const shown = (group: Report['columns'][number]['groups'][number]) => group.rows.filter((r) => r.ancestors.every((a) => open.has(a)));\n"
      (if (paged? s id) #"  let pages: Record<string, number> = $state({});\n" #"")
      (if (server-paged? s id) #"  let serverPage = $state(0);\n" #"")
      #"  const toggle = (key: string) => {\n    const next = new Set(open);\n    if (next.has(key)) next.delete(key);\n    else next.add(key);\n    open = next;\n  };\n"
      #"  let latest = 0;\n"
      #"  async function load() {\n"
      #"    const request = ++latest;\n    loading = true;\n    error = '';\n"
      #"    try {\n      const result = await reports." (val s id #"Report") #"({ business, ledger, party: '' }, "
      (if (server-paged? s id)
        #"{ ...$state.snapshot(values), limit: String(pageSize()), offset: String(serverPage * pageSize()) }"
        #"$state.snapshot(values)")
      #");\n"
      #"      if (request === latest) {\n        report = result;\n" (if (paged? s id) #"        pages = {};\n" #"") #"      }\n"
      #"    } catch (e) {\n      if (request === latest) error = e instanceof ApiError ? e.message : 'Failed to load.';\n"
      #"    } finally {\n      if (request === latest) loading = false;\n    }\n  }\n"
      #"  $effect(() => {\n    JSON.stringify(values);\n    void ledger;\n    if (ready) load();\n  });\n"
      (if (== commands '()) #""
        (list #"  async function run(command: string, row: Record<string, string>) {\n    error = '';\n    message = '';\n"
              #"    try {\n      message = await commands[command]({ business, ledger, party: '' }, row);\n      await load();\n"
              #"    } catch (e) {\n      error = e instanceof ApiError ? e.message : t(" (js (val s id #"Command Fail Text" #"Could not update this record.")) #");\n    }\n  }\n"))
      #"  onMount(async () => {\n    if (!session.current) return;\n"
      #"    business = session.current.businessName;\n    ledger = session.current.ledgerName;\n"
      (if ledger? #"    try {\n      ledgers = await getLedgers(asBusinessName(business));\n    } catch {\n      /* the session's ledger still works */\n    }\n" #"")
      (if (== chooses '()) #""
        (list #"    try {\n" (lists:map (lambda (f) (list #"  " (load-choices s f))) chooses)
              #"    } catch (e) {\n      error = e instanceof ApiError ? e.message : 'Failed to load.';\n    }\n"))
      (lists:map (lambda (f) (list #"    const " (val s f #"Name") #"Query = new URL(window.location.href).searchParams.get(" (js (val s f #"Query")) #");\n"
                                   #"    if (" (val s f #"Name") #"Query) values." (val s f #"Name") #" = " (val s f #"Name") #"Query;\n"))
                 queries)
      #"    ready = true;\n  });\n"
      #"</script>\n\n"
      #"<svelte:head><title>{report?.title ?? " (js-t (val s id #"Title")) #"}</title></svelte:head>\n\n"
      #"<fieldset class='page-title generated'>\n"
      #"  <legend>{report?.title ?? " (js-t (val s id #"Title")) #"}</legend>\n"
      #"  {#if report?.intro}<p class='intro'>{report.intro}</p>{:else}\n" (intro-line s id) #"  {/if}\n"
      #"  <div class='row report-controls'>\n"
      (lists:map (lambda (f)
                   (if (== (val s f #"Control") #"ledger")
                     (list #"    <fieldset><legend>" (t (val s f #"Label" #"Ledger")) #"</legend>\n"
                           #"      <select bind:value={ledger}>{#each ledgers as l}<option value={l.name}>{t(l.name)}</option>{/each}</select>\n    </fieldset>\n")
                     (field s f)))
                 fields)
      (case (val s id #"Print Label")
        ('undefined #"")
        (label (list #"    <button type='button' class='btn' onclick={() => window.print()} disabled={!report}>" (t label) #"</button>\n")))
      (case (val s id #"Clear Label")
        ('undefined #"")
        (label (list #"    {#if " (lists:join #" || " (lists:map (lambda (d) (list #"values." (val s d #"Name"))) dates)) #"}"
                     #"<button type='button' class='link-button' onclick={() => { "
                     (lists:map (lambda (d) (list #"values." (val s d #"Name") #" = ''; ")) dates)
                     #"}}>" (t label) #"</button>{/if}\n")))
      #"  </div>\n\n"
      #"  {#if message}<p class='success'>{message}</p>{/if}\n"
      #"  {#if loading && !report}\n    <p class='center-text'>Loading&hellip;</p>\n"
      #"  {:else if error}\n    <p class='error'>{error}</p>\n"
      #"  {:else if report && report.columns.every((c) => c.groups.length === 0)}\n    <p class='dim'>" (t (val s id #"Empty Text" #"None"))
      (case (val s id #"Empty Link")
        ('undefined #"")
        (link (list #" <a href=" (js (val s id #"Empty Href" #"/")) #">" (t link) #"</a>")))
      #"</p>\n"
      #"  {:else if report}\n"
      #"    <div class='report-columns' style='--columns: {report.columns.length}'>\n"
      #"      {#each report.columns as column, ci}\n        <div class='report-column'>\n"
      #"          {#each column.groups as group, gi}\n"
      #"            <fieldset class='report-group'>\n"
      #"              {#if group.title}<legend>{group.title}{#if group.warn} <span class='warn'>&#x26A0; {group.warn}</span>{/if}</legend>{/if}\n"
      #"              {#if group.meta}<div class='report-meta'>{#each group.meta as m}<p><strong>{m.label}:</strong> {m.value}</p>{/each}</div>{/if}\n"
      (report-tables s id entries commands)
      #"            </fieldset>\n          {/each}\n"
      #"          {#if column.summary}<p class='report-summary'><strong>{column.summary.label}</strong> <span class='num mono'>{column.summary.value}</span></p>{/if}\n"
      #"        </div>\n      {/each}\n    </div>\n"
      (if (server-paged? s id)
        #"    {#if (report.total ?? 0) > pageSize()}<PageButtons page={serverPage} totalPages={pageCount(report.total ?? 0)} go={(to) => { serverPage = movePage(serverPage, report?.total ?? 0, to); load(); }} />{/if}\n"
        #"")
      #"    {#if report.status}<p class='status report-status' class:balanced={report.status.ok}>{report.status.text}</p>{/if}\n"
      #"    {#if report.note}<p class='dim'>{report.note}</p>{/if}\n"
      #"  {/if}\n"
      #"</fieldset>\n")))

;; An option's label: in Options, an underscore stands for a space.
(defun spaced (l) (binary:replace l #"_" #" " '(global)))

;; A word as a JS expression: its translation.
(defun js-t (word) (list #"t(" (js word) #")"))

;; Each group shows the table its `table` names: the entries whose Table is
;; that name (no Table: the default table).
(defun report-tables (s id entries commands)
  (let ((tables (lists:usort (lists:map (lambda (e) (val s e #"Table" #"")) entries))))
    (case tables
      ((list only) (report-table s id entries commands))
      (_ (lists:map (lambda (tb)
                      (list #"              {#if (group.table ?? '') === " (js tb) #"}\n"
                            (report-table s id (lists:filter (lambda (e) (== (val s e #"Table" #"") tb)) entries) commands)
                            #"              {/if}\n"))
                    tables)))))

(defun report-table (s id entries commands)
  (let ((width (+ (length entries) (if (== commands '()) 0 1))))
    (list
      #"              <table class='report-table'>\n"
      (if (andalso (== commands '()) (lists:all (lambda (e) (== (val s e #"Label" #"") #"")) entries)) #""
        (list
      #"                <thead><tr>"
      (lists:map (lambda (e) (list #"<th" (report-align s e) #">{group.labels?.['" (val s e #"Name") #"'] ?? " (js-t (val s e #"Label" #"")) #"}</th>")) entries)
      (if (== commands '()) #"" #"<th></th>")
      #"</tr></thead>\n"))
      #"                <tbody>\n"
      #"                  {#each " (if (paged? s id) #"pageRows(shown(group), pages[`${ci}/${gi}`] ?? 0)" #"shown(group)") #" as row (row.key)}\n"
      #"                    <tr class={row.mark ?? ''} class:clickable={row.parent} onclick={() => row.parent && toggle(row.key)}>\n"
      (lists:map (lambda (e) (list #"                      " (report-cell s e) #"\n")) entries)
      (if (== commands '()) #""
        (list #"                      <td class='record-actions'>\n"
              (lists:map (lambda (c) (report-command s c)) commands)
              #"                      </td>\n"))
      #"                    </tr>\n"
      #"                  {:else}\n                    <tr><td colspan='" (integer_to_binary width) #"' class='dim'>" (t (val s id #"Empty Text" #"None")) #"</td></tr>\n"
      #"                  {/each}\n                </tbody>\n"
      #"                {#if group.footer}<tfoot><tr class='totals-row'>"
      (lists:map (lambda (e) (let ((n (val s e #"Name")))
                               (list #"<td" (report-class s e n #"group.footerContra") #"><strong>{group.footer['" n #"'] ?? ''}</strong></td>")))
                 entries)
      (if (== commands '()) #"" #"<td></td>")
      #"</tr></tfoot>{/if}\n"
      #"              </table>\n"
      (if (paged? s id)
        (list #"              {#if shown(group).length > pageSize()}{@const at = `${ci}/${gi}`}{@const count = shown(group).length}"
              #"<PageButtons page={Math.min(pages[at] ?? 0, pageCount(count) - 1)} totalPages={pageCount(count)} go={(to) => (pages[at] = movePage(pages[at] ?? 0, count, to))} />{/if}\n")
        #""))))

(defun report-command (s c)
  (let ((statuses (binary:split (val s c #"When" #"") #" " '(global trim_all))))
    (list #"                        {#if " (if (== statuses '()) #"true"
                                             (lists:join #" || " (lists:map (lambda (w) (list #"row.cells.status === " (js w))) statuses)))
          #"}<button class='btn secondary small" (case (val s c #"Style") ('undefined #"") (st (list #" " st)))
          #"' onclick={(e) => { e.stopPropagation(); run(" (js (val s c #"Command")) #", row.cells); }}>" (t (val s c #"Label")) #"</button>{/if}\n")))

;; The intro, if any; {NAME} in it stands for the business or ledger (Intro Name).
(defun intro-line (s id)
  (case (val s id #"Intro Name")
    ('undefined (case (val s id #"Intro")
                  ('undefined #"")
                  (intro (list #"  <p class='intro'>" (t intro) #"</p>\n"))))
    (who (list #"  {#each [t(" (js (val s id #"Intro")) #").split('{NAME}')] as parts}"
               #"<p class='intro'>{parts[0]}<strong>{" who #"}</strong>{parts[1] ?? ''}</p>{/each}\n"))))

(defun report-align (s e)
  (case (val s e #"Control") ((binary "amount") #" class='num'") (_ #"")))

(defun report-class (s e n contra)
  (let* ((mark (if (== contra #"row.contra") (list #"{row.marks?.['" n #"'] ?? ''}") (list #"amount-" n)))
         (marks (list #" " mark)))
    (case (val s e #"Control")
      (#"amount" (list #" class='num mono" marks #"' class:contra={" contra #"?.includes('" n #"')}"))
      (#"mono" (list #" class='mono" marks #"'"))
      (_ (list #" class='" mark #"'")))))

(defun report-cell (s e)
  (let ((n (val s e #"Name")))
    (case (val s e #"Control")
      ;; Control=link: the cell links to its Href, where {name} stands for
      ;; the row's cell of that name.
      (#"link" (list #"<td><a href={`" (re:replace (val s e #"Href") #"{([A-Za-z]+)}" #"${row.cells['\\1']}" (list 'global (tuple 'return 'binary)))
                     #"`}>{row.cells['" n #"'] ?? ''}</a>{#if row.badge} <span class='badge' title={row.badgeTitle}>{row.badge}</span>{/if}</td>"))
      (#"tree" (list #"<td style='padding-inline-start: {row.depth * 1.2}rem'>{#if row.parent}<span class='disclosure'>{open.has(row.key) ? '\\u25BE' : '\\u25B8'}</span>{/if}{row.cells['" n #"'] ?? ''}"
                     #"{#if row.badge} <span class='badge' title={row.badgeTitle}>{row.badge}</span>{/if}</td>"))
      (_ (list #"<td" (report-class s e n #"row.contra") #">{row.cells['" n #"'] ?? ''}</td>")))))
;; --- the pivot template ------------------------------------------------------
;;
;; A two-axis report on the general cube. Each Entry is a measure: a Source
;; the cube totals (postings:-Sales Revenue, onHand, onHandAt:cost ...) or a
;; Formula over the other measures (sales - cogs); Control amount, quantity
;; or percent; Summary=yes puts its grand total above the grid. The Axes
;; trait chooses the rows and columns (Axis Chooser drag or select, from
;; Row Axis and Column Axis); the Pivot trait draws the grid, shaded by the
;; Highlight measure across each row (Highlight Across=column for columns).
;; Date fields fromDate and toDate set the period of postings.

(defun pivot (s id)
  (let* ((parts (app-view:things s id))
         (fields (lists:filter (lambda (p) (== (kind s p) #"Field")) parts))
         (dates (lists:filter (lambda (f) (== (val s f #"Control") #"date")) fields))
         (entries (lists:filter (lambda (p) (== (kind s p) #"Entry")) parts)))
    (list
      #"<script lang='ts'>\n" (header s id)
      #"  import { onMount } from 'svelte';\n"
      #"  import '$lib/generated.css';\n"
      #"  import { session, translations } from '$lib/state.svelte';\n"
      #"  import { ApiError } from '$lib/api';\n"
      #"  import { MatrixApiError } from '$lib/matrix-api';\n"
      #"  import { todayIsoDate } from '$lib/format';\n"
      #"  import AxisChooser from '$lib/components/AxisChooser.svelte';\n"
      #"  import PivotGrid from '$lib/components/PivotGrid.svelte';\n"
      #"  import { cube, loadAxes, measureValues, type Axes, type MeasureDef, type Measure, type PivotCell } from '$lib/screen-runtime';\n\n"
      #"  const t = (word: string) => translations.current[word] ?? word;\n"
      #"  const defs: MeasureDef[] = [\n"
      (lists:map (lambda (e)
                   (list #"    { name: " (js (val s e #"Name"))
                         (case (val s e #"Source") ('undefined #"") (src (list #", source: " (js src))))
                         (case (val s e #"Formula") ('undefined #"") (f (list #", formula: " (js f))))
                         #" },\n"))
                 entries)
      #"  ];\n"
      #"  const measures: Measure[] = [\n"
      (lists:map (lambda (e)
                   (list #"    { name: " (js (val s e #"Name")) #", label: " (js (val s e #"Label" #""))
                         #", format: " (js (val s e #"Control" #"amount"))
                         (if (== (val s e #"Summary") #"yes") #", summary: true" #"") #" },\n"))
                 entries)
      #"  ];\n"
      #"  let business = '';\n  let ledger = '';\n"
      #"  let axes: Axes | null = $state(null);\n"
      #"  let rowAxis = $state(" (js (val s id #"Row Axis" #"Item")) #");\n"
      #"  let colAxis = $state(" (js (val s id #"Column Axis" #"Consolidated")) #");\n"
      #"  let rowFilter = $state('');\n  let colFilter = $state('');\n"
      #"  let values: Record<string, string> = $state({ "
      (lists:join #", " (lists:map (lambda (f) (list (val s f #"Name") #": "
                                                     (case (val s f #"Default")
                                                       (#"today" #"todayIsoDate()")
                                                       ('undefined #"''")
                                                       (d (js d)))))
                                   fields))
      #" });\n"
      #"  let cells: PivotCell[] = $state([]);\n"
      #"  let ready = $state(false);\n  let loading = $state(true);\n  let error = $state('');\n"
      #"  let latest = 0;\n"
      #"  async function load() {\n"
      #"    const request = ++latest;\n    loading = true;\n    error = '';\n"
      #"    try {\n"
      #"      const result = await cube({ business, ledger, party: '' }, $state.snapshot(values), rowAxis, colAxis, defs);\n"
      #"      if (request === latest) cells = result;\n"
      #"    } catch (e) {\n      if (request === latest) error = e instanceof ApiError || e instanceof MatrixApiError ? e.message : 'Failed to load.';\n"
      #"    } finally {\n      if (request === latest) loading = false;\n    }\n  }\n"
      #"  $effect(() => {\n    JSON.stringify(values);\n    void rowAxis;\n    void colAxis;\n    if (ready) load();\n  });\n"
      #"  onMount(async () => {\n    if (!session.current) return;\n"
      #"    business = session.current.businessName;\n    ledger = session.current.ledgerName;\n"
      #"    axes = await loadAxes({ business, ledger, party: '' });\n"
      #"    ready = true;\n  });\n"
      #"</script>\n\n"
      #"<svelte:head><title>" (t (val s id #"Title")) #"</title></svelte:head>\n\n"
      #"<fieldset class='page-title generated'>\n"
      #"  <legend>" (t (val s id #"Title")) #"</legend>\n"
      (intro-line s id)
      (if (== fields '()) #""
        (list #"  <div class='row report-controls'>\n"
              (lists:map (lambda (f) (field s f)) fields)
              (case (val s id #"Clear Label")
                ('undefined #"")
                (label (list #"    {#if " (lists:join #" || " (lists:map (lambda (d) (list #"values." (val s d #"Name"))) dates)) #"}"
                             #"<button type='button' class='link-button' onclick={() => { "
                             (lists:map (lambda (d) (list #"values." (val s d #"Name") #" = ''; ")) dates)
                             #"}}>" (t label) #"</button>{/if}\n")))
              #"  </div>\n"))
      #"  {#if axes}<AxisChooser {axes} mode={" (js (val s id #"Axis Chooser" #"drag")) #"}"
      #" bind:rowAxis bind:colAxis bind:rowFilter bind:colFilter />{/if}\n"
      #"  {#if error}\n    <p class='error'>{error}</p>\n"
      #"  {:else if loading && cells.length === 0}\n    <p class='center-text'>Loading&hellip;</p>\n"
      #"  {:else}\n"
      #"    <PivotGrid {cells} {measures} derive={(b) => measureValues(defs, b)} {rowAxis} {colAxis} {rowFilter} {colFilter}"
      (case (val s id #"Highlight") ('undefined #"") (h (list #" highlight={" (js h) #"}")))
      (case (val s id #"Highlight Across") ('undefined #"") (a (list #" across={" (js a) #"}")))
      #" emptyText={" (js (val s id #"Empty Text" #"No activity for this combination.")) #"} />\n"
      #"  {/if}\n"
      #"</fieldset>\n")))

;; --- the drill template ------------------------------------------------------
;;
;; A drillable report: its parameter fields in a row of controls (a choice
;; Reacts and is Filtered as on a transaction, Grouped=yes shows its
;; choices under headings), a title block naming the business, then the
;; sections the screen's Report returns, each opening to its table and the
;; sections under it ($lib/DrillSection), and the report's total line.

(defun drill (s id)
  (let* ((parts (app-view:things s id))
         (fields (lists:filter (lambda (p) (== (kind s p) #"Field")) parts))
         (dates (lists:filter (lambda (f) (== (val s f #"Control") #"date")) fields))
         (chooses (lists:filter (lambda (f) (== (val s f #"Control") #"choose")) fields)))
    (list
      #"<script lang='ts'>\n" (header s id)
      #"  import { onMount } from 'svelte';\n"
      #"  import '$lib/generated.css';\n"
      #"  import { session, translations } from '$lib/state.svelte';\n"
      #"  import { ApiError } from '$lib/api';\n"
      #"  import DrillSection from '$lib/DrillSection.svelte';\n"
      #"  import { reports, sources, filters, reactions, groupsOf, type Choice, type Patch, type Report } from '$lib/screen-runtime';\n\n"
      #"  const t = (word: string) => translations.current[word] ?? word;\n"
      #"  let business = $state('');\n  let ledger = $state('');\n"
      #"  let ready = $state(false);\n  let loading = $state(true);\n  let error = $state('');\n"
      #"  let report: Report | null = $state(null);\n"
      #"  let values: Record<string, string> = $state({ "
      (lists:join #", " (lists:map (lambda (f) (list (val s f #"Name") #": " (js (val s f #"Default" #"")))) fields))
      #" });\n"
      #"  let choices: Record<string, Choice[]> = $state({});\n"
      #"  let narrowed: Record<string, Choice[] | undefined> = $state({});\n"
      #"  let showAll: Record<string, boolean> = $state({});\n"
      #"  const context = () => ({ business, ledger, party: '' });\n"
      #"  const apply = (patch: Patch) => {\n    if (patch.values) Object.assign(values, patch.values);\n  };\n"
      (lists:map (lambda (f) (reaction s f)) (lists:filter (lambda (f) (=/= (val s f #"Reacts") 'undefined)) fields))
      #"  let latest = 0;\n"
      #"  async function load() {\n"
      #"    const request = ++latest;\n    loading = true;\n    error = '';\n"
      #"    try {\n      const result = await reports." (val s id #"Report") #"(context(), $state.snapshot(values));\n"
      #"      if (request === latest) report = result;\n"
      #"    } catch (e) {\n      if (request === latest) error = e instanceof ApiError ? e.message : 'Failed to load.';\n"
      #"    } finally {\n      if (request === latest) loading = false;\n    }\n  }\n"
      #"  $effect(() => {\n    JSON.stringify(values);\n    if (ready) load();\n  });\n"
      #"  onMount(async () => {\n    if (!session.current) return;\n"
      #"    business = session.current.businessName;\n    ledger = session.current.ledgerName;\n"
      #"    try {\n" (lists:map (lambda (f) (list #"  " (load-choices s f))) chooses)
      #"    } catch {\n      /* each choice still shows its current value */\n    }\n"
      #"    ready = true;\n  });\n"
      #"</script>\n\n"
      #"<svelte:head><title>" (t (val s id #"Title")) #"</title></svelte:head>\n\n"
      #"<fieldset class='page-title generated'>\n"
      #"  <legend>" (t (val s id #"Title")) #"</legend>\n"
      (intro-line s id)
      #"  <div class='controls'>\n"
      (lists:map (lambda (f) (field s f)) fields)
      (case (val s id #"Clear Label")
        ('undefined #"")
        (label (list #"    {#if " (lists:join #" || " (lists:map (lambda (d) (list #"values." (val s d #"Name"))) dates)) #"}"
                     #"<button type='button' class='link' onclick={() => { "
                     (lists:map (lambda (d) (list #"values." (val s d #"Name") #" = ''; ")) dates)
                     #"}}>" (t label) #"</button>{/if}\n")))
      #"  </div>\n\n"
      #"  {#if loading && !report}\n    <p class='center-text'>Loading&hellip;</p>\n"
      #"  {:else if error}\n    <p class='error center-text'>{error}</p>\n"
      #"  {:else if report}\n"
      #"    <div class='report-wrap'>\n      <div class='report card'>\n"
      #"        <div class='title-block'>\n          <p class='title-line'>" (t (val s id #"Title Line" (val s id #"Title"))) #"</p>\n"
      #"          <p class='title-line company'>{business}</p>\n        </div>\n"
      #"        {#if (report.sections ?? []).length === 0}\n          <p class='empty'>" (t (val s id #"Empty Text" #"None")) #"</p>\n"
      #"        {:else}\n          {#each report.sections ?? [] as section (section.key)}<DrillSection {section} />{/each}\n"
      #"          {#if report.grandTotal}<div class='grand-total' class:negative={report.grandTotal.negative}><span>{report.grandTotal.label}</span><span>{report.grandTotal.value}</span></div>{/if}\n"
      #"        {/if}\n      </div>\n    </div>\n"
      #"  {/if}\n"
      #"</fieldset>\n")))
