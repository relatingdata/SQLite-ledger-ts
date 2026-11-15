;;; A screen as the templates see it, with Variant Of resolved.
;;;
;;; A screen that is Variant Of another holds only what differs: its own
;;; values override the base screen's, and its things are merged with the
;;; base's by Name. A thing with the same Name as a base thing overrides
;;; that thing's values (or, marked Remove=yes, removes it); a thing whose Name
;;; the base does not have is added after the base's things.
;;;
;;; An override's empty value ("") removes the base's value. An added thing
;;; with After=<name> goes straight after the thing of that name.
;;;
;;; A handle is an entity id, or #(merged Own Base) for a base thing with
;;; an override.

(defmodule app-view
  (export (val 3) (val 4) (kind 2) (things 2) (target 3) (relations 2)))

(defun base (s id) (app-entities:target s id #"Variant Of"))

(defun val
  ((s (tuple 'merged own b) rel)
   (case (app-entities:value s own rel) ('undefined (val s b rel)) (#"" 'undefined) (v v)))
  ((s id rel)
   (case (app-entities:value s id rel)
     ('undefined (case (base s id) ('undefined 'undefined) (b (val s b rel))))
     (v v))))

(defun val (s h rel default)
  (case (val s h rel) ('undefined default) (v v)))

(defun kind (s h) (val s h #"Kind"))

(defun target
  ((s (tuple 'merged own b) rel)
   (case (app-entities:target s own rel) ('undefined (target s b rel)) (t t)))
  ((s id rel)
   (case (app-entities:target s id rel)
     ('undefined (case (base s id) ('undefined 'undefined) (b (target s b rel))))
     (t t))))

(defun relations
  ((s (tuple 'merged own b))
   (let ((mine (relations s own)))
     (lists:filter (lambda (r) (=/= (element 2 r) #""))
                   (++ (lists:filter (lambda (r) (not (lists:keymember (element 1 r) 1 mine))) (relations s b)) mine))))
  ((s id) (app-entities:relations s id)))

(defun things
  ((s (tuple 'merged own _)) (app-entities:things s own))
  ((s id)
   (case (base s id)
     ('undefined (app-entities:things s id))
     (b (merge s (things s b) (app-entities:things s id))))))

(defun hidden? (s id) (== (app-entities:value s id #"Remove") #"yes"))

(defun merge (s base-things own-things)
  (let* ((name (lambda (h) (val s h #"Name")))
         (own-named (lambda (n) (lists:filter (lambda (o) (andalso (=/= n 'undefined) (== (val s o #"Name") n))) own-things)))
         (merged (lists:filtermap
                   (lambda (b)
                     (case (funcall own-named (funcall name b))
                       ((cons o _) (if (hidden? s o) 'false (tuple 'true (tuple 'merged o b))))
                       ('() (tuple 'true b))))
                   base-things))
         (base-names (lists:map name base-things))
         (added (lists:filter (lambda (o) (andalso (not (hidden? s o))
                                                   (not (lists:member (val s o #"Name") base-names))))
                              own-things)))
    (lists:foldl (lambda (a acc) (place s a acc)) merged added)))

(defun place (s a things)
  (case (app-entities:value s a #"After")
    ('undefined (++ things (list a)))
    (after (case (lists:splitwith (lambda (h) (=/= (val s h #"Name") after)) things)
             ((tuple before (cons at rest)) (++ before (list at a) rest))
             ((tuple _ '()) (++ things (list a)))))))
