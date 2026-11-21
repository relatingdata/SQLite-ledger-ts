// The append-only and accounting rules, proved against the database
// itself: whatever writes the file (this engine, or the backend's own
// better-sqlite3 connection to the same entities.sqlite), an UPDATE or
// DELETE of a recorded row is refused by the schema's triggers, and
// nothing changes. Each test uses a fresh on-disk file.
// Documented in docs/pm-core-middleware.md, "The storage engine".

import accounting.{Line}
import core
import gleam/option.{None, Some}
import gleam/string
import gleeunit/should
import ledger
import schema_sql
import sqlite_cli
import storage

@external(erlang, "file", "delete")
fn delete_file(path: String) -> Result(Nil, Nil)

fn fresh_ledger(name: String) -> #(ledger.Ledger, String) {
  let path = "/tmp/storage_engine_constraints_" <> name <> ".sqlite3"
  let _ = delete_file(path)
  let assert Ok(l) = ledger.start(path, schema_sql.sql)
  #(l, path)
}

/// The statement is refused, with the trigger's own message.
fn refused(path: String, sql: String, because: String) {
  case sqlite_cli.exec(path, sql) {
    Ok(_) -> panic as { "accepted: " <> sql }
    Error(err) -> string.inspect(err) |> string.contains(because) |> should.be_true
  }
}

fn count(path: String, sql: String) -> String {
  let assert Ok([row]) = sqlite_cli.query(path, sql)
  row
}

// --- the original middleware's schema (priv/schema.sql) ---------------------

pub fn an_entity_row_can_never_be_updated_or_deleted_test() {
  let #(l, path) = fresh_ledger("entities")
  let assert Ok(id) = ledger.create_entity(l, "Cash", None, 1)
  let id_text = string.inspect(id)
  refused(path, "UPDATE entities SET name = 'Stolen' WHERE entity_id = " <> id_text <> ";", "append-only")
  refused(path, "DELETE FROM entities WHERE entity_id = " <> id_text <> ";", "append-only")
  count(path, "SELECT name FROM current_entities WHERE id = " <> id_text <> ";")
  |> should.equal("Cash")
}

pub fn a_rename_is_a_new_version_and_the_old_one_stays_test() {
  let #(l, path) = fresh_ledger("versions")
  let assert Ok(id) = ledger.create_entity(l, "Cash", None, 1)
  let assert Ok(_) = ledger.rename_entity(l, id, "Cash and Bank", None, 1)
  let id_text = string.inspect(id)
  count(path, "SELECT COUNT(*) FROM entities WHERE entity_id = " <> id_text <> ";")
  |> should.equal("2")
  count(path, "SELECT name FROM entities WHERE entity_id = " <> id_text <> " ORDER BY row_id LIMIT 1;")
  |> should.equal("Cash")
}

pub fn a_posted_entry_can_never_be_edited_or_deleted_test() {
  let #(l, path) = fresh_ledger("journal")
  let assert Ok(cash) = ledger.create_entity(l, "Cash", None, 1)
  let assert Ok(sales) = ledger.create_entity(l, "Sales", None, 1)
  let assert Ok(posted) =
    ledger.post_journal_entry(l, "SALE-1", "", "2027-01-01", 1, [Line(cash, 500), Line(sales, -500)])
  let jid = string.inspect(posted.id)
  refused(path, "UPDATE journal SET transdate = '2026-01-01' WHERE id = " <> jid <> ";", "append-only")
  refused(path, "UPDATE journal SET reference = 'OTHER' WHERE id = " <> jid <> ";", "append-only")
  refused(path, "DELETE FROM journal WHERE id = " <> jid <> ";", "append-only")
  refused(path, "UPDATE journal_line SET amount_minor = 1 WHERE journal_id = " <> jid <> ";", "append-only")
  refused(path, "DELETE FROM journal_line WHERE journal_id = " <> jid <> ";", "append-only")
  count(path, "SELECT SUM(amount_minor) || ',' || COUNT(*) FROM journal_line WHERE journal_id = " <> jid <> ";")
  |> should.equal("0,2")
}

