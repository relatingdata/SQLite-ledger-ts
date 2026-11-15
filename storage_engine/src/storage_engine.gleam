import gleam/int
import gleam/io
import gleam/option.{type Option, None, Some}
import http_api
import http_server
import ledger
import schema_sql

// hex.pm isn't reachable in this sandbox (see README.md), so this
// reads the environment directly via Erlang's os:getenv rather than
// vendoring the `envoy` package the way stdlib/otp/erlang/gleeunit
// are already vendored as path dependencies.
@external(erlang, "storage_engine_ffi", "getenv_option")
fn getenv_option(name: String) -> Option(String)

pub fn main() {
  // Defaults match this engine's own standalone, pre-integration
  // behavior exactly (its own separate sqlite3 file, :8080) — set
  // STORAGE_ENGINE_DB_PATH to point this at the real, live database
  // (sqlite-ledger-ts's backend/data/entities.sqlite) instead.
  let db_path = case getenv_option("STORAGE_ENGINE_DB_PATH") {
    Some(path) -> path
    None -> "storage_engine.sqlite3"
  }
  let port = case getenv_option("STORAGE_ENGINE_PORT") {
    Some(value) ->
      case int.parse(value) {
        Ok(n) -> n
        Error(_) -> 8080
      }
    None -> 8080
  }

  case ledger.start(db_path, schema_sql.sql) {
    Ok(ledger) -> {
      io.println("storage engine listening on :" <> int.to_string(port) <> ", db=" <> db_path)
      http_server.start(port, fn(req) { http_api.handle_request(req, ledger) })
    }
    Error(_) -> io.println("failed to start the ledger actor against " <> db_path)
  }
}
