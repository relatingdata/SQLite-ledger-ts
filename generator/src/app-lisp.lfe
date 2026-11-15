;;; Configuration entities printed as Lisp, for reading: an entity is
;;; (kind name (relation value) ... thing ...), with relation names in
;;; kebab case, a reference as the name of what it points at, and an
;;; ordered thing named by its Name relation. Read only: the entities stay
;;; the source.

(defmodule app-lisp
  (export (entity 2)))

(defun entity (s id) (unicode:characters_to_binary (list (print s id 0) #"\n")))

(defun print (s id depth)
  (let* ((kind (app-entities:kind s id))
         (rels (app-entities:relations s id))
         (named (lists:keyfind #"Name" 1 rels))
         (label (case named ('false (if (ordered-name? (app-entities:name s id)) '() (list #" " (atom (app-entities:name s id)))))
                  ((tuple _ n) (list #" " (atom n)))))
         (pad (lists:duplicate (* 2 (+ depth 1)) 32))
         (items (++ (lists:map (lambda (r) (list (kebab (element 1 r)) #" " (atom (element 2 r)))) (lists:keydelete #"Name" 1 rels))
                    (lists:map (lambda (r) (list (kebab (element 1 r)) #" " (atom (app-entities:name s (element 2 r))))) (app-entities:references s id))))
         (one-line (lists:map (lambda (i) (list #" (" i #")")) items))
         (things (app-entities:things s id)))
    (list #"(" (kebab (if (== kind 'undefined) #"entity" kind)) label
          (if (andalso (== things '()) (< (iolist_size one-line) 70))
            one-line
            (list (lists:map (lambda (i) (list #"\n" pad #"(" i #")")) items)
                  (lists:map (lambda (t) (list #"\n" pad (print s t (+ depth 1)))) things)))
          #")")))

(defun ordered-name? (n) (== (re:run n #"^[a-zA-Z][0-9a-zA-Z]*$" '(#(capture none))) 'match))

(defun kebab (b) (string:lowercase (binary:replace b #" " #"-" '(global))))

;; A bare symbol when it reads as one, otherwise a string (non-ASCII kept).
(defun atom (b)
  (case (re:run b #"^[A-Za-z0-9_.+$@/-]+$" '(#(capture none)))
    ('match b)
    (_ (list #"\"" (binary:replace (binary:replace b #"\\" #"\\\\" '(global)) #"\"" #"\\\"" '(global)) #"\""))))
