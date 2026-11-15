;;; The Svelte emitter: source entities to .svelte files.
;;;
;;; Each kind of source node emits its own text; whatever lay between parts
;;; in the original (whitespace, punctuation, comments) is stored on the
;;; nodes, so the output is the file exactly. Files are rewritten only when
;;; their text has changed, so an unchanged file keeps its timestamp and
;;; tools downstream (Vite, svelte-check, make) see no change.

(defmodule source-svelte
  (export (emit 2) (regenerate 3)))

(defun rel (s id r) (source-entities:value s id r))
(defun rel (s id r default) (source-entities:value s id r default))
(defun is (s id r) (source-entities:is s id r))

(defun emit (s id)
  (emit-kind (source-entities:kind s id) s id))

(defun all (s id)
  (lists:map (lambda (c) (emit s c)) (source-entities:things s id)))

(defun emit-kind
  ((#"File" s id) (all s id))
  ((#"Block" s id) (all s id))
  ((#"Text" s id) (rel s id #"Raw"))
  ((#"Comment" s id) (rel s id #"Raw"))
  ((#"Expression" s id) (list #"{" (rel s id #"Code") #"}"))
  ((#"Block Tag" s id) (rel s id #"Code"))
  ((#"Statement" s id) (rel s id #"Code"))
  ((#"Element" s id) (element s id (is s id #"Closed")))
  ((#"Script" s id) (element s id 'true))
  ((#"Style" s id) (element s id 'true))
  ((#"Attribute" s id) (attribute s id))
  ((#"Rule" s id) (list (rel s id #"Selector") (rel s id #"Before" #"") #"{" (all s id) #"}"))
  ((#"At Rule" s id)
   (if (is s id #"Braced")
     (list (rel s id #"Head") #"{" (all s id) #"}")
     (rel s id #"Head")))
  ((#"Declaration" s id)
   (case (rel s id #"Raw")
     ('undefined (list (rel s id #"Property") (rel s id #"Separator") (rel s id #"Value")))
     (raw raw)))
  ((k _ id) (error (tuple 'no-emitter k id))))

;; <tag attributes Tag-End> content </tag>; attributes come first among a
;; tag's things.
(defun element (s id closed)
  (let* ((tag (rel s id #"Tag"))
         (kids (source-entities:things s id))
         (attribute? (lambda (c) (== (source-entities:kind s c) #"Attribute"))))
    (list #"<" tag
          (lists:map (lambda (c) (emit s c)) (lists:filter attribute? kids))
          (rel s id #"Tag End" #"") #">"
          (lists:map (lambda (c) (emit s c)) (lists:filter (lambda (c) (not (funcall attribute? c))) kids))
          (if closed (list #"</" tag #">") #""))))

(defun attribute (s id)
  (let ((space (rel s id #"Space" #" ")))
    (if (is s id #"Shorthand")
      (list space #"{" (rel s id #"Code") #"}")
      (list space (rel s id #"Name")
            (if (is s id #"Assign")
              (let ((q (rel s id #"Quote" #"")))
                (list #"=" q (all s id) q))
              #"")))))

;; Writes every File under Application/Source to out-dir, keeping the
;; folder path. Returns #(written unchanged).
(defun regenerate (s out-dir only)
  (let ((source (source-entities:path s (list #"Root" #"Application" #"Source"))))
    (if (== source 'undefined) (error 'no-application-source))
    (walk s source out-dir only (tuple 0 0))))

(defun walk (s id dir only counts)
  (lists:foldl
    (lambda (c acc)
      (let ((path (filename:join dir (source-entities:name s c))))
        (case (source-entities:kind s c)
          (#"Folder" (walk s c path only acc))
          (#"File" (if (selected? path only) (write-file path (emit s c) acc) acc))
          (_ acc))))
    counts
    (source-entities:things s id)))

(defun selected?
  ((_ 'all) 'true)
  ((path prefix) (=/= (string:prefix path prefix) 'nomatch)))

(defun write-file (path text acc)
  (let ((bytes (iolist_to_binary text))
        ((tuple written unchanged) acc))
    (case (file:read_file path)
      ((tuple 'ok same) (when (== same bytes)) (tuple written (+ unchanged 1)))
      (_ (filelib:ensure_dir path)
         (case (file:write_file path bytes)
           ('ok (tuple (+ written 1) unchanged))
           ((tuple 'error why) (error (tuple 'cannot-write path why))))))))
