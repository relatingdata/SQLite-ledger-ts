;;; The Lisp view: extracts a source subtree from the entities as an
;;; S-expression, for reading. Nothing is written back from it yet.
;;;
;;;   element      (tag.class.class (attribute value) ... children ...)
;;;   text         "words"
;;;   expression   (js "code"); {@html x} is (html "x"), and so on
;;;   block        (if (js "test") ... (:else ...))
;;;   script       (script (lang "ts") (ts "statement") ...)
;;;   style        (style (rule "selector" (property "value") ...) ...)
;;;
;;; Whitespace-only text between parts is layout: the view leaves it out,
;;; the entities keep it.

(defmodule source-lisp
  (export (view 2) (render 1)))

(defun rel (s id r) (source-entities:value s id r))
(defun kind (s id) (source-entities:kind s id))
(defun things (s id) (source-entities:things s id))

;; Docs: #(atom Bin), #(str Bin), #(list [Doc]).
(defun a (bin) (tuple 'atom bin))
(defun str (bin) (tuple 'str bin))
(defun l (docs) (tuple 'list docs))

(defun view (s id)
  (doc (kind s id) s id))

(defun kids (s id)
  (lists:filtermap (lambda (c) (case (view s c) ('skip 'false) (d (tuple 'true d)))) (things s id)))

(defun blank? (bin) (== (string:trim bin 'both " \t\n;") #""))

(defun doc
  ((#"File" s id) (l (list* (a #"file") (str (source-entities:name s id)) (kids s id))))
  ((#"Text" s id) (let ((raw (rel s id #"Raw"))) (if (blank? raw) 'skip (str (string:trim raw)))))
  ((#"Comment" s id) (l (list (a #"comment") (str (string:trim (rel s id #"Raw"))))))
  ((#"Expression" s id) (expression (rel s id #"Code")))
  ((#"Element" s id) (element s id (rel s id #"Tag")))
  ((#"Script" s id) (element s id #"script"))
  ((#"Style" s id) (element s id #"style"))
  ((#"Attribute" s id) (attribute s id))
  ((#"Statement" s id) (l (list (a #"ts") (str (string:trim (rel s id #"Code") 'leading)))))
  ((#"Rule" s id) (l (list* (a #"rule") (str (string:trim (rel s id #"Selector"))) (kids s id))))
  ((#"At Rule" s id) (l (list* (a #"at") (str (string:trim (rel s id #"Head"))) (kids s id))))
  ((#"Declaration" s id)
   (case (rel s id #"Raw")
     ('undefined (l (list (a (rel s id #"Property")) (str (rel s id #"Value")))))
     (raw (l (list (a #"declaration") (str raw))))))
  ((#"Block" s id) (block s id))
  ((#"Block Tag" s id) (str (rel s id #"Code")))
  ((_ _ _) 'skip))

;; {@html x} -> (html "x"); {x} -> (js "x").
(defun expression (code)
  (case code
    ((binary "@" (rest binary))
     (case (binary:split rest #" ")
       ((list word more) (l (list (a word) (str (string:trim more)))))
       ((list word) (l (list (a word))))))
    (_ (l (list (a #"js") (str (string:trim code)))))))

;; A class attribute of plain words joins the tag: td.num.
(defun element (s id tag)
  (let* ((all (things s id))
         (attrs (lists:filter (lambda (c) (== (kind s c) #"Attribute")) all))
         (plain-class (lists:filter (lambda (c) (plain-class? s c)) attrs))
         (head (case plain-class
                 ((list c) (iolist_to_binary (list tag #"." (binary:replace (string:trim (class-words s c)) #" " #"." '(global)))))
                 (_ tag)))
         (rest (lists:filter (lambda (c) (not (lists:member c plain-class))) all)))
    (l (cons (a head) (lists:filtermap (lambda (c) (case (view s c) ('skip 'false) (d (tuple 'true d)))) rest)))))

(defun plain-class? (s c)
  (andalso (== (rel s c #"Name") #"class")
           (lists:all (lambda (p) (== (kind s p) #"Text")) (things s c))
           (=/= (class-words s c) #"")))

(defun class-words (s c)
  (iolist_to_binary (lists:map (lambda (p) (rel s p #"Raw")) (things s c))))

(defun attribute (s id)
  (if (source-entities:is s id #"Shorthand")
    (expression (rel s id #"Code"))
    (let ((name (a (rel s id #"Name"))))
      (if (source-entities:is s id #"Assign")
        (l (cons name (lists:map (lambda (p) (part s p)) (things s id))))
        (l (list name))))))

(defun part (s p)
  (case (kind s p)
    (#"Text" (str (rel s p #"Raw")))
    (#"Expression" (expression (rel s p #"Code")))))

;; {#if a} x {:else} y {/if} -> (if (js "a") x (:else y)).
(defun block (s id)
  (let* ((form (rel s id #"Form"))
         (sections (lists:foldl (lambda (c acc) (block-step s c acc)) '() (things s id)))
         (ordered (lists:reverse (lists:map (lambda (sec) (lists:reverse sec)) sections))))
    (case ordered
      ((cons (cons (tuple 'list items) body) more)    ; {:else if …} chained from an outer {#if}
       (l (++ items body (lists:map #'section/1 more))))
      ((cons (cons head body) more) (l (++ (list (a form)) (header-arg head) body (lists:map #'section/1 more))))
      (_ (l (list (a form)))))))

;; A later section: its header's words, then its content.
(defun section
  (((cons (tuple 'list items) body)) (l (++ items body)))
  (((cons head body)) (l (cons head body))))

;; Each tag opens a section; content joins the current one. A section is a
;; reversed list whose last element is its header doc.
(defun block-step (s c sections)
  (case (kind s c)
    (#"Block Tag"
     (let ((code (string:trim (rel s c #"Code"))))
       (case code
         ((binary "{/" (_ binary)) sections)
         ((binary "{#" (rest binary)) (cons (list (tag-head rest 'open)) sections))
         ((binary "{:" (rest binary)) (cons (list (tag-head rest 'branch)) sections))
         (_ (add-to sections (str code))))))
    (_ (case (view s c) ('skip sections) (d (add-to sections d))))))

(defun add-to
  (('() d) (list (list d)))
  (((cons sec more) d) (cons (cons d sec) more)))

;; "if loading}" -> header; branches keep their keyword: (:else if (js "b")).
(defun tag-head (rest how)
  (let* ((inner (binary:part rest 0 (- (byte_size rest) 1)))
         (words (binary:split inner #" ")))
    (case (tuple how words)
      ((tuple 'open (list _ arg)) (tuple 'arg (string:trim arg)))
      ((tuple 'open _) (tuple 'arg #""))
      ((tuple 'branch (list kw arg)) (branch-head kw (string:trim arg)))
      ((tuple 'branch (list kw)) (a (iolist_to_binary (list #":" kw)))))))

(defun branch-head (kw arg)
  (case (binary:split arg #" ")
    ((list #"if" cond) (l (list (a (iolist_to_binary (list #":" kw #" if"))) (expression cond))))
    (_ (l (list (a (iolist_to_binary (list #":" kw))) (expression arg))))))

(defun header-arg
  (((tuple 'arg #"")) '())
  (((tuple 'arg arg)) (list (expression arg)))
  ((d) (list d)))

;; --- printing ------------------------------------------------------------

(defun render (d) (render d 0))

(defun render (d indent)
  (let ((flat (flat d)))
    (case d
      ((tuple 'list (cons head more))
       (if (=< (+ indent (iolist_size flat)) 100)
         flat
         (list #"(" (flat head)
               (lists:map (lambda (c) (list #"\n" (spaces (+ indent 2)) (render c (+ indent 2)))) more)
               #")")))
      (_ flat))))

(defun flat
  (((tuple 'atom b)) b)
  (((tuple 'str b)) (list #"\"" (escape b) #"\""))
  (((tuple 'arg b)) (list #"\"" (escape b) #"\""))
  (((tuple 'list docs)) (list #"(" (lists:join #" " (lists:map #'flat/1 docs)) #")")))

(defun escape (b)
  (binary:replace (binary:replace b #"\\" #"\\\\" '(global)) #"\"" #"\\\"" '(global)))

(defun spaces (n) (binary:copy #" " n))
