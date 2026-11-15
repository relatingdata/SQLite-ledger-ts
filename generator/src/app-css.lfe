;;; The generated pages' one stylesheet, from the Rule entities under
;;; Application/Styles: each rule's Selector, and every other value of it
;;; as a CSS property. Every selector is scoped under .generated, the class
;;; each generated page carries, so no hand-written page is affected.

(defmodule app-css
  (export (stylesheet 1)))

(defun stylesheet (s)
  (let ((styles (app-entities:path s (list #"Root" #"Application" #"Styles"))))
    (list #"/* Generated from application/application.entities (Application/Styles). Not source. */\n"
          (lists:map (lambda (r) (rule s r)) (app-entities:things s styles)))))

(defun rule (s r)
  (let* ((selectors (binary:split (app-entities:value s r #"Selector") #"," '(global trim_all)))
         (scoped (lists:join #", " (lists:map (lambda (sel) (list #".generated " (string:trim sel))) selectors)))
         (props (lists:filter (lambda (p) (=/= (element 1 p) #"Selector")) (app-entities:relations s r))))
    (list scoped #" {\n"
          (lists:map (lambda (p) (list #"  " (element 1 p) #": " (element 2 p) #";\n")) props)
          #"}\n")))
