;;; Terminal (TUI) screens from the configuration entities: the same
;;; screens, from the same entities, as app-svelte makes for the web.
;;;
;;; A web template writes the whole page. A TUI template writes the
;;; screen's description as a spec, and the TUI's own form for that
;;; template (tui/src/forms) draws it: the TUI's counterpart of the web's
;;; HTML elements. Both call the same behaviour, the web's
;;; $lib/screen-runtime (choice sources, totals, actions, reactions,
;;; reports), which the TUI build compiles from frontend/src/lib.
;;;
;;; A screen is generated for the TUI only when its template is one the
;;; TUI has (transaction, report, drill) and it uses nothing the TUI form does
;;; not do yet (listed Records, Commands); `screen` returns `skip` with
;;; the reason otherwise. The templates are ASCII only.

(defmodule app-sveltui
  (export (screen 2) (file 1)))

(defun val (s id rel) (app-view:val s id rel))
(defun val (s id rel default) (app-view:val s id rel default))
(defun kind (s id) (app-view:kind s id))

;; The file a route's TUI screen is written to, under tui/src/generated:
;; "/arap/cash-purchase" is "arap--cash-purchase.svelte".
(defun file (route)
  (list (binary:replace (string:trim route 'leading "/") #"/" #"--" '(global)) #".svelte"))

;; The screen's TUI component, or (tuple 'skip reason).
(defun screen (s id)
  (let* ((parts (app-view:things s id))
         (kinds (lists:map (lambda (p) (kind s p)) parts)))
    (case (val s id #"Template")
      (#"transaction"
       (cond ((=/= (val s id #"Records") 'undefined) (tuple 'skip #"lists Records"))
             ((lists:member #"Command" kinds) (tuple 'skip #"has Commands"))
             ('true (component s id #"TransactionForm" (transaction s id parts)))))
      (#"report" (report-screen s id parts kinds))
      (#"drill" (report-screen s id parts kinds))
      (other (tuple 'skip (list #"template " other))))))

(defun report-screen (s id parts kinds)
  (if (lists:member #"Command" kinds)
    (tuple 'skip #"has Commands")
    (component s id #"ReportForm" (report s id parts))))

(defun component (s id form spec)
  (list
    #"<script lang='ts'>\n"
    #"  // Generated from application/application.entities (screen " (app-entities:name s id) #",\n"
    #"  // template " (val s id #"Template") #"). Not source: change the entities.\n"
    #"  import " form #" from '../forms/" form #".svelte';\n\n"
    #"  let { businessName, ledgerName, onBack }: { businessName: string; ledgerName: string; onBack: () => void } = $props();\n\n"
    #"  const spec = " spec #";\n"
    #"</script>\n\n"
    #"<" form #" {spec} {businessName} {ledgerName} {onBack} />\n"))

;; --- the spec as a JS object literal ------------------------------------------

(defun js (bin)
  (let* ((a (binary:replace bin #"\\" #"\\\\" '(global)))
         (b (binary:replace a #"'" #"\\'" '(global)))
         (c (binary:replace b #"\n" #"\\n" '(global))))
    (list #"'" c #"'")))

;; A property of the spec from a value of the entity, left out when unset.
(defun prop (s id rel key)
  (case (val s id rel)
    ('undefined '())
    (v (list (list key #": " (js v))))))

(defun object (props) (list #"{ " (lists:join #", " props) #" }"))

(defun array (items) (list #"[" (lists:join #", " items) #"]"))

;; Options are "value=Label value=Label"; an underscore in a label is a space.
(defun options (s f)
  (case (val s f #"Options")
    ('undefined '())
    (opts (list (list #"options: "
                      (array (lists:map (lambda (o)
                                          (let (((list v l) (binary:split o #"=")))
                                            (array (list (js v) (js (binary:replace l #"_" #" " '(global)))))))
                                        (binary:split opts #" " '(global trim_all)))))))))

(defun field (s f placement)
  (object (lists:append
            (list (list (list #"name: " (js (val s f #"Name")))
                        (list #"label: " (js (val s f #"Label" (val s f #"Name"))))
                        (list #"control: " (js (val s f #"Control" #"text")))
                        (list #"placement: " (js placement)))
                  (prop s f #"Choices" #"choices")
                  (prop s f #"Filter" #"filter")
                  (prop s f #"Empty" #"empty")
                  (prop s f #"Default" #"default")
                  (prop s f #"Reacts" #"reacts")
                  (prop s f #"Unless" #"unless")
                  (prop s f #"Reset" #"reset")
                  (prop s f #"Placeholder" #"placeholder")
                  (options s f)))))

(defun column (s c)
  (object (lists:append
            (list (list (list #"name: " (js (val s c #"Name")))
                        (list #"label: " (js (val s c #"Label" (val s c #"Name"))))
                        (list #"control: " (js (val s c #"Control" #"text"))))
                  (prop s c #"Default" #"default")
                  (prop s c #"Placeholder" #"placeholder")))))

;; --- the transaction template -----------------------------------------------
;;
;; The fields before the line columns, the columns of one line at a time,
;; the fields after them, then the screen's action and Add another line.

(defun transaction (s id parts)
  (let* ((columns (lists:filter (lambda (p) (andalso (== (kind s p) #"Column") (=/= (val s p #"Control") #"storage-badge"))) parts))
         (before (lists:filter (lambda (p) (== (kind s p) #"Field")) (lists:takewhile (lambda (p) (=/= (kind s p) #"Column")) parts)))
         (after (lists:filter (lambda (p) (andalso (== (kind s p) #"Field") (not (lists:member p before)))) parts)))
    (object (lists:append
              (list (prop s id #"Title" #"title")
                    (prop s id #"Intro" #"intro")
                    (prop s id #"Party" #"party")
                    (prop s id #"Party Label" #"partyLabel")
                    (prop s id #"Side" #"side")
                    (prop s id #"Action" #"action")
                    (prop s id #"Fail Text" #"failText")
                    (prop s id #"Submit Label" #"submitLabel")
                    (prop s id #"Total Label" #"totalLabel")
                    (prop s id #"Totals" #"totals")
                    (list (list #"fields: " (array (lists:append (lists:map (lambda (f) (field s f #"before")) before)
                                                                 (lists:map (lambda (f) (field s f #"after")) after)))))
                    (list (list #"columns: " (array (lists:map (lambda (c) (column s c)) columns)))))))))

;; --- the report template -----------------------------------------------------
;;
;; The parameter fields (Control=ledger chooses the ledger), then the
;; report the screen names, reloaded whenever a parameter changes.

(defun report (s id parts)
  (let ((fields (lists:filter (lambda (p) (== (kind s p) #"Field")) parts))
        (entries (lists:filter (lambda (p) (== (kind s p) #"Entry")) parts)))
    (object (lists:append
              (list (prop s id #"Title" #"title")
                    (prop s id #"Intro" #"intro")
                    (prop s id #"Intro Name" #"introName")
                    (prop s id #"Report" #"report")
                    (prop s id #"Empty Text" #"emptyText")
                    (list (list #"fields: " (array (lists:map (lambda (f) (field s f #"before")) fields))))
                    (list (list #"entries: "
                                (array (lists:map (lambda (e)
                                                    (object (lists:append
                                                              (list (list (list #"name: " (js (val s e #"Name")))
                                                                          (list #"label: " (js (val s e #"Label" #"")))
                                                                          (list #"control: " (js (val s e #"Control" #"text"))))
                                                                    (prop s e #"Table" #"table")))))
                                                  entries)))))))))
