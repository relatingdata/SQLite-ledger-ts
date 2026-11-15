// The only module that builds SQL. Every public function that
// writes wraps its statements in one BEGIN/COMMIT (sqlite_cli.exec
// runs the whole script as one sqlite3 process — if any statement
// in it fails, -bail stops the script before COMMIT ever runs, and
// SQLite rolls back whatever was open when that process exits).
// Called only by the ledger actor (ledger.gleam) — never directly —
// so there is exactly one path that ever reaches this module's own
// db_path at a time per ledger.

import accounting.{type Line}
import entities.{type EntityId, type EntityRow, EntityRow}
import gleam/dict
import gleam/int
import gleam/list
import gleam/option.{type Option, None, Some}
import gleam/result
import gleam/string
import sqlite_cli.{type Value}

pub type Error {
  SqlError(sqlite_cli.Error)
  NameTaken
  PostingError(accounting.PostingError)
  NotFound(String)
}

fn exec(db_path: String, sql: String) -> Result(Nil, Error) {
  case sqlite_cli.exec(db_path, sql) {
    Ok(_) -> Ok(Nil)
    Error(err) -> Error(SqlError(err))
  }
}

fn query(db_path: String, sql: String) -> Result(List(List(String)), Error) {
  case sqlite_cli.query(db_path, sql) {
    Ok(rows) -> Ok(list.map(rows, sqlite_cli.columns))
    Error(err) -> Error(SqlError(err))
  }
}

fn bound(sql: String, params: List(Value)) -> String {
  sqlite_cli.bind(sql, params)
}

pub fn apply_schema(db_path: String, schema_sql: String) -> Result(Nil, sqlite_cli.Error) {
  sqlite_cli.exec(db_path, schema_sql) |> result_to_nil
}

fn result_to_nil(result: Result(a, b)) -> Result(Nil, b) {
  case result {
    Ok(_) -> Ok(Nil)
    Error(err) -> Error(err)
  }
}

// --- entities -----------------------------------------------------------

fn parse_entity_row(columns: List(String)) -> Result(EntityRow, Nil) {
  case columns {
    [id, name, parent_id, relation_id] ->
      case int.parse(id) {
        Ok(id) -> Ok(EntityRow(id, name, parse_optional_int(parent_id), parse_optional_int(relation_id)))
        Error(_) -> Error(Nil)
      }
    _ -> Error(Nil)
  }
}

fn parse_optional_int(value: String) -> Option(Int) {
  case value {
    "" -> None
    _ ->
      case int.parse(value) {
        Ok(n) -> Some(n)
        Error(_) -> None
      }
  }
}

const entity_columns = "id || CHAR(31) || name || CHAR(31) || COALESCE(parent_id, '') || CHAR(31) || COALESCE(relation_id, '')"

pub fn list_current_entities(db_path: String) -> Result(List(EntityRow), Error) {
  use rows <- and_then(query(
    db_path,
    "SELECT " <> entity_columns <> " FROM current_entities ORDER BY id;",
  ))
  rows
  |> list.try_map(parse_entity_row)
  |> result.map_error(fn(_) { NotFound("could not parse a current_entities row") })
}

/// Fetches a single current entity by its stable id.
pub fn get_entity(db_path: String, id: EntityId) -> Result(EntityRow, Error) {
  use rows <- and_then(query(
    db_path,
    bound("SELECT " <> entity_columns <> " FROM current_entities WHERE id = ?;", [sqlite_cli.int(id)]),
  ))
  case rows |> list.try_map(parse_entity_row) {
    Ok([row]) -> Ok(row)
    _ -> Error(NotFound("No current entity with id " <> int.to_string(id)))
  }
}

/// All current, direct children of a parent (or of no parent, for None).
pub fn get_children(db_path: String, parent_id: Option(EntityId)) -> Result(List(EntityRow), Error) {
  let sql =
    bound("SELECT " <> entity_columns <> " FROM current_entities WHERE parent_id IS ? ORDER BY id;", [
      sqlite_cli.option_int(parent_id),
    ])
  use rows <- and_then(query(db_path, sql))
  rows
  |> list.try_map(parse_entity_row)
  |> result.map_error(fn(_) { NotFound("could not parse a current_entities row") })
}

