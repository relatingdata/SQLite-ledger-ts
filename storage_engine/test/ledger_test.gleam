// End-to-end tests against the real actor and a real, on-disk SQLite
// file (never :memory: — a fresh temp file per test, so the guard
// triggers and transactions are exercised exactly as they'd run in
// production, not against a connection some other test already
// shaped).

import accounting.{Line}
import entities
import gleam/option.{None}
import gleeunit/should
import ledger
import schema_sql
import storage

@external(erlang, "file", "delete")
fn delete_file(path: String) -> Result(Nil, Nil)

fn fresh_ledger(name: String) -> ledger.Ledger {
  let path = "/tmp/storage_engine_test_" <> name <> ".sqlite3"
  let _ = delete_file(path)
  let assert Ok(l) = ledger.start(path, schema_sql.sql)
  l
}

pub fn create_and_list_entities_test() {
  let l = fresh_ledger("create_list")

  let assert Ok(cash_id) = ledger.create_entity(l, "Cash", None, 1)
  let assert Ok(sales_id) = ledger.create_entity(l, "Sales", None, 1)

  let assert Ok(current) = ledger.list_current_entities(l)
  current
  |> should.equal([
    entities.EntityRow(cash_id, "Cash", None, None),
    entities.EntityRow(sales_id, "Sales", None, None),
  ])
}

pub fn creating_a_duplicate_name_under_the_same_parent_is_rejected_test() {
  let l = fresh_ledger("dup_name")

  let assert Ok(_) = ledger.create_entity(l, "Cash", None, 1)
  ledger.create_entity(l, "Cash", None, 1)
  |> should.equal(Error(storage.NameTaken))
}

pub fn renaming_carries_the_same_entity_id_forward_test() {
  let l = fresh_ledger("rename")

  let assert Ok(id) = ledger.create_entity(l, "Cash", None, 1)
  let assert Ok(_) = ledger.rename_entity(l, id, "Cash and Bank", None, 1)

  let assert Ok(current) = ledger.list_current_entities(l)
  current |> should.equal([entities.EntityRow(id, "Cash and Bank", None, None)])
}

pub fn posting_a_balanced_entry_vivifies_accounts_and_updates_balances_test() {
  let l = fresh_ledger("post_balanced")

  let assert Ok(cash) = ledger.create_entity(l, "Cash", None, 1)
  let assert Ok(sales) = ledger.create_entity(l, "Sales", None, 1)

  // Neither has an account row yet - get_balance defaults to 0.
  ledger.get_balance(l, cash) |> should.equal(Ok(0))

  let assert Ok(_) =
    ledger.post_journal_entry(l, "INV-1", "A sale", "2026-01-01", 1, [
      Line(cash, 500),
      Line(sales, -500),
    ])

  ledger.get_balance(l, cash) |> should.equal(Ok(500))
  ledger.get_balance(l, sales) |> should.equal(Ok(-500))
}

pub fn posting_an_unbalanced_entry_writes_nothing_test() {
  let l = fresh_ledger("post_unbalanced")

  let assert Ok(cash) = ledger.create_entity(l, "Cash", None, 1)
  let assert Ok(sales) = ledger.create_entity(l, "Sales", None, 1)

  ledger.post_journal_entry(l, "INV-BAD", "Broken", "2026-01-01", 1, [
    Line(cash, 500),
    Line(sales, -400),
  ])
  |> should.equal(
    Error(storage.PostingError(accounting.Unbalanced(None, 100))),
  )

  // Nothing was written at all - no account rows were even vivified.
  ledger.get_balance(l, cash) |> should.equal(Ok(0))
  ledger.get_balance(l, sales) |> should.equal(Ok(0))
}

pub fn reversing_a_posted_entry_undoes_its_balances_and_is_write_once_test() {
  let l = fresh_ledger("reverse")

  let assert Ok(cash) = ledger.create_entity(l, "Cash", None, 1)
  let assert Ok(sales) = ledger.create_entity(l, "Sales", None, 1)

  let assert Ok(posted) =
    ledger.post_journal_entry(l, "INV-2", "A sale", "2026-01-01", 1, [
      Line(cash, 500),
      Line(sales, -500),
    ])

  let assert Ok(_) = ledger.reverse_journal_entry(l, posted.id, "2026-01-02", 1)

  ledger.get_balance(l, cash) |> should.equal(Ok(0))
  ledger.get_balance(l, sales) |> should.equal(Ok(0))

  // Reversing the SAME entry a second time must be rejected by the
  // write-once trigger on journal.reversal_of, not silently succeed
  // and double-undo the balances.
  let second = ledger.reverse_journal_entry(l, posted.id, "2026-01-03", 1)
  case second {
    Error(_) -> Nil
    Ok(_) -> panic as "expected the second reversal to be rejected"
  }

  ledger.get_balance(l, cash) |> should.equal(Ok(0))
  ledger.get_balance(l, sales) |> should.equal(Ok(0))
}
