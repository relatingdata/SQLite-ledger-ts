;;; The entities, read straight from SQLite.
;;;
;;; Loads the current version of every entity (the latest row of each
;;; entity_id in the append-only `entities` table) through the sqlite3
;;; command-line tool, the same way the storage engine reaches SQLite, and
;;; answers the questions the emitters ask: a node's name, its kind, the
;;; value of one of its relations, and its things in order.
;;;
;;; A thing is a child that has a Kind relation; the other children of a
;;; thing are its relations, each pointing at its value. Source nodes are
;;; named by order keys, so sorting children by name puts them in order.

(defmodule source-entities
  (export (load 1) (name 2) (kind 2) (value 3) (value 4) (is 3)
          (things 2) (child 3) (path 2)))

(defun current-rows ()
  (++ "SELECT e.entity_id, COALESCE(e.parent_id, ''), COALESCE(e.relation_id, ''), hex(e.name) "
      "FROM entities e JOIN (SELECT entity_id, MAX(row_id) AS r FROM entities GROUP BY entity_id) m "
      "ON m.r = e.row_id"))

;; A store is a map: nodes (id -> #(parent relation name)) and children
;; (parent -> [id]).
(defun load (db)
  (let* ((out (sqlite db (current-rows)))
         (lines (binary:split out #b(10) '(global trim_all))))
    (lists:foldl #'add-row/2 (map 'nodes (map) 'children (map)) lines)))

(defun add-row (line store)
  (case (binary:split line #b(124) '(global))
    ((list id parent relation hex)
     (let* ((i (binary_to_integer id))
            (p (if (== parent #b()) 'null (binary_to_integer parent)))
            (r (if (== relation #b()) 'null (binary_to_integer relation)))
            (nodes (maps:put i (tuple p r (binary:decode_hex hex)) (mref store 'nodes)))
            (kids (maps:update_with p (lambda (l) (cons i l)) (list i) (mref store 'children))))
       (map 'nodes nodes 'children kids)))
    (_ store)))

(defun sqlite (db query)
  (let ((port (open_port (tuple 'spawn_executable (os:find_executable "sqlite3"))
                         (list (tuple 'args (list "-batch" "-noheader" "-separator" "|" db query))
                               'binary 'exit_status 'stream))))
    (collect port '())))

(defun collect (port acc)
  (receive
    ((tuple p (tuple 'data bytes)) (when (== p port)) (collect port (cons bytes acc)))
    ((tuple p (tuple 'exit_status 0)) (when (== p port)) (iolist_to_binary (lists:reverse acc)))
    ((tuple p (tuple 'exit_status n)) (when (== p port)) (error (tuple 'sqlite3-failed n)))))

(defun node (store id) (maps:get id (mref store 'nodes)))

(defun name (store id) (element 3 (node store id)))

(defun raw-children (store id) (maps:get id (mref store 'children) '()))

;; The child named `n`, or 'undefined.
(defun child (store id n)
  (case (lists:filter (lambda (c) (== (name store c) n)) (raw-children store id))
    ((cons c _) c)
    ('() 'undefined)))

;; The name of the entity a relation points at: its value.
(defun value (store id relation)
  (case (child store id relation)
    ('undefined 'undefined)
    (c (case (element 2 (node store c))
         ('null 'undefined)
         (target (name store target))))))

(defun value (store id relation default)
  (case (value store id relation)
    ('undefined default)
    (v v)))

(defun is (store id relation) (=/= (value store id relation) 'undefined))

(defun kind (store id) (value store id #"Kind"))

;; The things under a node, in order; hidden ones are left out.
(defun things (store id)
  (let ((ts (lists:filter (lambda (c) (and (=/= (kind store c) 'undefined)
                                           (=/= (value store c #"Hidden") #"Active")))
                          (raw-children store id))))
    (lists:sort (lambda (a b) (=< (name store a) (name store b))) ts)))

;; The node at a path of names from the root, or 'undefined.
(defun path (store names)
  (lists:foldl (lambda (n at) (if (== at 'undefined) 'undefined (child store at n)))
               'null
               names))
