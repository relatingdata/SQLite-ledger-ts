%% Small Erlang helper behind storage_engine.gleam's own entry point:
%% os:getenv/1 wants a plain Erlang string (list), not the binary
%% Gleam strings actually are, and returns the atom `false` for
%% "not set" rather than a real Result/Option — this does both
%% conversions in one place so the Gleam side sees a real
%% gleam/option Option(String).
-module(storage_engine_ffi).
-export([getenv_option/1]).

getenv_option(NameBin) ->
    case os:getenv(binary_to_list(NameBin)) of
        false -> none;
        Value -> {some, list_to_binary(Value)}
    end.
