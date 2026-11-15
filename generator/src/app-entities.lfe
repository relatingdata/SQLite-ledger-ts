;;; The application's configuration, read from its ASCII form
;;; (application/application.entities; the format is in the Programmer's
;;; Manual, "Application Configuration as Entities").
;;;
;;; A store is a map: nodes (id -> #(parent pointer name)) and children
;;; (parent -> [id]). The questions the templates ask: a node at a path,
;;; its things in order, its kind, the value of one of its relations, and
;;; the entity a relation points at.

(defmodule app-entities
  (export (read 1) (parse 1) (path 2) (name 2) (kind 2) (things 2)
          (value 3) (value 4) (target 3) (child 3) (relations 2)))

(defun read (file)
  (let (((tuple 'ok text) (file:read_file file))) (parse text)))

(defun node (s id) (maps:get id (mref s 'nodes)))
(defun name (s id) (element 3 (node s id)))
(defun raw-children (s id) (maps:get id (mref s 'children) '()))

(defun child (s id n)
  (case (lists:filter (lambda (c) (== (name s c) n)) (raw-children s id))
    ((cons c _) c)
    ('() 'undefined)))

;; The entity a relation points at, or 'undefined.
(defun target (s id relation)
  (case (child s id relation)
    ('undefined 'undefined)
    (c (case (element 2 (node s c)) ('null 'undefined) (t t)))))

(defun value (s id relation)
  (case (target s id relation)
    ('undefined 'undefined)
    (t (name s t))))

(defun value (s id relation default)
  (case (value s id relation) ('undefined default) (v v)))

(defun kind (s id) (value s id #"Kind"))

;; The entity's own values, as #(Relation Value) in name order: each
;; relation child that points at a value child of its own.
(defun relations (s id)
  (lists:filtermap
    (lambda (c)
      (case (element 2 (node s c))
        ('null 'false)
        (v (if (andalso (== (raw-children s c) (list v)) (== (child s c #"Kind") 'undefined))
             (tuple 'true (tuple (name s c) (name s v)))
             'false))))
    (lists:sort (lambda (a b) (=< (name s a) (name s b))) (raw-children s id))))

;; Things (children with a Kind) in name order; ordered children's names
;; sort by position.
(defun things (s id)
  (lists:sort (lambda (a b) (=< (name s a) (name s b)))
              (lists:filter (lambda (c) (=/= (child s c #"Kind") 'undefined)) (raw-children s id))))

(defun path (s names)
  (lists:foldl (lambda (n at) (if (== at 'undefined) 'undefined (child s at n))) 'null names))

;; --- reading ---------------------------------------------------------------

;; Text to a store of the same shape source-entities:load returns.
(defun parse (text)
  (let* ((lines (binary:split text #b(10) '(global trim_all)))
         ((tuple store links _ _) (lists:foldl #'parse-line/2
                                               (tuple (map 'nodes (map) 'children (map)) '() '() 1)
                                               lines)))
    (lists:foldl (lambda (link st) (resolve link st)) store links)))

;; State: #(store links stack next-id); stack holds #(depth id ordered-count).
(defun parse-line
  ((line (tuple store links stack next))
   (parse-line line store links stack next)))

(defun parse-line (line store links stack next)
  (let* ((depth (indent line 0))
         (tokens (groups (tokenise (binary:part line depth (- (byte_size line) depth)))))
         (stack1 (lists:dropwhile (lambda (frame) (>= (element 1 frame) depth)) stack))
         (parent (case stack1 ((cons (tuple _ p _) _) p) ('() 'null)))
         ((cons head more) tokens)
         ((tuple nm stack2) (head-name head stack1))
         (id next)
         (store1 (add store id parent 'null nm))
         ((tuple store2 links1 next1) (lists:foldl (lambda (tok acc) (attach id tok acc)) (tuple store1 links (+ next 1)) more)))
    (tuple store2 links1 (cons (tuple depth id 0) stack2) next1)))

;; An ordered child gets a name that sorts by its position.
(defun head-name
  (((list (tuple 'str #"-")) (cons (tuple d p n) more))
   (tuple (list_to_binary (io_lib:format "~8..0B" (list n))) (cons (tuple d p (+ n 1)) more)))
  (((list (tuple 'str nm)) stack) (tuple nm stack)))

(defun indent (line n)
  (case line
    ((binary " " (rest binary)) (indent rest (+ n 1)))
    (_ n)))

(defun add (store id parent pointer nm)
  (map 'nodes (maps:put id (tuple parent pointer nm) (mref store 'nodes))
       'children (maps:update_with parent (lambda (l) (++ l (list id))) (list id) (mref store 'children))))

(defun set-pointer (store id target)
  (let (((tuple p _ nm) (maps:get id (mref store 'nodes))))
    (maps:put 'nodes (maps:put id (tuple p target nm) (mref store 'nodes)) store)))

;; One token group after the head, attached to entity `id`.
(defun attach
  ((id tok (tuple store links next)) (attach id tok store links next)))

(defun attach (id tok store links next)
  (case tok
    ((list 'colon (tuple 'str kind))
     (tuple (add store next id 'null #"Kind")
            (cons (tuple next (list #"Root" #"Application" #"Kinds" kind)) links)
            (+ next 1)))
    ((cons 'gt segments)
     (tuple store (cons (tuple id (segment-names segments)) links) next))
    ((list (tuple 'str key) 'eq (tuple 'str value))
     (let* ((s1 (add store next id 'null key))
            (s2 (add s1 (+ next 1) next 'null value)))
       (tuple (set-pointer s2 next (+ next 1)) links (+ next 2))))
    ((list* (tuple 'str key) 'gt segments)
     (tuple (add store next id 'null key)
            (cons (tuple next (segment-names segments)) links)
            (+ next 1)))))

(defun segment-names (segments)
  (lists:filtermap (lambda (t) (case t ((tuple 'str n) (tuple 'true n)) (_ 'false))) segments))

(defun resolve
  (((tuple id names) store) (resolve id names store)))

(defun resolve (id names store)
  (case (path store names)
    ('undefined (error (tuple 'unresolved-path names)))
    (target (set-pointer store id target))))

;; Characters to tokens: #(str Bin) for a name or string, and the
;; punctuation colon, eq, gt, slash, space.
(defun tokenise (bin) (lists:reverse (tokenise bin '())))

(defun tokenise (bin acc)
  (case bin
    (#b() acc)
    ((binary " " (rest binary)) (tokenise rest (cons 'space acc)))
    ((binary ":" (rest binary)) (tokenise rest (cons 'colon acc)))
    ((binary "=" (rest binary)) (tokenise rest (cons 'eq acc)))
    ((binary ">" (rest binary)) (tokenise rest (cons 'gt acc)))
    ((binary "/" (rest binary)) (tokenise rest (cons 'slash acc)))
    ((binary "\"" (rest binary))
     (let (((tuple str more) (quoted rest '())))
       (tokenise more (cons (tuple 'str str) acc))))
    (_ (let (((tuple word more) (bare bin #b())))
         (tokenise more (cons (tuple 'str word) acc))))))

(defun bare (bin acc)
  (case bin
    ((binary ch (rest binary))
     (if (lists:member ch (list 32 #\: #\= #\> #\/ #\"))
       (tuple acc bin)
       (bare rest (binary (acc binary) ch))))
    (_ (tuple acc bin))))

;; A JSON string body, up to its closing quote, as UTF-8.
(defun quoted (bin acc)
  (case bin
    ((binary "\"" (rest binary)) (tuple (unicode:characters_to_binary (lists:reverse acc)) rest))
    ((binary "\\u" (h binary (size 4)) (rest binary)) (quoted rest (unit (binary_to_integer h 16) acc)))
    ((binary "\\n" (rest binary)) (quoted rest (cons 10 acc)))
    ((binary "\\r" (rest binary)) (quoted rest (cons 13 acc)))
    ((binary "\\t" (rest binary)) (quoted rest (cons 9 acc)))
    ((binary "\\" ch (rest binary)) (quoted rest (cons ch acc)))
    ((binary ch (rest binary)) (quoted rest (cons ch acc)))))

;; A \uXXXX unit; a low surrogate joins the high one before it.
(defun unit (n acc)
  (case acc
    ((cons high more) (when (andalso (>= n #xDC00) (< n #xE000) (>= high #xD800) (< high #xDC00)))
     (cons (+ #x10000 (bsl (- high #xD800) 10) (- n #xDC00)) more))
    (_ (cons n acc))))

;; Tokens split at spaces into groups.
(defun groups (tokens)
  (lists:filter (lambda (g) (=/= g '()))
                (lists:reverse (lists:map #'lists:reverse/1 (groups tokens '(()))))))

(defun groups
  (('() acc) acc)
  (((cons 'space more) acc) (groups more (cons '() acc)))
  (((cons tok more) (cons current acc)) (groups more (cons (cons tok current) acc))))
