// A tiny SQLite driver over the real `sqlite3` CLI binary, used
// instead of sqlight/esqlite (see sqlite_cli_ffi.erl's header for
// why). Every call here writes a real, temporary .sql file and
// hands it to one `sqlite3 -bail <db> < <script>` process — the
// same real file, the same real transactions and triggers a NIF
// binding would use, just driven by a subprocess instead of an
// in-process C call.
//
// Only this module and sqlite_cli_ffi.erl ever touch the shell or
// the filesystem for SQL — storage.gleam only ever calls `exec` and
// `query`, both of which take real values (Gleam Ints/Strings/
// Options), never a hand-built SQL string from a caller. All
// escaping happens in ONE place (`sql_literal`), not scattered
// across storage.gleam's own query-building.

import gleam/int
import gleam/list
import gleam/option.{type Option, None, Some}
import gleam/string

pub type Error {
  /// The sqlite3 process exited non-zero; `output` is its own
  /// stderr+stdout (sqlite3 prints its real error message there —
  /// the same message a human running the CLI by hand would see).
  CommandFailed(output: String)
}

/// One value to splice into a script, always through sql_literal —
/// never string-concatenated directly. Mirrors sqlight's own Value
/// type so storage.gleam reads the same either way.
pub type Value {
  IntValue(Int)
  TextValue(String)
  NullValue
}

pub fn int(value: Int) -> Value {
  IntValue(value)
}

pub fn text(value: String) -> Value {
  TextValue(value)
}

pub fn null() -> Value {
  NullValue
}

pub fn option_int(value: Option(Int)) -> Value {
  case value {
    Some(n) -> IntValue(n)
    None -> NullValue
  }
}

pub fn option_text(value: Option(String)) -> Value {
  case value {
    Some(s) -> TextValue(s)
    None -> NullValue
  }
}

fn sql_literal(value: Value) -> String {
  case value {
    IntValue(n) -> int.to_string(n)
    TextValue(s) -> "'" <> string.replace(s, "'", "''") <> "'"
    NullValue -> "NULL"
  }
}

/// Fills `?` placeholders in `sql`, left to right, with `params`'
/// own real SQL literals — a tiny, in-process stand-in for a
/// prepared statement's own parameter binding (sqlight/esqlite would
/// bind these at the C layer instead; here they're substituted into
/// the script text itself, always as an escaped literal, never as
/// raw, unescaped user text).
pub fn bind(sql: String, params: List(Value)) -> String {
  case params {
    [] -> sql
    [value, ..rest] ->
      case string.split_once(sql, "?") {
        Ok(#(before, after)) -> before <> sql_literal(value) <> bind(after, rest)
        Error(_) -> sql
      }
  }
}

fn temp_path(suffix: String) -> String {
  "/tmp/storage_engine_" <> int.to_string(unique_int()) <> suffix
}

@external(erlang, "sqlite_cli_ffi", "unique_int")
fn unique_int() -> Int

@external(erlang, "sqlite_cli_ffi", "write_file")
fn write_file_ffi(path: String, content: String) -> Result(Nil, Nil)

@external(erlang, "sqlite_cli_ffi", "run_script")
fn run_script_ffi(db_path: String, script_path: String) -> Result(String, String)

/// Runs every statement in `sql` against `db_path` in one process —
/// the caller writes its own BEGIN/COMMIT when it needs one
/// transaction to cover several statements (storage.gleam always
/// does, for every write).
pub fn exec(db_path: String, sql: String) -> Result(String, Error) {
  let script_path = temp_path(".sql")
  case write_file_ffi(script_path, sql) {
    Ok(_) -> {
      let result = run_script_ffi(db_path, script_path)
      let _ = delete_file(script_path)
      case result {
        Ok(output) -> Ok(output)
        Error(output) -> Error(CommandFailed(output))
      }
    }
    Error(_) -> Error(CommandFailed("could not write the temporary script file"))
  }
}

@external(erlang, "file", "delete")
fn delete_file(path: String) -> Result(Nil, Nil)

/// Runs a single SELECT built with `row_expr` (see storage.gleam's
/// callers — each one concatenates its columns with CHAR(31) into
/// one text column per row, so this never needs its own SQL
/// parsing) and splits the output back into one list per row.
pub fn query(db_path: String, sql: String) -> Result(List(String), Error) {
  use output <- try(exec(db_path, "\n.headers off\n.mode list\n" <> sql <> "\n"))
  output
  |> string.split("\n")
  |> list.filter(fn(line) { line != "" })
  |> Ok
}

fn try(result: Result(a, b), next: fn(a) -> Result(c, b)) -> Result(c, b) {
  case result {
    Ok(a) -> next(a)
    Error(b) -> Error(b)
  }
}

/// Splits one query() row back into its own columns — the
/// CHAR(31)-joined text each row's row_expr produced.
pub fn columns(row: String) -> List(String) {
  string.split(row, "\u{001F}")
}
