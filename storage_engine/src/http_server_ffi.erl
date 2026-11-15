%% A minimal HTTP/1.1 server built directly on gen_tcp, driven by
%% Erlang's own built-in {packet, http_bin} request-line/header
%% decoder — no cowboy/mist/glisten (all unreachable via repo.hex.pm
%% from this sandbox; see sqlite_cli_ffi.erl's header for the same
%% constraint on the SQL side). One request per connection
%% (Connection: close), one process per connection.
-module(http_server_ffi).
-export([listen/1, accept/1, read_request/1, send_response/2, close/1]).

listen(Port) ->
    case gen_tcp:listen(Port, [binary, {active, false}, {packet, http_bin}, {reuseaddr, true}]) of
        {ok, Socket} -> {ok, Socket};
        {error, Reason} -> {error, format_reason(Reason)}
    end.

accept(ListenSocket) ->
    case gen_tcp:accept(ListenSocket) of
        {ok, Socket} -> {ok, Socket};
        {error, Reason} -> {error, format_reason(Reason)}
    end.

%% Reads one full request off Socket: the request line (decoded by
%% the {packet, http_bin} socket option into {http_request, ...}),
%% every header up to Content-Length (the only header this engine's
%% handlers need), then exactly that many raw body bytes.
read_request(Socket) ->
    case gen_tcp:recv(Socket, 0) of
        {ok, {http_request, MethodTerm, {abs_path, PathBin}, _Version}} ->
            read_headers(Socket, method_to_binary(MethodTerm), PathBin, 0);
        {ok, {http_request, MethodTerm, {absoluteURI, _S, _H, _P, PathBin}, _Version}} ->
            read_headers(Socket, method_to_binary(MethodTerm), PathBin, 0);
        {ok, Other} ->
            {error, iolist_to_binary(io_lib:format("unexpected request line: ~p", [Other]))};
        {error, Reason} ->
            {error, format_reason(Reason)}
    end.

read_headers(Socket, Method, Path, ContentLength) ->
    case gen_tcp:recv(Socket, 0) of
        {ok, {http_header, _, 'Content-Length', _, ValueBin}} ->
            Len = list_to_integer(binary_to_list(ValueBin)),
            read_headers(Socket, Method, Path, Len);
        {ok, {http_header, _, _OtherField, _, _Value}} ->
            read_headers(Socket, Method, Path, ContentLength);
        {ok, http_eoh} ->
            read_body(Socket, Method, Path, ContentLength);
        {error, Reason} ->
            {error, format_reason(Reason)}
    end.

read_body(_Socket, Method, Path, 0) ->
    {ok, {Method, Path, <<>>}};
read_body(Socket, Method, Path, Length) ->
    ok = inet:setopts(Socket, [{packet, raw}]),
    case gen_tcp:recv(Socket, Length) of
        {ok, Body} -> {ok, {Method, Path, Body}};
        {error, Reason} -> {error, format_reason(Reason)}
    end.

method_to_binary(Method) when is_atom(Method) -> atom_to_binary(Method, utf8);
method_to_binary(Method) when is_binary(Method) -> Method;
method_to_binary(Method) when is_list(Method) -> list_to_binary(Method).

send_response(Socket, Response) ->
    case gen_tcp:send(Socket, Response) of
        ok -> {ok, nil};
        {error, Reason} -> {error, format_reason(Reason)}
    end.

close(Socket) ->
    gen_tcp:close(Socket),
    nil.

format_reason(Reason) ->
    iolist_to_binary(io_lib:format("~p", [Reason])).
