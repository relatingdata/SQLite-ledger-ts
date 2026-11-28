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
    (#"forms" (forms s id))
    (#"review" (review s id))
    (#"list" (list-screen s id))
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
         (chooses (lists:filter (lambda (f) (== (val s f #"Control") #"choose")) params))
         (reacting (lists:filter (lambda (f) (=/= (val s f #"Reacts") 'undefined)) params)))
    (list
      #"<script lang='ts'>\n" (header s id)
      #"  import { onMount } from 'svelte';\n"
      #"  import '$lib/generated.css';\n"
      #"  import { session, translations } from '$lib/state.svelte';\n"
      #"  import { getLedgers, asBusinessName, ApiError } from '$lib/api';\n"
      #"  import { todayIsoDate } from '$lib/format';\n"
      (if (orelse (paged? s id) (server-paged? s id)) #"  import PageButtons from '$lib/PageButtons.svelte';\n  import { pageRows, pageCount, movePage, pageSize } from '$lib/pagination';\n" #"")
      #"  import { reports, " (if (== commands '()) #"" #"commands, ") (if (== chooses '()) #"" #"sources, filters, type Choice, ")
      (if (== reacting '()) #"" #"reactions, type Patch, ")
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
      ;; A parameter that Reacts runs its reaction when its value changes.
      (if (== reacting '()) #""
        (list #"  const context = () => ({ business, ledger, party: '' });\n"
              #"  const apply = (patch: Patch) => {\n    if (patch.values) Object.assign(values, patch.values);\n  };\n"
              (lists:map (lambda (f) (reaction s f)) reacting)))
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
      #"  import { todayIsoDate } from '$lib/format';\n"
      #"  import { reports, sources, filters, reactions, groupsOf, type Choice, type Patch, type Report } from '$lib/screen-runtime';\n\n"
      #"  const t = (word: string) => translations.current[word] ?? word;\n"
      #"  let business = $state('');\n  let ledger = $state('');\n"
      #"  let ready = $state(false);\n  let loading = $state(true);\n  let error = $state('');\n"
      #"  let report: Report | null = $state(null);\n"
      #"  let values: Record<string, string> = $state({ "
      (lists:join #", " (lists:map (lambda (f) (list (val s f #"Name") #": " (report-default s f))) fields))
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
      ;; The parameters, if any, in a row of controls.
      (if (== fields '()) #""
        (list
      #"  <div class='controls'>\n"
      (lists:map (lambda (f) (field s f)) fields)
      (case (val s id #"Clear Label")
        ('undefined #"")
        (label (list #"    {#if " (lists:join #" || " (lists:map (lambda (d) (list #"values." (val s d #"Name"))) dates)) #"}"
                     #"<button type='button' class='link' onclick={() => { "
                     (lists:map (lambda (d) (list #"values." (val s d #"Name") #" = ''; ")) dates)
                     #"}}>" (t label) #"</button>{/if}\n")))
      #"  </div>\n\n"))
      #"  {#if loading && !report}\n    <p class='center-text'>Loading&hellip;</p>\n"
      #"  {:else if error}\n    <p class='error center-text'>{error}</p>\n"
      #"  {:else if report}\n"
      #"    <div class='report-wrap'>\n      <div class='report card'>\n"
      ;; A Title Line puts a title block naming the business above the sections.
      (case (val s id #"Title Line")
        ('undefined #"")
        (title-line (list #"        <div class='title-block'>\n          <p class='title-line'>" (t title-line) #"</p>\n"
                    #"          <p class='title-line company'>{business}</p>\n        </div>\n")))
      #"        {#if report.message}\n          <p class='center-text empty'>{report.message}</p>\n"
      #"        {:else if (report.sections ?? []).length === 0}\n          <p class='empty'>" (t (val s id #"Empty Text" #"None")) #"</p>\n"
      #"        {:else}\n          {#each report.sections ?? [] as section (section.key)}<DrillSection {section} />{/each}\n"
      #"          {#if report.grandTotal}<div class='grand-total' class:negative={report.grandTotal.negative}><span>{report.grandTotal.label}</span><span>{report.grandTotal.value}</span></div>{/if}\n"
      #"        {/if}\n      </div>\n    </div>\n"
      #"  {/if}\n"
      #"</fieldset>\n")))

;; A parameter's first value: today for Default=today on a date, nothing
;; for Default=first (the first choice, once loaded) or no Default.
(defun report-default (s f)
  (case (tuple (val s f #"Control") (val s f #"Default"))
    ((tuple #"date" #"today") #"todayIsoDate()")
    ((tuple #"choose" #"first") #"''")
    ((tuple _ 'undefined) #"''")
    ((tuple _ d) (js d))))

;; --- the forms template ------------------------------------------------------
;;
;; A column of forms ($lib/components/Form), one per Section of the screen:
;; its Title as a heading, its Fields (Control text, number, select,
;; password or date; a select's options from its Choices source), its
;; Submit Label, and its Action, Initial values and Preview line from the
;; runtime's formActions, formInitials and previews. A screen's Status
;; names a line from the runtime's statuses, shown above the forms and
;; reloaded after each is saved. A Section with no fields is its button.

(defun forms (s id)
  (let ((sections (lists:filter (lambda (p) (== (kind s p) #"Section")) (app-view:things s id))))
    (list
      #"<script lang='ts'>\n" (header s id)
      #"  import { onMount } from 'svelte';\n"
      #"  import '$lib/generated.css';\n"
      #"  import { session, translations } from '$lib/state.svelte';\n"
      #"  import Form from '$lib/components/Form.svelte';\n"
      #"  import { formActions, formInitials, formRecords, previews, sources, statuses, type FormRecord, type Values } from '$lib/screen-runtime';\n\n"
      #"  const t = (word: string) => translations.current[word] ?? word;\n"
      #"  const context = () => ({ business: session.current?.businessName ?? '', ledger: session.current?.ledgerName ?? '', party: '' });\n"
      #"  let options: Record<string, string[]> = $state({});\n"
      #"  let status = $state('');\n"
      #"  async function refresh() {\n"
      (case (val s id #"Status")
        ('undefined #"")
        (name (list #"    try {\n      status = await statuses." name #"(context());\n    } catch {\n      status = '';\n    }\n")))
      (lists:map (lambda (sec)
                   (case (val s sec #"Each")
                     ('undefined #"")
                     (each (list #"    try {\n      " (form-records s sec) #" = await formRecords." each #"(context());\n    } catch {\n      " (form-records s sec) #" = [];\n    }\n"))))
                 sections)
      #"  }\n"
      (lists:map (lambda (sec) (form-state s sec)) sections)
      #"  onMount(async () => {\n    await refresh();\n"
      (lists:map (lambda (f) (list #"    try {\n      options." (val s f #"Name") #" = (await sources." (val s f #"Choices")
                                   #"(context().business, context().ledger)).map((c) => c.value);\n    } catch {\n      /* the field offers nothing to choose */\n    }\n"))
                 (lists:filter (lambda (f) (=/= (val s f #"Choices") 'undefined)) (lists:append (lists:map (lambda (sec) (app-view:things s sec)) sections))))
      #"  });\n"
      #"</script>\n\n"
      #"<svelte:head><title>{t(" (js (val s id #"Title")) #")}</title></svelte:head>\n\n"
      #"<fieldset class='page-title generated'>\n"
      #"  <legend>{t(" (js (val s id #"Title")) #")}</legend>\n"
      (intro-line s id)
      (if (== (val s id #"Status") 'undefined) #"" #"  {#if status}<p class='status form-status'>{status}</p>{/if}\n")
      (lists:map (lambda (sec) (form-section s sec)) sections)
      #"</fieldset>\n")))

(defun form-values (s sec) (list #"values_" (val s sec #"Name")))
(defun form-records (s sec) (list #"records_" (val s sec #"Name")))

(defun form-state (s sec)
  (if (=/= (val s sec #"Each") 'undefined)
    (list #"  let " (form-records s sec) #": FormRecord[] = $state([]);\n")
    (form-state-one s sec)))

(defun form-state-one (s sec)
  (let ((fields (app-view:things s sec)))
    (list #"  let " (form-values s sec) #": Record<string, string | number | string[]> = $state("
          (case (val s sec #"Initial")
            ('undefined #"")
            (initial (list #"formInitials." initial #"() ?? ")))
          #"{ " (lists:join #", " (lists:map (lambda (f) (list (val s f #"Name") #": ''")) fields)) #" });\n")))

(defun form-section (s sec)
  (case (val s sec #"Each")
    ('undefined (form-section-one s sec))
    (_ (form-section-each s sec))))

;; A Section with Each: a card per record (formRecords) with its title,
;; its note and its form, its select options the record's own; saving
;; passes the record's key with the values.
(defun form-section-each (s sec)
  (let ((records (form-records s sec)))
    (list
      #"  {#if " records #".length === 0}<p class='empty'>" (t (val s sec #"Empty Text" #"None")) #"</p>{/if}\n"
      #"  <div class='cards'>\n"
      #"    {#each " records #" as record (record.key)}\n"
      #"      <div class='card record-card'>\n"
      #"        <h3>{record.title}</h3>\n"
      #"        {#if record.note}<p class='hint'>{record.note}</p>{/if}\n"
      #"        <Form\n          fields={[\n"
      (lists:map (lambda (f) (list #"            " (form-field s f #"record.options") #",\n")) (app-view:things s sec))
      #"          ]}\n"
      #"          bind:values={record.values}\n"
      #"          onSubmit={async (v) => {\n"
      #"            await formActions." (val s sec #"Action") #"(context(), { ...(Object.fromEntries(Object.entries(v).map(([k, x]) => [k, String(x)])) as Values), key: record.key });\n"
      #"            await refresh();\n"
      #"          }}\n"
      #"          submitLabel=" (js (val s sec #"Submit Label" #"Save")) #"\n"
      #"        />\n"
      #"      </div>\n"
      #"    {/each}\n"
      #"  </div>\n")))

;; One field of a Form; a select's options from `from` (options, or a
;; record's own).
(defun form-field (s f from)
  (list #"{ name: " (js (val s f #"Name")) #", label: " (js (val s f #"Label" (val s f #"Name")))
        #", type: " (js (val s f #"Control" #"text"))
        (if (orelse (=/= (val s f #"Choices") 'undefined) (== from #"record.options"))
          (list #", options: " from #"." (val s f #"Name") #" ?? []") #"")
        (case (val s f #"Min") ('undefined #"") (n (list #", min: " n)))
        (case (val s f #"Max") ('undefined #"") (n (list #", max: " n)))
        (case (val s f #"Step") ('undefined #"") (n (list #", step: " n)))
        (case (val s f #"Autocomplete") ('undefined #"") (a (list #", autocomplete: " (js a))))
        (case (val s f #"Hint") ('undefined #"") (h (list #", hint: " (js h))))
        #" }"))

(defun form-section-one (s sec)
  (let ((fields (app-view:things s sec)))
    (list
      #"  <h3>{t(" (js (val s sec #"Title")) #")}</h3>\n"
      #"  <Form\n    fields={[\n"
      (lists:map (lambda (f)
                   (list #"      { name: " (js (val s f #"Name")) #", label: " (js (val s f #"Label" (val s f #"Name")))
                         #", type: " (js (val s f #"Control" #"text"))
                         (if (=/= (val s f #"Choices") 'undefined) (list #", options: options." (val s f #"Name") #" ?? []") #"")
                         (case (val s f #"Min") ('undefined #"") (n (list #", min: " n)))
                         (case (val s f #"Max") ('undefined #"") (n (list #", max: " n)))
                         (case (val s f #"Autocomplete") ('undefined #"") (a (list #", autocomplete: " (js a))))
                         (case (val s f #"Hint") ('undefined #"") (h (list #", hint: " (js h))))
                         #" },\n"))
                 fields)
      #"    ]}\n"
      #"    bind:values={" (form-values s sec) #"}\n"
      #"    onSubmit={async (v) => {\n"
      #"      const next = await formActions." (val s sec #"Action") #"(context(), Object.fromEntries(Object.entries(v).map(([k, x]) => [k, String(x)])) as Values);\n"
      #"      if (next) " (form-values s sec) #" = next;\n"
      #"      await refresh();\n"
      #"    }}\n"
      #"    submitLabel=" (js (val s sec #"Submit Label" #"Save")) #"\n"
      #"  />\n"
      (case (val s sec #"Preview")
        ('undefined #"")
        (preview (list #"  <p class='preview'>{previews." preview #"(Object.fromEntries(Object.entries(" (form-values s sec) #").map(([k, x]) => [k, String(x)])))}</p>\n"))))))
;; --- the review template -----------------------------------------------------
;;
;; The screen's Fields, its parameters, in a card; then a card per Section:
;; its Title, Intro and own Fields, and its Propose Label button, which
;; asks the runtime's proposals for an entry (Propose) and shows it under
;; its Proposal Title, account by account, with its figures and listings,
;; to Reject or accept (Accept Label: the runtime's accepts posts it and
;; says what was done). Changing any value drops what was proposed or done.
;;
;; A select's choices come from its Choices source, after its Empty
;; choice if it has one; one without an Empty always holds one of its
;; choices. A Field with Reacts runs that reaction when changed; a Field
;; with When Empty names a field it is shown only while that one is empty.

(defun review (s id)
  (let* ((sections (lists:filter (lambda (p) (== (kind s p) #"Section")) (app-view:things s id)))
         (shared (lists:filter (lambda (p) (== (kind s p) #"Field")) (app-view:things s id)))
         (fields (lists:append (list shared (lists:append (lists:map (lambda (sec) (app-view:things s sec)) sections)))))
         (chosen (lists:filter (lambda (f) (=/= (val s f #"Choices") 'undefined)) fields)))
    (list
      #"<script lang='ts'>\n" (header s id)
      #"  import { onMount } from 'svelte';\n"
      #"  import '$lib/generated.css';\n"
      #"  import { session, translations } from '$lib/state.svelte';\n"
      #"  import { todayIsoDate } from '$lib/format';\n"
      #"  import { accepts, proposals, reactions, sources, type Choice, type Outcome, type Proposal, type Values } from '$lib/screen-runtime';\n\n"
      #"  const t = (word: string) => translations.current[word] ?? word;\n"
      #"  const context = () => ({ business: session.current?.businessName ?? '', ledger: session.current?.ledgerName ?? '', party: '' });\n"
      #"  let values: Values = $state({ "
      (lists:join #", " (lists:map (lambda (f) (list (val s f #"Name") #": " (report-default s f))) fields))
      #" });\n"
      #"  let choices: Record<string, Choice[]> = $state({});\n"
      #"  let proposed: Record<string, Proposal | null> = $state({});\n"
      #"  let outcome: Record<string, Outcome | null> = $state({});\n"
      #"  let failed: Record<string, string> = $state({});\n"
      #"  let busy: Record<string, boolean> = $state({});\n"
      #"  const message = (e: unknown) => (e instanceof Error ? e.message : t('Could not complete.'));\n\n"
      #"  // The choices, again after anything is posted; a select with no empty\n"
      #"  // choice always holds one of its choices.\n"
      #"  const optional = new Set([" (lists:join #", " (lists:map (lambda (f) (js (val s f #"Name"))) (lists:filter (lambda (f) (=/= (val s f #"Empty") 'undefined)) chosen))) #"]);\n"
      #"  async function load() {\n"
      #"    const { business, ledger } = context();\n"
      #"    const named: [string, (b: string, l: string) => Promise<Choice[]>][] = ["
      (lists:join #", " (lists:map (lambda (f) (list #"[" (js (val s f #"Name")) #", sources." (val s f #"Choices") #"]")) chosen))
      #"];\n"
      #"    for (const [name, source] of named) {\n"
      #"      try {\n        choices[name] = await source(business, ledger);\n      } catch {\n        choices[name] = [];\n      }\n"
      #"      const all = choices[name];\n"
      #"      if (!optional.has(name) && all.length > 0 && !all.some((c) => c.value === values[name])) values[name] = all[0].value;\n"
      #"    }\n  }\n"
      #"  onMount(load);\n\n"
      #"  function changed() {\n    proposed = {};\n    outcome = {};\n    failed = {};\n  }\n"
      #"  async function react(name: string) {\n"
      #"    try {\n      const patch = await reactions[name](context(), { ...values });\n"
      #"      for (const [field, value] of Object.entries(patch.values ?? {})) values[field] = value;\n"
      #"    } catch {\n      /* nothing changes */\n    }\n  }\n"
      #"  async function propose(section: string, by: string) {\n"
      #"    changed();\n    busy[section] = true;\n"
      #"    try {\n      proposed[section] = await proposals[by](context(), { ...values });\n"
      #"    } catch (e) {\n      failed[section] = message(e);\n    } finally {\n      busy[section] = false;\n    }\n"
      #"    await load();\n  }\n"
      #"  async function accept(section: string, by: string) {\n"
      #"    const proposal = proposed[section];\n    if (!proposal) return;\n"
      #"    busy[section] = true;\n    failed[section] = '';\n"
      #"    try {\n      outcome[section] = await accepts[by](context(), { ...values }, proposal);\n      proposed[section] = null;\n"
      #"    } catch (e) {\n      failed[section] = message(e);\n    } finally {\n      busy[section] = false;\n    }\n"
      #"    await load();\n  }\n"
      #"  function reject(section: string) {\n    proposed[section] = null;\n    failed[section] = '';\n  }\n"
      #"</script>\n\n"
      #"<svelte:head><title>{t(" (js (val s id #"Title")) #")}</title></svelte:head>\n\n"
      #"<fieldset class='page-title generated'>\n"
      #"  <legend>{t(" (js (val s id #"Title")) #")}</legend>\n"
      (intro-line s id)
      (case (val s id #"Intro Note") ('undefined #"") (n (list #"  <p class='intro'>" (t n) #"</p>\n")))
      (if (== shared '()) #""
        (list #"  <div class='card review-card'>\n"
              #"    <p class='context-line'><strong>{session.current?.businessName ?? ''}</strong> {'\\u2014'} {session.current?.ledgerName ?? ''}</p>\n"
              #"    <div class='fields-row'>\n"
              (lists:map (lambda (f) (review-field s f #"      ")) shared)
              #"    </div>\n  </div>\n"))
      (lists:map (lambda (sec) (review-section s sec)) sections)
      #"</fieldset>\n")))

(defun review-field (s f pad)
  (let* ((name (val s f #"Name"))
         (bound (list #"values." name))
         (on (case (val s f #"Reacts")
               ('undefined #"changed")
               (r (list #"() => { changed(); react(" (js r) #"); }"))))
         (control
           (case (val s f #"Control" #"text")
             (#"select"
              (list pad #"  <select bind:value={" bound #"} onchange={" on #"}>"
                    (case (val s f #"Empty") ('undefined #"") (e (list #"<option value=''>" (t e) #"</option>")))
                    #"{#each choices." name #" ?? [] as c}<option value={c.value}>{t(c.label)}</option>{/each}</select>\n"))
             (control
              (list pad #"  <input type=" (js control) #" bind:value={" bound #"} oninput={" on #"}"
                    (case (val s f #"Placeholder") ('undefined #"") (ph (list #" placeholder={t(" (js ph) #")}")))
                    #" />\n"))))
         (inner (case (val s f #"Label")
                  ('undefined control)
                  (label (list pad #"<fieldset>\n" pad #"  <legend>" (t label) #"</legend>\n" control
                               (case (val s f #"Hint") ('undefined #"") (h (list pad #"  <p class='field-note'>" (t h) #"</p>\n")))
                               pad #"</fieldset>\n")))))
    (case (val s f #"When Empty")
      ('undefined inner)
      (other (list pad #"{#if !values." other #"}\n" inner pad #"{/if}\n")))))

(defun review-section (s sec)
  (let* ((name (js (val s sec #"Name")))
         (at (list #"[" name #"]"))
         (by (js (val s sec #"Propose")))
         (accept (js (val s sec #"Accept"))))
    (list
      #"  <div class='card review-card'>\n"
      #"    <h3>" (t (val s sec #"Title")) #"</h3>\n"
      (case (val s sec #"Intro") ('undefined #"") (i (list #"    <p class='intro'>" (t i) #"</p>\n")))
      (lists:map (lambda (f) (review-field s f #"    ")) (app-view:things s sec))
      #"    {#if !proposed" at #" && !outcome" at #"}\n"
      (case (val s sec #"Hint") ('undefined #"") (h (list #"      <p class='hint'>" (t h) #"</p>\n")))
      #"      {#if failed" at #"}<p class='error'>{failed" at #"}</p>{/if}\n"
      #"      <button class='btn' onclick={() => propose(" name #", " by #")} disabled={busy" at #"}>{busy" at #" ? t('Loading') + '\\u2026' : t(" (js (val s sec #"Propose Label")) #")}</button>\n"
      #"    {/if}\n"
      #"    {#if proposed" at #"}\n"
      #"      {@const p = proposed" at #"}\n"
      #"      <div class='proposal'>\n"
      #"        <p class='proposal-heading'>" (t (val s sec #"Proposal Title")) #"</p>\n"
      #"        <table class='proposal-table'>\n"
      #"          <thead><tr><th>{t('Account')}</th><th class='num'>{t('Debit')}</th><th class='num'>{t('Credit')}</th></tr></thead>\n"
      #"          <tbody>{#each p.rows as r}<tr><td>{r.account}</td><td class='num'>{r.debit}</td><td class='num'>{r.credit}</td></tr>{/each}</tbody>\n"
      #"        </table>\n"
      #"        {#each p.summary ?? [] as line}<p class='proposal-net'>{line.label}: <strong>{line.value}</strong></p>{/each}\n"
      #"        {#each p.lists ?? [] as list}<p class='group-heading'>{list.heading}</p><ul class='group-list'>{#each list.items as item}<li>{item}</li>{/each}</ul>{/each}\n"
      #"        {#if failed" at #"}<p class='error'>{failed" at #"}</p>{/if}\n"
      #"        <div class='decision-row'>\n"
      #"          <button class='btn secondary' onclick={() => reject(" name #")} disabled={busy" at #"}>{t('Reject')}</button>\n"
      #"          <button class='btn' onclick={() => accept(" name #", " accept #")} disabled={busy" at #"}>{busy" at #" ? t('Loading') + '\\u2026' : t(" (js (val s sec #"Accept Label")) #")}</button>\n"
      #"        </div>\n"
      #"      </div>\n"
      #"    {/if}\n"
      #"    {#if outcome" at #"}\n"
      #"      {@const o = outcome" at #"}\n"
      #"      <div class='outcome'>\n"
      #"        <p><strong>{o.title}</strong></p>\n"
      #"        {#each o.lines as line}<p>{line.label}: {line.value}</p>{/each}\n"
      #"        {#each o.lists ?? [] as list}<p class='group-heading'>{list.heading}</p><ul class='group-list'>{#each list.items as item}<li>{item}</li>{/each}</ul>{/each}\n"
      #"        {#if o.note}<p class='outcome-note'>{o.note}</p>{/if}\n"
      #"      </div>\n"
      #"    {/if}\n"
      #"  </div>\n")))
;; --- the list template -------------------------------------------------------
;;
;; Lists of records ($lib/components/SelectableListEditor), each a line per
;; record with its Entry columns (Control=amount: a figure; Control=hint:
;; a note), selected by its Key. The screen's own Records is a list on its
;; own; a Section with Records is one of the lists drawn side by side
;; (the screen's Lists Title above them, Lists Class on them); one with Of
;; lists the records of the row selected in that list, titled with its
;; Show. Insert opens a form of the list's Fields, saved by its Insert
;; (formActions; a detail list's parent key as `parent`): a Form, or with
;; Inline plain controls that save on Enter and close on Escape. Delete
;; runs its Delete (commands), after asking when it has Confirm.
;;
;; A Section with Table is a table of figures (tables) shown when it has
;; rows; one with Button opens a small form (its Class) whose Action
;; (formActions, with the selected key of its When Selected list as
;; `selected`) may return a message, or a key to select in its Selects
;; list; it is offered while its When Choices field has choices, or while
;; its When Selected list has a selection whose Selected Has is set. A
;; Section with Cards lists groups of items (cards) under its Title and
;; Hint; one with Lines is growable rows of its Fields saved together by
;; its Action (lineActions). Everything is reloaded after each change.

(defun sections-with (s id rel)
  (lists:filter (lambda (p) (andalso (== (kind s p) #"Section") (=/= (val s p rel) 'undefined))) (app-view:things s id)))

(defun list-name (s id l) (if (== l id) #"main" (val s l #"Name")))
(defun list-fields (s l) (lists:filter (lambda (p) (== (kind s p) #"Field")) (app-view:things s l)))
(defun list-entries (s l) (lists:filter (lambda (p) (== (kind s p) #"Entry")) (app-view:things s l)))
(defun blank (s fields) (list #"{ " (lists:join #", " (lists:map (lambda (f) (list (val s f #"Name") #": ''")) fields)) #" }"))
(defun of-list (s id l)
  (case (val s l #"Of")
    ('undefined 'undefined)
    (name (car (lists:filter (lambda (x) (== (val s x #"Name") name)) (sections-with s id #"Records"))))))
(defun stringify (v) (list #"Object.fromEntries(Object.entries(" v #").map(([k, x]) => [k, String(x ?? '')])) as Values"))

(defun list-screen (s id)
  (let* ((lists (lists:append (if (== (val s id #"Records") 'undefined) '() (list id)) (sections-with s id #"Records")))
         (tables (sections-with s id #"Table"))
         (buttons (sections-with s id #"Button"))
         (cardss (sections-with s id #"Cards"))
         (liness (sections-with s id #"Lines"))
         (eaches (sections-with s id #"Each"))
         (pickers (sections-with s id #"Pickers"))
         (panels (lists:filter (lambda (p) (panel? s p)) (sections-with s id #"Action")))
         (layout (lists:filter (lambda (p) (orelse (lists:any (lambda (r) (=/= (val s p r) 'undefined)) (list #"Records" #"Each" #"Search")) (lists:member p panels)))
                               (lists:filter (lambda (p) (== (kind s p) #"Section")) (app-view:things s id))))
         (forms (lists:append (list lists buttons panels pickers)))
         (fields (lists:append (lists:map (lambda (l) (list-fields s l)) (lists:append forms liness))))
         (chosen (lists:filter (lambda (f) (=/= (val s f #"Choices") 'undefined)) fields))
         (modes (case (val s id #"Modes") ('undefined '()) (m (binary:split m #" " '(global trim_all))))))
    (list
      #"<script lang='ts'>\n" (header s id)
      #"  import '$lib/generated.css';\n"
      #"  import { session, translations } from '$lib/state.svelte';\n"
      #"  import Form from '$lib/components/Form.svelte';\n"
      #"  import SelectableListEditor from '$lib/components/SelectableListEditor.svelte';\n"
      #"  import { cards, commands, filters, formActions, formRecords, lineActions, records, sources, tables, type Card, type Choice, type FormRecord, type Row, type Table, type Values } from '$lib/screen-runtime';\n\n"
      #"  const t = (word: string) => translations.current[word] ?? word;\n"
      #"  const context = () => ({ business: session.current?.businessName ?? '', ledger: session.current?.ledgerName ?? '', party: '' });\n"
      #"  const message = (e: unknown) => (e instanceof Error ? e.message : t('Could not complete.'));\n"
      #"  let rows: Record<string, Row[]> = $state({});\n"
      #"  let selected: Record<string, string | null> = $state({});\n"
      #"  let inserting: Record<string, boolean> = $state({});\n"
      #"  let open: Record<string, boolean> = $state({});\n"
      #"  let notes: Record<string, string> = $state({});\n"
      #"  let failures: Record<string, string> = $state({});\n"
      #"  let shown: Record<string, Table> = $state({});\n"
      #"  let cardSets: Record<string, Card[]> = $state({});\n"
      #"  let eachRecords: Record<string, FormRecord[]> = $state({});\n"
      #"  let choices: Record<string, Choice[]> = $state({});\n"
      #"  const options = $derived(Object.fromEntries(Object.entries(choices).map(([k, cs]) => [k, cs.map((c) => c.value)])));\n"
      #"  let loading = $state(true);\n"
      #"  let error = $state('');\n"
      #"  let search = $state('');\n"
      #"  let mode = $state(" (case modes ('() #"''") ((cons m _) (js (car (binary:split m #"="))))) #");\n"
      #"  let values: Record<string, Record<string, string | number | string[]>> = $state({ "
      (lists:join #", " (lists:map (lambda (l) (list (list-name s id l) #": " (blank-defaults s (list-fields s l)))) forms))
      #" });\n"
      #"  let lines: Record<string, Values[]> = $state({ "
      (lists:join #", " (lists:map (lambda (l) (list (val s l #"Name") #": [" (blank s (list-fields s l)) #"]")) liness))
      #" });\n"
      #"  let busy: Record<string, boolean> = $state({});\n"
      #"  const keys: Record<string, string> = { "
      (lists:join #", " (lists:map (lambda (l) (list (list-name s id l) #": " (js (val s l #"Key")))) lists))
      #" };\n"
      #"  const rowOf = (list: string) => (rows[list] ?? []).find((r) => String(r[keys[list]]) === selected[list]);\n"
      #"  const found = (list: string, field: string) => {\n"
      #"    const wanted = search.trim().toLowerCase();\n"
      #"    return wanted ? (rows[list] ?? []).filter((r) => (r[field] ?? '').toLowerCase().includes(wanted)) : (rows[list] ?? []);\n  };\n"
      #"  const pickerValues = (): Values => ({ "
      (lists:map (lambda (p) (list #"..." (stringify (list #"values." (val s p #"Name"))) #", ")) pickers)
      #"search });\n\n"
      (lists:map (lambda (l) (list-functions s id l (lists:append lists eaches))) lists)
      (lists:map (lambda (b) (button-function s b)) (lists:append buttons panels))
      (lists:map (lambda (l) (lines-function s l)) liness)
      (lists:map (lambda (e) (each-functions s id e)) eaches)
      #"  let latest = 0;\n"
      #"  async function load() {\n"
      #"    const request = ++latest;\n"
      #"    const { business, ledger } = context();\n"
      #"    error = '';\n"
      #"    try {\n"
      (lists:map (lambda (l) (list #"      await load_" (list-name s id l) #"();\n")) lists)
      (lists:map (lambda (sec) (list #"      const table_" (val s sec #"Table") #" = await tables." (val s sec #"Table") #"(context());\n")) tables)
      (lists:map (lambda (sec) (list #"      const cards_" (val s sec #"Cards") #" = await cards." (val s sec #"Cards") #"(context());\n")) cardss)
      (lists:map (lambda (f) (list #"      const choices_" (val s f #"Name") #" = await sources." (val s f #"Choices") #"(business, ledger);\n")) chosen)
      #"      if (request !== latest) return;\n"
      (lists:map (lambda (sec) (list #"      shown." (val s sec #"Table") #" = table_" (val s sec #"Table") #";\n")) tables)
      (lists:map (lambda (sec) (list #"      cardSets." (val s sec #"Cards") #" = cards_" (val s sec #"Cards") #";\n")) cardss)
      (lists:map (lambda (f) (list #"      choices." (val s f #"Name") #" = choices_" (val s f #"Name") #";\n")) chosen)
      (lists:map (lambda (f) (let* ((form (field-form s f forms))
                                    (all (list #"choices_" (val s f #"Name")))
                                    (offered (case (val s f #"Filter") ('undefined all) (x (list #"filters." x #"(" all #", " (stringify (list #"values." form)) #")")))))
                               (list #"      if (!values." form #"." (val s f #"Name") #") values." form #"." (val s f #"Name") #" = " offered #"[0]?.value ?? '';\n")))
                 (lists:filter (lambda (f) (andalso (== (val s f #"Default") #"first") (=/= (field-form s f forms) 'undefined))) chosen))
      (lists:map (lambda (e) (list #"      await load_" (val s e #"Name") #"();\n")) eaches)
      #"    } catch (e) {\n      if (request === latest) error = message(e);\n"
      #"    } finally {\n      if (request === latest) loading = false;\n    }\n  }\n"
      #"  $effect(() => {\n    if (session.current) load();\n  });\n"
      (lists:map (lambda (e) (list #"  $effect(() => {\n    JSON.stringify(pickerValues());\n    if (!loading) load_" (val s e #"Name") #"().catch((err) => (error = message(err)));\n  });\n"))
                 (lists:filter (lambda (e) (== (val s e #"Of") 'undefined)) eaches))
      #"</script>\n\n"
      #"<svelte:head><title>{t(" (js (val s id #"Title")) #")}</title></svelte:head>\n\n"
      #"<fieldset class='page-title generated'>\n"
      #"  <legend>{t(" (js (val s id #"Title")) #")}</legend>\n"
      (intro-line s id)
      #"  {#if error}<p class='error'>{error}</p>{/if}\n"
      (case modes
        ('() #"")
        (ms (list #"  <fieldset class='mode-toggle'>\n    <legend>{t('Mode')}</legend>\n    <div class='mode-buttons'>\n"
                  (lists:map (lambda (m) (let (((list v l) (binary:split m #"=")))
                                           (list #"      <button class='btn' class:selected={mode === " (js v) #"} onclick={() => (mode = " (js v) #")}>" (t (binary:replace l #"_" #" " '(global))) #"</button>\n")))
                             ms)
                  #"    </div>\n"
                  (lists:map (lambda (p) (moded s p (list #"    <div class='pickers'>\n"
                                                         (lists:map (lambda (f) (inline-control s f (val s p #"Name") 'none 'none #"      ")) (list-fields s p))
                                                         #"    </div>\n")))
                             pickers)
                  #"  </fieldset>\n")))
      #"  {#if loading}\n    <p class='center-text'>{t('Loading')}{'\\u2026'}</p>\n  {:else}\n"
      (lists:map (lambda (sec) (table-block s sec)) tables)
      (if (== (val s id #"Records") 'undefined) #"" (list #"    <div class='list-wrap'>\n" (list-block s id id) #"    </div>\n"))
      (case layout
        ('() #"")
        (ls (list (case (val s id #"Lists Title") ('undefined #"") (lt (list #"    <h3>" (t lt) #"</h3>\n")))
                  #"    <div class='lists" (case (val s id #"Lists Class") ('undefined #"") (c (list #" " c))) #"'>\n"
                  (lists:map (lambda (l) (moded s l (layout-block s id l))) ls)
                  #"    </div>\n")))
      (case buttons
        ('() #"")
        (bs (list #"    <div class='action-bar'>\n" (lists:map (lambda (b) (button-block s b)) bs) #"    </div>\n")))
      (lists:map (lambda (c) (cards-block s c)) cardss)
      (lists:map (lambda (l) (lines-block s l)) liness)
      #"  {/if}\n"
      #"</fieldset>\n")))

;; A section with Action, a Card and no Button: a form always open.
(defun panel? (s p)
  (andalso (=/= (val s p #"Card") 'undefined) (== (val s p #"Button") 'undefined) (== (val s p #"Lines") 'undefined)
           (== (val s p #"Each") 'undefined) (== (val s p #"Records") 'undefined)))

(defun blank-defaults (s fields)
  (list #"{ " (lists:join #", " (lists:map (lambda (f) (list (val s f #"Name") #": "
                                                             (case (val s f #"Default") ('undefined #"''") (#"first" #"''") (d (js d)))))
                                           fields)) #" }"))

;; Shown only in its Mode, when it has one.
(defun moded (s sec body)
  (case (val s sec #"Mode")
    ('undefined body)
    (m (list #"    {#if mode === " (js m) #"}\n" body #"    {/if}\n"))))

;; One section of the side-by-side layout, in its Card when it has one.
(defun layout-block (s id l)
  (let ((inner (cond ((=/= (val s l #"Records") 'undefined)
                      (list (search-box s l (list-name s id l) (val s l #"Search On" (val s l #"Key"))) (list-block s id l)
                            (case (val s l #"Limit") ('undefined #"")
                              (n (list #"        {#if found(" (js (list-name s id l)) #", " (js (val s l #"Search On" (val s l #"Key"))) #").length > " n #"}<p class='hint'>{'\\u2026'} +{found(" (js (list-name s id l)) #", " (js (val s l #"Search On" (val s l #"Key"))) #").length - " n #"}</p>{/if}\n")))))
                     ((=/= (val s l #"Each") 'undefined) (each-block s id l))
                     ((=/= (val s l #"Search") 'undefined) (search-box s l (val s l #"Counts") (val s l #"Search On" #"name")))
                     ('true (panel-block s l)))))
    (case (val s l #"Card")
      ('undefined inner)
      (c (list #"      <div class='card " c #"'>\n"
               (case (val s l #"Card Title") ('undefined #"") (ct (list #"        <h3>" (t ct) #"</h3>\n")))
               inner #"      </div>\n")))))

;; The search box over a list, and how many of its rows it finds.
(defun search-box (s sec list field)
  (case (val s sec #"Search")
    ('undefined #"")
    (ph (list #"        <fieldset><legend>{t('Search')}</legend><input bind:value={search} placeholder={t(" (js ph) #")} /></fieldset>\n"
              #"        <p class='hint'>{found(" (js list) #", " (js field) #").length} / {(rows." list #" ?? []).length}</p>\n"))))

;; A form always open: its Title, its fields, its Submit Label.
(defun panel-block (s p)
  (let ((n (val s p #"Name")))
    (list (case (val s p #"Title") ('undefined #"") (ti (list #"        <h3>" (t ti) #"</h3>\n")))
          (lists:map (lambda (f) (inline-control s f n (list #"act_" n #"()") #"void 0" #"        ")) (list-fields s p))
          #"        <button class='btn' onclick={act_" n #"}>" (t (val s p #"Submit Label" #"Save")) #"</button>\n"
          #"        {#if failures." n #"}<p class='error small'>{failures." n #"}</p>{/if}\n")))

;; A form per record (formRecords: Each), each saved on its own (Action,
;; with the record's key and the parent's selected key). With Of: the
;; records of the row selected there, under its Show, or the Empty Text
;; until one is; otherwise from the pickers and the search, reloaded as
;; they change. Rows: a line per record; otherwise a fieldset per record.
(defun each-functions (s id e)
  (let ((n (val s e #"Name")))
    (list
      #"  async function load_" n #"() {\n"
      (case (val s e #"Of")
        ('undefined (list #"    eachRecords." n #" = await formRecords." (val s e #"Each") #"(context(), undefined, pickerValues());\n"))
        (o (list #"    const parent = rowOf(" (js o) #");\n    eachRecords." n #" = parent ? await formRecords." (val s e #"Each") #"(context(), parent, pickerValues()) : [];\n")))
      #"  }\n"
      #"  async function save_" n #"(record: FormRecord) {\n"
      #"    busy[" (js n) #" + record.key] = true;\n    error = '';\n"
      #"    try {\n      await formActions." (val s e #"Action") #"(context(), { ...record.values, key: record.key"
      (case (val s e #"Of") ('undefined #"") (o (list #", parent: selected." o #" ?? ''")))
      #" });\n      await load();\n"
      #"    } catch (err) {\n      error = message(err);\n    } finally {\n      busy[" (js n) #" + record.key] = false;\n    }\n  }\n")))

(defun each-block (s id e)
  (let* ((n (val s e #"Name"))
         (fields (list-fields s e))
         (inputs (lists:map (lambda (f) (list #"<input bind:value={record.values." (val s f #"Name") #"} dir={record.dir ?? 'ltr'} />")) fields))
         (save (list #"<button class='btn' onclick={() => save_" n #"(record)} disabled={busy[" (js n) #" + record.key]}>{busy[" (js n) #" + record.key] ? t('Saving') + '\\u2026' : t('Save')}</button>"))
         (records (list #"eachRecords." n #" ?? []"))
         (body (list
                 #"        {#each " records #" as record (record.key)}\n"
                 (if (=/= (val s e #"Rows") 'undefined)
                   (list #"          <div class='each-row'><div class='each-title' dir={record.dir ?? 'ltr'}>{record.title}</div>" inputs save #"</div>\n")
                   (list #"          <fieldset><legend>{record.title}</legend><div class='each-line'>" inputs save #"</div></fieldset>\n"))
                 #"        {/each}\n")))
    (case (val s e #"Of")
      ('undefined (list #"        {#if (" records #").length === 0}<p class='hint'>" (t (val s e #"Empty Text" #"None")) #"</p>{/if}\n" body))
      (o (list #"        {#if !selected." o #"}\n          <p class='hint'>" (t (val s e #"Empty Text" #"None")) #"</p>\n        {:else}\n"
               #"          <h3>{rowOf(" (js o) #")?." (val s e #"Show" #"name") #" ?? ''}</h3>\n" body #"        {/if}\n")))))

;; The form (list or button section) a field belongs to, by name.
(defun field-form (s f forms)
  (case (lists:filter (lambda (l) (lists:member f (list-fields s l))) forms)
    ((cons l _) (if (== (kind s l) #"Section") (val s l #"Name") #"main"))
    ('() 'undefined)))

(defun keydown (submit cancel)
  (list #"(e) => { if (e.key === 'Enter') { e.preventDefault(); " submit #"; } else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); " cancel #"; } }"))

;; A field as a plain control bound to values.<form>.
(defun inline-control (s f form submit cancel pad)
  (let* ((bound (list #"values." form #"." (val s f #"Name")))
         (keys (if (== submit 'none) #"" (list #" onkeydown={" (keydown submit cancel) #"}")))
         (offered (case (val s f #"Filter")
                    ('undefined (list #"choices." (val s f #"Name") #" ?? []"))
                    (x (list #"filters." x #"(choices." (val s f #"Name") #" ?? [], " (stringify (list #"values." form)) #")"))))
         (control
           (case (val s f #"Control" #"text")
             (#"select"
              (list pad #"<select name=" (js (val s f #"Name")) #" bind:value={" bound #"}" keys #">"
                    (case (val s f #"Options")
                      ('undefined (list #"{#each " offered #" as c}<option value={c.value}>{t(c.label)}</option>{/each}"))
                      (opts (lists:map (lambda (o) (let (((list v l) (binary:split o #"="))) (list #"<option value=" (js v) #">" (t (binary:replace l #"_" #" " '(global))) #"</option>")))
                                       (binary:split opts #" " '(global trim_all)))))
                    #"</select>\n"))
             (control
              (list pad #"<input type=" (js control) #" name=" (js (val s f #"Name")) #" bind:value={" bound #"}"
                    (case (val s f #"Placeholder") ('undefined #"") (ph (list #" placeholder={t(" (js ph) #")}")))
                    keys #" />\n")))))
    (case (val s f #"Label")
      ('undefined control)
      (label (list pad #"<fieldset>\n" pad #"  <legend>" (t label) #"</legend>\n" control pad #"</fieldset>\n")))))

(defun list-functions (s id l lists)
  (let* ((n (list-name s id l))
         (parent (of-list s id l))
         (children (lists:filter (lambda (c) (== (of-list s id c) l)) lists))
         (blank-values (blank s (list-fields s l))))
    (list
      #"  async function load_" n #"() {\n"
      (if (== parent 'undefined)
        (list #"    rows." n #" = await records." (val s l #"Records") #"(context());\n")
        (list #"    const parent = rowOf(" (js (list-name s id parent)) #");\n"
              #"    rows." n #" = parent ? await records." (val s l #"Records") #"(context(), parent) : [];\n"))
      #"  }\n"
      #"  function select_" n #"(r: Row) {\n    selected." n #" = String(r." (val s l #"Key") #");\n"
      (lists:map (lambda (c) (let ((cn (list-name s id c))) (list #"    selected." cn #" = null;\n    inserting." cn #" = false;\n    load_" cn #"();\n"))) children)
      #"  }\n"
      #"  function close_" n #"() {\n    inserting." n #" = false;\n    values." n #" = " blank-values #";\n  }\n"
      #"  async function insert_" n #"(v: Record<string, string | number | string[]>) {\n"
      #"    await formActions." (val s l #"Insert") #"(context(), { ..." (stringify #"v")
      (if (== parent 'undefined) #"" (list #", parent: selected." (list-name s id parent) #" ?? ''"))
      #" });\n    close_" n #"();\n    await load();\n  }\n"
      #"  async function remove_" n #"(row: Row) {\n"
      (case (val s l #"Confirm")
        ('undefined #"")
        (_ (list #"    if (!confirm(`${t('Delete')} \"${row." (val s l #"Show" (val s l #"Key")) #"}\"? ${t(\"This can't be undone.\")}`)) return;\n")))
      #"    error = '';\n"
      #"    try {\n      await commands." (val s l #"Delete") #"(context(), row);\n"
      #"      if (selected." n #" === row." (val s l #"Key") #") selected." n #" = null;\n      await load();\n"
      #"    } catch (e) {\n      error = message(e);\n    }\n  }\n")))

(defun list-block (s id l)
  (let* ((n (list-name s id l))
         (entries (list-entries s l))
         (fields (list-fields s l))
         (parent (of-list s id l))
         (legend (case parent
                   ('undefined (list #"t(" (js (val s l #"List Title" (val s l #"Title"))) #")"))
                   (p (list #"`${t(" (js (val s l #"List Title" (val s l #"Title"))) #")} \"${rowOf(" (js (list-name s id p)) #")?." (val s l #"Show" #"name") #" ?? ''}\"`"))))
         (labelled (lists:any (lambda (e) (=/= (val s e #"Label") 'undefined)) entries))
         (editor
           (list
             (if labelled
               (list #"      {#if (rows." n #" ?? []).length > 0}\n        <div class='list-row list-header'>"
                     (lists:map (lambda (e) (list #"<span" (list-cell-class s e #"") #">" (t (val s e #"Label" #"")) #"</span>")) entries)
                     #"</div>\n      {/if}\n")
               #"")
             #"      <SelectableListEditor\n"
             #"        legend={" legend #"}\n"
             #"        hintText={t(" (js (val s l #"Hint" #"")) #")}\n"
             #"        items={" (case (val s l #"Search")
                         ('undefined (list #"rows." n #" ?? []"))
                         (_ (list #"found(" (js n) #", " (js (val s l #"Search On" (val s l #"Key"))) #")"
                                  (case (val s l #"Limit") ('undefined #"") (lim (list #".slice(0, " lim #")")))))) #"}\n"
             #"        getId={(r) => r." (val s l #"Key") #"}\n"
             #"        selectedId={selected." n #" ?? null}\n"
             #"        onSelect={select_" n #"}\n"
             #"        onInsert={() => (inserting." n #" = true)}\n"
             #"        onDelete={remove_" n #"}\n"
             #"        inserting={inserting." n #" ?? false}\n"
             #"        emptyText={t(" (js (val s l #"Empty Text" #"None")) #")}\n"
             #"      >\n"
             #"        {#snippet form()}\n"
             (if (=/= (val s l #"Inline") 'undefined)
               (lists:map (lambda (f) (inline-control s f n
                                                      (list #"insert_" n #"(values." n #").catch((err) => (error = message(err)))")
                                                      (list #"close_" n #"()") #"          ")) fields)
               (list #"          <Form\n            fields={[\n"
                     (lists:map (lambda (f) (list #"              " (form-field s f #"options") #",\n")) fields)
                     #"            ]}\n"
                     #"            bind:values={values." n #"}\n            onSubmit={insert_" n #"}\n            showSubmitButton={false}\n            onCancel={close_" n #"}\n          />\n"))
             #"        {/snippet}\n"
             #"        {#snippet row(r)}\n          <div class='list-row'>"
             (lists:map (lambda (e) (list #"<span" (list-cell-class s e #" mono") #">{r." (val s e #"Name") #" ?? ''}</span>")) entries)
             #"</div>\n        {/snippet}\n"
             #"      </SelectableListEditor>\n")))
    (case parent
      ('undefined editor)
      (p (list #"      {#if selected." (list-name s id p) #"}\n" editor #"      {/if}\n")))))

(defun list-cell-class (s e figure)
  (case (val s e #"Control")
    (#"amount" (list #" class='cell num" figure #"'"))
    (#"hint" #" class='cell hint'")
    (_ #" class='cell'")))

(defun table-block (s sec)
  (let ((tb (list #"shown." (val s sec #"Table"))))
    (list #"    {#if " tb #" && " tb #".rows.length > 0}\n"
          #"      <div class='card summary-card'>\n"
          #"        <h3>" (t (val s sec #"Title")) #"</h3>\n"
          #"        <table class='summary-table'>\n"
          #"          <thead><tr>{#each " tb #".columns as c}<th class:num={c.numeric}>{c.label}</th>{/each}</tr></thead>\n"
          #"          <tbody>{#each " tb #".rows as r}<tr>{#each " tb #".columns as c}<td class={`${c.numeric ? 'num mono' : ''} ${r.classes?.[c.name] ?? ''}`}>{r.cells[c.name] ?? ''}</td>{/each}</tr>{/each}</tbody>\n"
          #"        </table>\n"
          #"      </div>\n    {/if}\n")))

(defun button-function (s b)
  (let ((n (val s b #"Name")))
    (list
      #"  async function act_" n #"() {\n"
      #"    failures." n #" = '';\n"
      #"    try {\n"
      #"      const result = await formActions." (val s b #"Action") #"(context(), { ..." (stringify (list #"values." n))
      (case (val s b #"When Selected") ('undefined #"") (w (list #", selected: selected." w #" ?? ''")))
      #" });\n"
      #"      open." n #" = false;\n"
      #"      values." n #" = " (blank s (list-fields s b)) #";\n"
      #"      if (result?.message) notes." n #" = result.message;\n"
      #"      await load();\n"
      (case (val s b #"Selects") ('undefined #"") (l (list #"      if (result?.select) select_" l #"({ [keys." l #"]: result.select });\n")))
      #"    } catch (e) {\n      failures." n #" = message(e);\n    }\n  }\n")))

(defun button-block (s b)
  (let* ((n (val s b #"Name"))
         (when (case (tuple (val s b #"When Choices") (val s b #"When Selected"))
                 ((tuple 'undefined 'undefined) #"true")
                 ((tuple c 'undefined) (list #"(choices." c #" ?? []).length > 0"))
                 ((tuple _ l) (case (val s b #"Selected Has")
                                ('undefined (list #"!!rowOf(" (js l) #")"))
                                (has (list #"!!rowOf(" (js l) #")?." has))))))
         (cancel (list #"open." n #" = false")))
    (list
      #"      {#if open." n #"}\n"
      #"        <div class=" (js (val s b #"Class" #"action-form")) #">\n"
      (lists:map (lambda (f) (inline-control s f n (list #"act_" n #"()") cancel #"          ")) (list-fields s b))
      (case (val s b #"Submit Label") ('undefined #"") (l (list #"          <button type='button' class='btn small' onclick={act_" n #"}>" (t l) #"</button>\n")))
      (case (val s b #"Cancel Label") ('undefined #"") (l (list #"          <button type='button' class='btn secondary small' onclick={() => (" cancel #")}>" (t l) #"</button>\n")))
      #"        </div>\n"
      #"      {:else if " when #"}\n"
      #"        <button type='button' class='btn secondary small' onclick={() => { open." n #" = true; failures." n #" = ''; notes." n #" = ''; }}>" (t (val s b #"Button")) #"</button>\n"
      #"      {/if}\n"
      #"      {#if failures." n #"}<p class='error small'>{failures." n #"}</p>{/if}\n"
      #"      {#if notes." n #"}<p class='success small'>{notes." n #"}</p>{/if}\n")))

(defun cards-block (s c)
  (let ((set (list #"cardSets." (val s c #"Cards"))))
    (list
      #"    <h3>" (t (val s c #"Title")) #"</h3>\n"
      (case (val s c #"Hint") ('undefined #"") (h (list #"    <p class='hint'>" (t h) #"</p>\n")))
      #"    {#if (" set #" ?? []).length === 0}\n      <p class='empty'>" (t (val s c #"Empty Text" #"None")) #"</p>\n"
      #"    {:else}\n      <div class='cards'>\n        {#each " set #" ?? [] as card}\n"
      #"          <div class='card'><ol class='card-list'>{#each card as item}<li>{item.text} <span class='hint'>{item.note ?? ''}</span></li>{/each}</ol></div>\n"
      #"        {/each}\n      </div>\n    {/if}\n")))

(defun lines-function (s l)
  (let ((n (val s l #"Name")))
    (list
      #"  async function save_" n #"() {\n"
      #"    busy." n #" = true;\n    error = '';\n"
      #"    try {\n      await lineActions." (val s l #"Action") #"(context(), lines." n #");\n"
      #"      lines." n #" = [" (blank s (list-fields s l)) #"];\n      await load();\n"
      #"    } catch (e) {\n      error = message(e);\n    } finally {\n      busy." n #" = false;\n    }\n  }\n")))

(defun lines-block (s l)
  (let ((n (val s l #"Name")))
    (list
      #"    <div class='new-lines'>\n"
      #"      {#each lines." n #" as line, i}\n        <div class='add-row'>\n"
      (lists:map (lambda (f) (list #"          <input type='text'"
                                   (case (val s f #"Placeholder") ('undefined #"") (ph (list #" placeholder={t(" (js ph) #")}")))
                                   #" bind:value={line." (val s f #"Name") #"} />\n"))
                 (list-fields s l))
      #"          {#if lines." n #".length > 1}<button class='btn-secondary' onclick={() => (lines." n #" = lines." n #".filter((_, j) => j !== i))}>{'\\u00d7'}</button>{/if}\n"
      #"        </div>\n      {/each}\n"
      #"      <div class='line-actions'>\n"
      #"        <button class='btn-secondary' onclick={() => (lines." n #" = [...lines." n #", " (blank s (list-fields s l)) #"])}>" (t (val s l #"Add Label" #"Add")) #"</button>\n"
      #"        <button class='btn' onclick={save_" n #"} disabled={busy." n #"}>{busy." n #" ? '\\u2026' : t(" (js (val s l #"Submit Label" #"Save")) #")}</button>\n"
      #"      </div>\n    </div>\n")))