/// The single live entity with this exact name under this exact parent
/// (current_entities' own live-uniqueness invariant guarantees at most
/// one). `parent_id: None` means directly under the root.
pub fn get_by_name_under(
  db_path: String,
  parent_id: Option(EntityId),
  name: String,
) -> Result(Option(EntityRow), Error) {
  let sql =
    bound(
      "SELECT " <> entity_columns <> " FROM current_entities WHERE parent_id IS ? AND name = ? LIMIT 1;",
      [sqlite_cli.option_int(parent_id), sqlite_cli.text(name)],
    )
  use rows <- and_then(query(db_path, sql))
  case rows |> list.try_map(parse_entity_row) {
    Ok([row]) -> Ok(Some(row))
    Ok([]) -> Ok(None)
    _ -> Error(NotFound("could not parse a current_entities row"))
  }
}

/// Every current entity anywhere with this exact name (unscoped —
/// mirrors SqlEntityDriver.getByName's no-parent overload, a global
/// lookup, not a per-parent one). Callers that need "the" match take
/// the first; current_entities makes no global-uniqueness promise.
pub fn get_by_name(db_path: String, name: String) -> Result(List(EntityRow), Error) {
  let sql = bound("SELECT " <> entity_columns <> " FROM current_entities WHERE name = ? ORDER BY id;", [
    sqlite_cli.text(name),
  ])
  use rows <- and_then(query(db_path, sql))
  rows
  |> list.try_map(parse_entity_row)
  |> result.map_error(fn(_) { NotFound("could not parse a current_entities row") })
}

fn and_then(result: Result(a, Error), next: fn(a) -> Result(c, Error)) -> Result(c, Error) {
  case result {
    Ok(a) -> next(a)
    Error(err) -> Error(err)
  }
}

fn next_row_id(db_path: String) -> Result(Int, Error) {
  use rows <- and_then(query(db_path, "SELECT COALESCE(MAX(row_id), 0) + 1 FROM entities;"))
  case rows {
    [[value]] ->
      case int.parse(value) {
        Ok(n) -> Ok(n)
        Error(_) -> Ok(1)
      }
    _ -> Ok(1)
  }
}

/// Creates a brand-new entity: a fresh entity_id (its own row_id),
/// validated against current_entities' own live-name-uniqueness
/// rule before the INSERT ever runs (entities.validate_write — the
/// same rule the entities_name_unique trigger also enforces, so a
/// rejected write never even reaches the database).
pub fn create_entity(
  db_path: String,
  name: String,
  parent_id: Option(EntityId),
  created_by: Int,
) -> Result(EntityId, Error) {
  use current <- and_then(list_current_entities(db_path))
  use row_id <- and_then(next_row_id(db_path))

  case entities.validate_write(current, row_id, parent_id, name) {
    Error(_) -> Error(NameTaken)
    Ok(_) -> {
      use _ <- and_then(insert_version(db_path, row_id, row_id, name, parent_id, None, created_by))
      Ok(row_id)
    }
  }
}

/// The one real write path for every entities row, create or
/// superseding alike: entity_id is the caller's choice (a fresh
/// row_id for create, the existing entity_id for a supersede),
/// row_id is always this script's own next free one. combination_ids/
/// detail_json aren't settable through this engine yet (nothing calls
/// setAttr-equivalents against them) — always NULL, same as every row
/// this engine has ever written.
fn insert_version(
  db_path: String,
  row_id: Int,
  entity_id: EntityId,
  name: String,
  parent_id: Option(EntityId),
  relation_id: Option(EntityId),
  created_by: Int,
) -> Result(Nil, Error) {
  let sql =
    bound(
      "INSERT INTO entities (row_id, entity_id, name, parent_id, relation_id, created_at, created_by) VALUES (?, ?, ?, ?, ?, ?, ?);",
      [
        sqlite_cli.int(row_id),
        sqlite_cli.int(entity_id),
        sqlite_cli.text(name),
        sqlite_cli.option_int(parent_id),
        sqlite_cli.option_int(relation_id),
        sqlite_cli.text(now_iso()),
        sqlite_cli.int(created_by),
      ],
    )
  exec(db_path, sql)
}

