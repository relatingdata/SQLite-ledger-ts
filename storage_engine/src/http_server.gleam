// A thin Gleam wrapper over http_server_ffi.erl — accept one
// connection at a time, spawn a fresh BEAM process per connection
// (they're cheap; this is "simplest possible", not "handles a
// million connections"), decode its one request, call `handle`, and
// write back whatever Response it returns.

import gleam/erlang/process
import gleam/int
import gleam/string

pub type Request {
  Request(method: String, path: String, body: String)
}

pub type Response {
  Response(status: Int, body: String)
}

type ListenSocket

type Socket

@external(erlang, "http_server_ffi", "listen")
fn listen_ffi(port: Int) -> Result(ListenSocket, String)

@external(erlang, "http_server_ffi", "accept")
fn accept_ffi(listen_socket: ListenSocket) -> Result(Socket, String)

@external(erlang, "http_server_ffi", "read_request")
fn read_request_ffi(socket: Socket) -> Result(#(String, String, String), String)

@external(erlang, "http_server_ffi", "send_response")
fn send_response_ffi(socket: Socket, response: String) -> Result(Nil, String)

@external(erlang, "http_server_ffi", "close")
fn close_ffi(socket: Socket) -> Nil

/// Listens on `port` and serves forever, calling `handle` once per
/// request. Never returns.
pub fn start(port: Int, handle: fn(Request) -> Response) -> Nil {
  case listen_ffi(port) {
    Ok(listen_socket) -> accept_loop(listen_socket, handle)
    Error(_) -> Nil
  }
}

fn accept_loop(listen_socket: ListenSocket, handle: fn(Request) -> Response) -> Nil {
  case accept_ffi(listen_socket) {
    Ok(socket) -> {
      process.spawn(fn() { serve_one(socket, handle) })
      accept_loop(listen_socket, handle)
    }
    Error(_) -> accept_loop(listen_socket, handle)
  }
}

fn serve_one(socket: Socket, handle: fn(Request) -> Response) -> Nil {
  case read_request_ffi(socket) {
    Ok(#(method, path, body)) -> {
      let response = handle(Request(method, path, body))
      let _ = send_response_ffi(socket, render(response))
      close_ffi(socket)
    }
    Error(_) -> close_ffi(socket)
  }
}

fn render(response: Response) -> String {
  "HTTP/1.1 "
  <> int.to_string(response.status)
  <> " "
  <> status_text(response.status)
  <> "\r\nContent-Type: application/json\r\nContent-Length: "
  <> int.to_string(string.byte_size(response.body))
  <> "\r\nConnection: close\r\n\r\n"
  <> response.body
}

fn status_text(status: Int) -> String {
  case status {
    200 -> "OK"
    201 -> "Created"
    204 -> "No Content"
    400 -> "Bad Request"
    404 -> "Not Found"
    409 -> "Conflict"
    422 -> "Unprocessable Entity"
    _ -> "Internal Server Error"
  }
}