pub fn a_reference_is_posted_once_test() {
  let #(l, _) = fresh_ledger("reference")
  let assert Ok(cash) = ledger.create_entity(l, "Cash", None, 1)
  let assert Ok(sales) = ledger.create_entity(l, "Sales", None, 1)
  let assert Ok(_) = ledger.post_journal_entry(l, "SALE-1", "", "2027-01-01", 1, [Line(cash, 500), Line(sales, -500)])
  let assert Error(_) = ledger.post_journal_entry(l, "SALE-1", "", "2027-01-02", 1, [Line(cash, 700), Line(sales, -700)])
  let assert Ok(balance) = ledger.get_balance(l, cash)
  balance |> should.equal(500)
}

pub fn a_reversal_is_stamped_once_and_only_on_reversal_of_test() {
  let #(l, path) = fresh_ledger("reversal")
  let assert Ok(cash) = ledger.create_entity(l, "Cash", None, 1)
  let assert Ok(sales) = ledger.create_entity(l, "Sales", None, 1)
  let assert Ok(posted) = ledger.post_journal_entry(l, "SALE-1", "", "2027-01-01", 1, [Line(cash, 500), Line(sales, -500)])
  let assert Ok(_) = ledger.reverse_journal_entry(l, posted.id, "2027-01-02", 1)
  let jid = string.inspect(posted.id)
  refused(path, "UPDATE journal SET reversal_of = NULL WHERE id = " <> jid <> ";", "write-once")
  let assert Ok(balance) = ledger.get_balance(l, cash)
  balance |> should.equal(0)
}

pub fn an_unbalanced_entry_in_any_currency_writes_nothing_test() {
  let #(l, path) = fresh_ledger("currencies")
  let assert Ok(cash) = ledger.create_entity(l, "Cash", None, 1)
  let assert Ok(sales) = ledger.create_entity(l, "Sales", None, 1)
  let assert Ok(eur) = ledger.create_entity(l, "Euro Cash", None, 1)
  let assert Ok(_) = sqlite_cli.exec(path, "INSERT INTO account (entity_id, currency) VALUES (" <> string.inspect(eur) <> ", 'EUR');")
  // The home currency balances, the euro line does not: refused whole.
  let assert Error(storage.PostingError(accounting.Unbalanced(Some("EUR"), 300))) =
    ledger.post_journal_entry(l, "MIXED-1", "", "2027-01-01", 1, [Line(cash, 500), Line(sales, -500), Line(eur, 300)])
  count(path, "SELECT COUNT(*) FROM journal;") |> should.equal("0")
  count(path, "SELECT COUNT(*) FROM journal_line;") |> should.equal("0")
}

// --- the core schema (core_schema.gleam) ------------------------------------

pub fn the_core_stores_refuse_every_update_and_delete_test() {
  let path = "/tmp/storage_engine_constraints_core.sqlite3"
  let _ = delete_file(path)
  let assert Ok(_) = core.install(path)
  let assert Ok(global) = core.open(path, "admin", core.global_business, "Actual")
  let assert Ok(_) = core.create_business(global, "Ice", "sam")
  let assert Ok(ice) = core.open(path, "sam", "Ice", "Actual")
  let assert Ok(_) = core.post(ice, "ICE-1", None, [#("Purchases", 5000), #("Cash", -5000)], [])
  refused(path, "UPDATE entities SET name = 'x';", "append-only")
  refused(path, "DELETE FROM entities;", "append-only")
  refused(path, "UPDATE journal SET date = '2000-01-01';", "append-only")
  refused(path, "DELETE FROM journal;", "append-only")
  refused(path, "UPDATE journal_line SET amount = 1;", "append-only")
  refused(path, "DELETE FROM journal_line;", "append-only")
  core.balance(ice, "Cash") |> should.equal(Ok(-5000))
}