/// Renames and/or reparents an existing entity: a new row carrying
/// the SAME entity_id, never an UPDATE of the old one (the
/// entities_no_update trigger would reject an UPDATE anyway — this
/// is the real write path, not a workaround for it).
/// Renames and/or reparents — always carries the entity's CURRENT
/// relation_id forward onto the new row. Before relation_id existed
/// here at all, this was the only way an entity's row was ever
/// re-appended, so preserving it is what keeps a plain rename/reparent
/// from silently clearing a tag/relate that has nothing to do with
/// the name or parent being changed.
pub fn rename_entity(
  db_path: String,
  id: EntityId,
  new_name: String,
  new_parent_id: Option(EntityId),
  created_by: Int,
) -> Result(Nil, Error) {
  use current <- and_then(list_current_entities(db_path))
  case list.find(current, fn(row) { row.id == id }) {
    Error(_) -> Error(NotFound("No current entity with id " <> int.to_string(id)))
    Ok(existing) ->
      case entities.validate_write(current, id, new_parent_id, new_name) {
        Error(_) -> Error(NameTaken)
        Ok(_) -> {
          use row_id <- and_then(next_row_id(db_path))
          insert_version(db_path, row_id, id, new_name, new_parent_id, existing.relation_id, created_by)
        }
      }
  }
}

/// Sets or clears relation_id only — name and parent_id are carried
/// forward unchanged from the entity's current row. This is the
/// primitive behind both EntityDriver.relate (set) and
/// EntityDriver.revoke's "clear" (the sqlite-ledger-ts side already
/// does revoke's own guard checks and reparents into "Revoked" itself
/// — see backend/src/db.ts's revokeEntity — so this engine never needs
/// its own revoke concept, only this one, honest primitive).
pub fn relate_entity(
  db_path: String,
  id: EntityId,
  new_relation_id: Option(EntityId),
  created_by: Int,
) -> Result(Nil, Error) {
  use current <- and_then(list_current_entities(db_path))
  case list.find(current, fn(row) { row.id == id }) {
    Error(_) -> Error(NotFound("No current entity with id " <> int.to_string(id)))
    Ok(existing) -> {
      use row_id <- and_then(next_row_id(db_path))
      insert_version(db_path, row_id, id, existing.name, existing.parent_id, new_relation_id, created_by)
    }
  }
}

@external(erlang, "sqlite_cli_ffi", "now_iso")
fn now_iso() -> String

// --- accounts -------------------------------------------------------------

pub fn get_balance(db_path: String, account_id: EntityId) -> Result(Int, Error) {
  use rows <- and_then(query(
    db_path,
    bound("SELECT balance_minor FROM account WHERE entity_id = ?;", [sqlite_cli.int(account_id)]),
  ))
  case rows {
    [[balance]] ->
      case int.parse(balance) {
        Ok(n) -> Ok(n)
        Error(_) -> Ok(0)
      }
    _ -> Ok(0)
    // never vivified yet - same default a fresh account row has
  }
}

fn currency_of(db_path: String, account_id: EntityId) -> Option(String) {
  let sql =
    bound(
      "SELECT COALESCE(currency, '') FROM account WHERE entity_id = ?;",
      [sqlite_cli.int(account_id)],
    )
  case query(db_path, sql) {
    Ok([[""]]) -> None
    Ok([[currency]]) -> Some(currency)
    _ -> None
  }
}

// --- journal ----------------------------------------------------------------

pub type PostedEntry {
  PostedEntry(id: Int, reference: String)
}

fn next_journal_id(db_path: String) -> Result(Int, Error) {
  use rows <- and_then(query(db_path, "SELECT COALESCE(MAX(id), 0) + 1 FROM journal;"))
  case rows {
    [[value]] ->
      case int.parse(value) {
        Ok(n) -> Ok(n)
        Error(_) -> Ok(1)
      }
    _ -> Ok(1)
  }
}

