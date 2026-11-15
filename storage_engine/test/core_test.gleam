// The simplified core, proved from the smallest business upward.

import core.{Global, Local, Nothing, Refused, To, Value, Yes}
import gleam/option.{None, Some}
import gleeunit/should

@external(erlang, "file", "delete")
fn delete_file(path: String) -> Result(Nil, Nil)

fn fresh(name: String) -> String {
  let path = "/tmp/storage_engine_core_" <> name <> ".sqlite3"
  let _ = delete_file(path)
  let assert Ok(_) = core.install(path)
  path
}

fn business(db: String, name: String, user: String) -> core.Instance {
  let assert Ok(global) = core.open(db, "admin", core.global_business, "Actual")
  let assert Ok(_) = core.create_business(global, name, user)
  let assert Ok(inst) = core.open(db, user, name, "Actual")
  inst
}

pub fn the_ice_trader_needs_only_a_business_and_two_postings_test() {
  let db = fresh("ice")
  let ice = business(db, "Ice", "sam")

  // Nothing was copied in: the business has no accounts of its own yet.
  core.has_account(ice, "Cash") |> should.equal(Ok(False))

  let assert Ok(_) = core.post(ice, "BUY-1", None, [#("Purchases", 5000), #("Cash", -5000)], [])
  let assert Ok(_) = core.post(ice, "SALE-1", None, [#("Cash", 8000), #("Sales", -8000)], [])

  core.balance(ice, "Cash") |> should.equal(Ok(3000))
  core.balance(ice, "Purchases") |> should.equal(Ok(5000))
  core.balance(ice, "Sales") |> should.equal(Ok(-8000))

  // Accounts appear as they are first posted to, and no sooner.
  core.has_account(ice, "Cash") |> should.equal(Ok(True))
  core.has_account(ice, "Wages") |> should.equal(Ok(False))
  core.balance(ice, "Wages") |> should.equal(Ok(0))
}

pub fn the_global_business_never_trades_test() {
  let db = fresh("global")
  let assert Ok(global) = core.open(db, "admin", core.global_business, "Actual")
  let assert Error(Refused(_)) = core.post(global, "X-1", None, [#("Cash", 1), #("Sales", -1)], [])
}

pub fn only_the_global_business_creates_businesses_test() {
  let db = fresh("create_business")
  let ice = business(db, "Ice", "sam")
  let assert Error(Refused(_)) = core.create_business(ice, "Another", "pat")
}

pub fn a_user_of_one_business_cannot_open_another_test() {
  let db = fresh("users")
  let _ = business(db, "Ice", "sam")
  let _ = business(db, "Wine", "pat")
  let assert Error(core.NotFound(_)) = core.open(db, "sam", "Wine", "Actual")
}

pub fn an_entry_that_does_not_balance_writes_nothing_test() {
  let db = fresh("unbalanced")
  let ice = business(db, "Ice", "sam")
  let assert Error(Refused(_)) = core.post(ice, "BAD-1", None, [#("Purchases", 5000), #("Cash", -4000)], [])
  core.has_account(ice, "Cash") |> should.equal(Ok(False))
  core.has_account(ice, "Purchases") |> should.equal(Ok(False))
  // The reference is still free.
  let assert Ok(_) = core.post(ice, "BAD-1", None, [#("Purchases", 5000), #("Cash", -5000)], [])
}

pub fn a_reference_is_unique_within_a_ledger_not_across_businesses_test() {
  let db = fresh("references")
  let ice = business(db, "Ice", "sam")
  let wine = business(db, "Wine", "pat")
  let assert Ok(_) = core.post(ice, "SALE-1", None, [#("Cash", 100), #("Sales", -100)], [])
  let assert Error(Refused(_)) = core.post(ice, "SALE-1", None, [#("Cash", 100), #("Sales", -100)], [])
  let assert Ok(_) = core.post(wine, "SALE-1", None, [#("Cash", 700), #("Sales", -700)], [])
  // Each business has its own accounts.
  core.balance(ice, "Cash") |> should.equal(Ok(100))
  core.balance(wine, "Cash") |> should.equal(Ok(700))
}

pub fn a_locked_ledger_refuses_dates_on_or_before_the_lock_test() {
  let db = fresh("lock")
  let ice = business(db, "Ice", "sam")
  let assert Ok(_) = core.relate(ice, ice.ledger, "Locked Through", Value("2026-06-30"))
  let lines = [#("Cash", 100), #("Sales", -100)]
  let assert Error(Refused(_)) = core.post(ice, "A", Some("2026-06-30"), lines, [])
  let assert Ok(_) = core.post(ice, "B", Some("2026-07-01"), lines, [])
  // Clearing the relation reopens the period.
  let assert Ok(_) = core.relate(ice, ice.ledger, "Locked Through", Nothing)
  let assert Ok(_) = core.post(ice, "A", Some("2026-06-30"), lines, [])
}

pub fn a_relation_holds_a_value_another_entity_or_yes_test() {
  let db = fresh("relations")
  let ice = business(db, "Ice", "sam")
  let assert Ok(contacts) = core.create(ice, "Contacts", ice.business)
  let assert Ok(acme) = core.create(ice, "Acme", contacts)
  // create is get-or-create.
  core.create(ice, "Acme", contacts) |> should.equal(Ok(acme))

  let assert Ok(_) = core.relate(ice, acme, "Phone", Value("0412 345 678"))
  let assert Ok(Some(#(_, "0412 345 678"))) = core.related(ice, acme, "Phone")
  let assert Ok(_) = core.relate(ice, acme, "Phone", Value("0499 000 111"))
  let assert Ok(Some(#(_, "0499 000 111"))) = core.related(ice, acme, "Phone")

  let assert Ok(_) = core.relate(ice, acme, "Verified", Yes)
  let assert Ok(Some(#(_, "Active"))) = core.related(ice, acme, "Verified")

  let assert Ok(_) = core.relate(ice, acme, "Introduced By", To(ice.id))
  let assert Ok(Some(#(_, "sam"))) = core.related(ice, acme, "Introduced By")

  // Setting one relation leaves the others alone; clearing leaves no target.
  let assert Ok(_) = core.relate(ice, acme, "Verified", Nothing)
  core.related(ice, acme, "Verified") |> should.equal(Ok(None))
  let assert Ok(Some(#(_, "0499 000 111"))) = core.related(ice, acme, "Phone")
  // Going back to an earlier value is allowed.
  let assert Ok(_) = core.relate(ice, acme, "Phone", Value("0412 345 678"))
  let assert Ok(Some(#(_, "0412 345 678"))) = core.related(ice, acme, "Phone")
}

pub fn a_business_renames_its_own_instance_and_nobody_elses_test() {
  let db = fresh("rename")
  let ice = business(db, "Ice", "sam")
  let wine = business(db, "Wine", "pat")

  // Reading creates nothing: both see the global word.
  let assert Ok(Global(_)) = core.find(ice, "Vocabulary", "Profit and Loss Statement")
  core.label(ice, "Vocabulary", "Profit and Loss Statement") |> should.equal(Ok("Profit and Loss Statement"))

  let assert Ok(_) = core.rename(ice, "Vocabulary", "Profit and Loss Statement", "Income Statement")

  // Ice is still found by the global name, and shown under its own.
  let assert Ok(Local(_)) = core.find(ice, "Vocabulary", "Profit and Loss Statement")
  core.label(ice, "Vocabulary", "Profit and Loss Statement") |> should.equal(Ok("Income Statement"))
  let assert Ok(Local(_)) = core.find(ice, "Vocabulary", "Income Statement")

  // Wine is untouched.
  let assert Ok(Global(_)) = core.find(wine, "Vocabulary", "Profit and Loss Statement")
  core.label(wine, "Vocabulary", "Profit and Loss Statement") |> should.equal(Ok("Profit and Loss Statement"))
}

pub fn a_renamed_account_is_still_the_same_account_test() {
  let db = fresh("rename_account")
  let ice = business(db, "Ice", "sam")
  let assert Ok(_) = core.post(ice, "S-1", None, [#("Cash", 100), #("Sales", -100)], [])
  let assert Ok(accounts) = core.create(ice, "Accounts", ice.ledger)
  let assert Ok(asset) = core.create(ice, "Asset", accounts)
  let assert Ok(cash) = core.create(ice, "Cash", asset)
  let assert Ok(_) = core.relate(ice, cash, "Unit", Nothing)
  let _ = cash
  // Posting by either the global name or a local one reaches one account.
  let assert Ok(_) = core.post(ice, "S-2", None, [#("Cash", 50), #("Sales", -50)], [])
  core.balance(ice, "Cash") |> should.equal(Ok(150))
}

pub fn money_and_quantities_balance_separately_in_one_entry_test() {
  let db = fresh("units")
  let ice = business(db, "Ice", "sam")
  let assert Ok(on_hand) = core.create_account(ice, "Ice On Hand", "Inventory")
  let assert Ok(bought) = core.create_account(ice, "Ice Bought", "Inventory")
  let assert Ok(_) = core.relate(ice, on_hand, "Unit", Value("BAG"))
  let assert Ok(_) = core.relate(ice, bought, "Unit", Value("BAG"))

  // One event, one entry: the money balances and the bags balance.
  let assert Ok(_) =
    core.post(
      ice,
      "BUY-1",
      None,
      [#("Inventory", 5000), #("Cash", -5000), #("Ice On Hand", 40), #("Ice Bought", -40)],
      [#("Description", Value("40 bags of ice"))],
    )
  core.balance(ice, "Ice On Hand") |> should.equal(Ok(40))
  core.balance(ice, "Cash") |> should.equal(Ok(-5000))

  // Bags cannot be balanced with cents.
  let assert Error(Refused(_)) =
    core.post(ice, "BUY-2", None, [#("Ice On Hand", 10), #("Cash", -10)], [])
}

pub fn an_entry_carries_its_own_relations_test() {
  let db = fresh("entry_relations")
  let ice = business(db, "Ice", "sam")
  let assert Ok(entry) =
    core.post(
      ice,
      "SALE-9",
      Some("2026-11-14"),
      [#("Cash", 8000), #("Sales", -8000)],
      [#("Description", Value("Ice, Saturday market")), #("Recurrence", Value("weekly"))],
    )
  let assert Ok(Some(#(_, "Ice, Saturday market"))) = core.related(ice, entry, "Description")
  let assert Ok(Some(#(_, "weekly"))) = core.related(ice, entry, "Recurrence")
}

pub fn copy_makes_an_independent_instance_of_a_prototype_test() {
  let db = fresh("copy")
  let ice = business(db, "Ice", "sam")
  let assert Ok(prototypes) = core.create(ice, "Prototypes", ice.business)
  let assert Ok(esky) = core.create(ice, "Esky Pack", prototypes)
  let assert Ok(line) = core.create(ice, "Ice", esky)
  let assert Ok(_) = core.relate(ice, line, "Quantity", Value("2"))

  let assert Ok(job) = core.create(ice, "Job 1", ice.business)
  let assert Ok(_) = core.copy(ice, esky, job)
  let assert Ok(copied) = core.create(ice, "Ice", job)
  let assert Ok(Some(#(_, "2"))) = core.related(ice, copied, "Quantity")

  // Changing the prototype afterwards does not change the copy.
  let assert Ok(_) = core.relate(ice, line, "Quantity", Value("3"))
  let assert Ok(Some(#(_, "2"))) = core.related(ice, copied, "Quantity")
  let assert Ok(Some(#(_, "3"))) = core.related(ice, line, "Quantity")
}
