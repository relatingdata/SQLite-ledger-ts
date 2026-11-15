;;; The generator's command line.
;;;
;;;   generate <application.entities> <frontend-dir>
;;;
;;; Writes the page of every screen that has a Template into
;;; <frontend-dir>/src/routes<route>/+page.svelte, only when its text has
;;; changed, and prints the paths it is responsible for.

(defmodule app-generate
  (export (main 1)))

(defun main
  (((list entities frontend))
   (let* ((s (app-entities:read entities))
          (screens (app-entities:path s (list #"Root" #"Application" #"Screens")))
          (generated (lists:filter (lambda (id) (=/= (app-entities:value s id #"Template") 'undefined))
                                   (app-entities:things s screens)))
          (counts (lists:foldl (lambda (id acc) (write s id frontend acc)) (tuple 0 0) generated)))
     (io:format "Generated ~p screens from ~s: ~p written, ~p unchanged.~n"
                (list (length generated) entities (element 1 counts) (element 2 counts)))))
  ((args) (io:format "Usage: generate <application.entities> <frontend-dir>~nGot ~p~n" (list args)) (halt 2)))

(defun write
  ((s id frontend (tuple written unchanged)) (write s id frontend written unchanged)))

(defun write (s id frontend written unchanged)
  (let* ((route (app-entities:name s id))
         (path (filename:join (list frontend "src/routes" (binary_to_list (string:trim route 'leading "/")) "+page.svelte")))
         (text (unicode:characters_to_binary (app-svelte:screen s id))))
    (case (file:read_file path)
      ((tuple 'ok same) (when (== same text)) (tuple written (+ unchanged 1)))
      (_ (filelib:ensure_dir path)
         (file:write_file path text)
         (io:format "  ~s~n" (list path))
         (tuple (+ written 1) unchanged)))))
