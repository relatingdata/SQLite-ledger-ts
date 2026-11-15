;;; The source compiler's command line.
;;;
;;;   regenerate <db> <out-dir> [<path-prefix>]
;;;       Writes every source file under Application/Source into out-dir
;;;       (only files whose text changed; only those under the prefix).
;;;   print <db> <path>
;;;       Prints the Lisp view of one file, e.g.
;;;       frontend/src/lib/components/CashTransaction.svelte

(defmodule source-cli
  (export (main 1)))

(defun main
  (((list "regenerate" db out-dir)) (regenerate db out-dir 'all))
  (((list "regenerate" db out-dir prefix)) (regenerate db out-dir (filename:join out-dir prefix)))
  (((list "print" db path))
   (let* ((s (source-entities:load db))
          (names (++ (list #"Root" #"Application" #"Source")
                     (lists:map #'list_to_binary/1 (filename:split path))))
          (id (source-entities:path s names)))
     (if (== id 'undefined)
       (progn (io:format "No source file ~s~n" (list path)) (halt 1))
       (progn (io:setopts (list (tuple 'encoding 'unicode)))
              (io:put_chars (unicode:characters_to_binary (source-lisp:render (source-lisp:view s id))))
              (io:nl)))))
  ((args) (io:format "Usage: regenerate <db> <out-dir> [<prefix>] | print <db> <path>~nGot ~p~n" (list args)) (halt 2)))

(defun regenerate (db out-dir only)
  (let* ((s (source-entities:load db))
         ((tuple written unchanged) (source-svelte:regenerate s (list_to_binary out-dir) only)))
    (io:format "Regenerated from ~s: ~p written, ~p unchanged.~n" (list db written unchanged))))