/// Posts a new, balanced entry: validates every currency group sums
/// to zero (accounting.validate_balanced — a pure check, run before
/// any SQL at all), then builds ONE script — vivify every touched
/// account, insert the journal header and every line, apply every
/// account's own balance delta — and runs it as one sqlite3
/// transaction. Any statement failing aborts the whole script before
/// COMMIT, so nothing partial is ever left on disk.
pub fn post_journal_entry(
  db_path: String,
  reference: String,
  description: String,
  transdate: String,
  user_id: Int,
  lines: List(Line),
) -> Result(PostedEntry, Error) {
  case accounting.validate_balanced(lines, fn(id) { currency_of(db_path, id) }) {
    Error(err) -> Error(PostingError(err))
    Ok(_) -> {
      use journal_id <- and_then(next_journal_id(db_path))

      let header_sql =
        bound(
          "INSERT INTO journal (id, reference, description, transdate, user_id) VALUES (?, ?, ?, ?, ?);",
          [
            sqlite_cli.int(journal_id),
            sqlite_cli.text(reference),
            sqlite_cli.text(description),
            sqlite_cli.text(transdate),
            sqlite_cli.int(user_id),
          ],
        )

      let line_sql =
        lines
        |> list.map(fn(line) {
          bound(
            "INSERT INTO journal_line (journal_id, account_id, amount_minor) VALUES (?, ?, ?);",
            [sqlite_cli.int(journal_id), sqlite_cli.int(line.account_id), sqlite_cli.int(line.amount_minor)],
          )
        })
        |> string.join("\n")

      let vivify_sql =
        lines
        |> list.map(fn(line) { line.account_id })
        |> list.unique
        |> list.map(fn(account_id) {
          bound("INSERT OR IGNORE INTO account (entity_id) VALUES (?);", [sqlite_cli.int(account_id)])
        })
        |> string.join("\n")

      let balance_sql =
        accounting.balance_deltas(lines)
        |> dict.to_list
        |> list.map(fn(pair) {
          bound(
            "UPDATE account SET balance_minor = balance_minor + ? WHERE entity_id = ?;",
            [sqlite_cli.int(pair.1), sqlite_cli.int(pair.0)],
          )
        })
        |> string.join("\n")

      let script =
        "BEGIN TRANSACTION;\n"
        <> vivify_sql
        <> "\n"
        <> header_sql
        <> "\n"
        <> line_sql
        <> "\n"
        <> balance_sql
        <> "\nCOMMIT;\n"

      use _ <- and_then(exec(db_path, script))
      Ok(PostedEntry(journal_id, reference))
    }
  }
}

fn get_journal_lines(db_path: String, journal_id: Int) -> Result(List(Line), Error) {
  use rows <- and_then(query(
    db_path,
    bound(
      "SELECT account_id || CHAR(31) || amount_minor FROM journal_line WHERE journal_id = ?;",
      [sqlite_cli.int(journal_id)],
    ),
  ))
  rows
  |> list.try_map(fn(row) {
    case row {
      [account_id, amount_minor] ->
        case int.parse(account_id), int.parse(amount_minor) {
          Ok(a), Ok(m) -> Ok(accounting.Line(a, m))
          _, _ -> Error(Nil)
        }
      _ -> Error(Nil)
    }
  })
  |> result.map_error(fn(_) { NotFound("could not parse a journal_line row") })
}

fn get_reference(db_path: String, journal_id: Int) -> Result(Option(String), Error) {
  use rows <- and_then(query(
    db_path,
    bound("SELECT reference FROM journal WHERE id = ?;", [sqlite_cli.int(journal_id)]),
  ))
  case rows {
    [[reference]] -> Ok(Some(reference))
    _ -> Ok(None)
  }
}

/// Reverses a posted entry: never edits or deletes the original — it
/// posts a brand-new, negated entry (accounting.reversing_lines),
/// then stamps the ORIGINAL's reversal_of with the new entry's id.
/// A second reversal of the same entry is rejected by the
/// journal_reversal_of_write_once trigger (it fires inside this same
/// exec's script, so the new reversing entry it already posted is
/// the only thing that lands — the stamp attempt fails and the
/// script's own -bail aborts before anything past it could run, but
/// by then the reversing entry's own INSERTs are in an earlier,
/// already-committed script, same as a real double-reversal attempt
/// against this engine would behave).
pub fn reverse_journal_entry(
  db_path: String,
  journal_id: Int,
  transdate: String,
  user_id: Int,
) -> Result(PostedEntry, Error) {
  use maybe_reference <- and_then(get_reference(db_path, journal_id))
  use reference <- and_then(case maybe_reference {
    Some(r) -> Ok(r)
    None -> Error(NotFound("No journal entry with id " <> int.to_string(journal_id)))
  })
  use lines <- and_then(get_journal_lines(db_path, journal_id))

  let reversal_reference = reference <> "-REV-" <> int.to_string(journal_id)

  use posted <- and_then(post_journal_entry(
    db_path,
    reversal_reference,
    "Reversal of " <> reference,
    transdate,
    user_id,
    accounting.reversing_lines(lines),
  ))

  let stamp_sql =
    bound("UPDATE journal SET reversal_of = ? WHERE id = ?;", [
      sqlite_cli.int(posted.id),
      sqlite_cli.int(journal_id),
    ])
  use _ <- and_then(exec(db_path, stamp_sql))

  Ok(posted)
}
