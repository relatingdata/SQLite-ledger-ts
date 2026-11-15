// The simplified middleware core: two stores, three globals, four calls.
//
//   Stores   entities; journal + journal_line        (core_schema.gleam)
//   Globals  Id, Business, Ledger, fixed when an Instance is opened and
//            never passed to a call
//   Calls    create, relate, copy, post
//
// Everything recorded about a thing is a relation: a child of the thing,
// named after the relation, whose relation column holds its target. The
// target is a child of its own holding a value, another entity, or the
// entity `Active` for yes.
//
// Global first, local on first use: a name is looked for in the business,
// then under Application. Reading creates nothing. The first write to a
// global thing makes a local instance related `Instance Of` to it.
//
// This module is self-contained and does not touch the older ledger/
// storage modules, which still serve sqlite-ledger-ts's entity driver.

import core_schema
import gleam/dict
import gleam/int
import gleam/list
import gleam/option.{type Option, None, Some}
import gleam/order
import gleam/result
import gleam/string
import sqlite_cli.{type Value}

pub type Error {
  SqlError(String)
  NotFound(String)
  Refused(String)
}

/// One storage engine instance. `id`, `business` and `ledger` are the three
/// globals. `ledger` is 0 in the Global Business, which has none.
pub type Instance {
  Instance(db: String, id: Int, business: Int, ledger: Int, global: Bool)
}

/// What a relation relates a thing to.
pub type Target {
  Value(String)
  To(Int)
  Yes
  Nothing
}

/// Where a name was found.
pub type Found {
  Local(Int)
  Global(Int)
}

pub const global_business = "Global Business"

// --- SQL plumbing ----------------------------------------------------------

fn rows(db: String, sql: String, params: List(Value)) -> Result(List(List(String)), Error) {
  case sqlite_cli.query(db, sqlite_cli.bind(sql, params)) {
    Ok(lines) -> Ok(list.map(lines, sqlite_cli.columns))
    Error(err) -> Error(SqlError(string.inspect(err)))
  }
}

fn run(db: String, sql: String, params: List(Value)) -> Result(Nil, Error) {
  case sqlite_cli.exec(db, sqlite_cli.bind(sql, params)) {
    Ok(_) -> Ok(Nil)
    Error(err) -> Error(SqlError(string.inspect(err)))
  }
}

fn one_int(found: List(List(String))) -> Option(Int) {
  case found {
    [[value, ..], ..] ->
      case int.parse(value) {
        Ok(n) -> Some(n)
        Error(_) -> None
      }
    _ -> None
  }
}

const sep = " || CHAR(31) || "

// --- entities --------------------------------------------------------------

fn new_entity(db: String, name: String, parent: Option(Int), by: Int) -> Result(Int, Error) {
  use found <- result.try(rows(
    db,
    "INSERT INTO entities (row_id, entity_id, name, parent_id, relation_id, created_by, created_at)
     SELECT n, n, ?, ?, NULL, ?, datetime('now')
     FROM (SELECT COALESCE(MAX(row_id), 0) + 1 AS n FROM entities);
     SELECT MAX(row_id) FROM entities;",
    [sqlite_cli.text(name), sqlite_cli.option_int(parent), sqlite_cli.int(by)],
  ))
  case one_int(found) {
    Some(id) -> Ok(id)
    None -> Error(SqlError("could not create " <> name))
  }
}

fn child(db: String, parent: Int, name: String) -> Result(Option(Int), Error) {
  use found <- result.try(rows(
    db,
    "SELECT id FROM current_entities WHERE parent_id = ? AND name = ?;",
    [sqlite_cli.int(parent), sqlite_cli.text(name)],
  ))
  Ok(one_int(found))
}

fn ensure(db: String, name: String, parent: Int, by: Int) -> Result(Int, Error) {
  use existing <- result.try(child(db, parent, name))
  case existing {
    Some(id) -> Ok(id)
    None -> new_entity(db, name, Some(parent), by)
  }
}

fn ensure_path(db: String, from: Int, path: List(String), by: Int) -> Result(Int, Error) {
  case path {
    [] -> Ok(from)
    [name, ..rest] -> {
      use id <- result.try(ensure(db, name, from, by))
      ensure_path(db, id, rest, by)
    }
  }
}

fn root(db: String) -> Result(Int, Error) {
  use found <- result.try(rows(
    db,
    "SELECT id FROM current_entities WHERE parent_id IS NULL AND name = 'Root';",
    [],
  ))
  case one_int(found) {
    Some(id) -> Ok(id)
    None -> Error(NotFound("Root (has install been run?)"))
  }
}

fn walk(db: String, from: Int, path: List(String)) -> Result(Int, Error) {
  case path {
    [] -> Ok(from)
    [name, ..rest] -> {
      use found <- result.try(child(db, from, name))
      case found {
        Some(id) -> walk(db, id, rest)
        None -> Error(NotFound(name))
      }
    }
  }
}

fn at(db: String, path: List(String)) -> Result(Int, Error) {
  use top <- result.try(root(db))
  walk(db, top, path)
}

/// A new version row for an existing entity, changing its relation column.
fn point(db: String, id: Int, target: Option(Int), by: Int) -> Result(Nil, Error) {
  run(
    db,
    "INSERT INTO entities (row_id, entity_id, name, parent_id, relation_id, created_by, created_at)
     SELECT (SELECT MAX(row_id) + 1 FROM entities), id, name, parent_id, ?, ?, datetime('now')
     FROM current_entities WHERE id = ?;",
    [sqlite_cli.option_int(target), sqlite_cli.int(by), sqlite_cli.int(id)],
  )
}

fn rename_entity(db: String, id: Int, name: String, by: Int) -> Result(Nil, Error) {
  run(
    db,
    "INSERT INTO entities (row_id, entity_id, name, parent_id, relation_id, created_by, created_at)
     SELECT (SELECT MAX(row_id) + 1 FROM entities), id, ?, parent_id, relation_id, ?, datetime('now')
     FROM current_entities WHERE id = ?;",
    [sqlite_cli.text(name), sqlite_cli.int(by), sqlite_cli.int(id)],
  )
}

fn name_and_parent(db: String, id: Int) -> Result(#(String, Option(Int)), Error) {
  use found <- result.try(rows(
    db,
    "SELECT name" <> sep <> "COALESCE(parent_id, '') FROM current_entities WHERE id = ?;",
    [sqlite_cli.int(id)],
  ))
  case found {
    [[name, parent]] -> Ok(#(name, option.from_result(int.parse(parent))))
    _ -> Error(NotFound("entity " <> int.to_string(id)))
  }
}

fn children(db: String, parent: Int) -> Result(List(#(Int, String, Option(Int))), Error) {
  use found <- result.try(rows(
    db,
    "SELECT id" <> sep <> "name" <> sep <> "COALESCE(relation_id, '')
     FROM current_entities WHERE parent_id = ? ORDER BY id;",
    [sqlite_cli.int(parent)],
  ))
  Ok(
    list.filter_map(found, fn(columns) {
      case columns {
        [id, name, relation] ->
          case int.parse(id) {
            Ok(n) -> Ok(#(n, name, option.from_result(int.parse(relation))))
            Error(_) -> Error(Nil)
          }
        _ -> Error(Nil)
      }
    }),
  )
}

const descendants = "WITH RECURSIVE d(id) AS (
  SELECT id FROM current_entities WHERE parent_id = ?
  UNION ALL
  SELECT e.id FROM current_entities e JOIN d ON e.parent_id = d.id
) "

fn descendant_named(db: String, under: Int, name: String) -> Result(Option(Int), Error) {
  use found <- result.try(rows(
    db,
    descendants
      <> "SELECT e.id FROM current_entities e JOIN d ON d.id = e.id WHERE e.name = ? ORDER BY e.id LIMIT 1;",
    [sqlite_cli.int(under), sqlite_cli.text(name)],
  ))
  Ok(one_int(found))
}

/// The entity under `under` that is `Instance Of` the given global entity,
/// whatever it has since been renamed to.
fn local_instance_of(db: String, under: Int, global_id: Int) -> Result(Option(Int), Error) {
  use found <- result.try(rows(
    db,
    descendants
      <> "SELECT e.id FROM current_entities e JOIN d ON d.id = e.id
          JOIN current_entities r ON r.parent_id = e.id AND r.name = 'Instance Of' AND r.relation_id = ?
          ORDER BY e.id LIMIT 1;",
    [sqlite_cli.int(under), sqlite_cli.int(global_id)],
  ))
  Ok(one_int(found))
}

// --- install and open ------------------------------------------------------

/// Creates the stores and the entities every installation starts with:
/// Application (the global prototypes and defaults), Active, and the Global
/// Business with its own Admin user and role. Safe to run again.
pub fn install(db: String) -> Result(Nil, Error) {
  use _ <- result.try(run(db, core_schema.sql, []))
  use existing <- result.try(rows(
    db,
    "SELECT id FROM current_entities WHERE parent_id IS NULL AND name = 'Root';",
    [],
  ))
  use top <- result.try(case one_int(existing) {
    Some(id) -> Ok(id)
    None -> new_entity(db, "Root", None, 0)
  })
  let paths = [
    ["Active"],
    ["Application", "Vocabulary", "Profit and Loss Statement"],
    ["Application", "Vocabulary", "Balance Sheet"],
    ["Application", "Menus"],
    ["Application", "Roles", "Admin"],
    ["Application", "Hierarchies"],
    ["Application", "Cartesian Products"],
    ["Application", "Charts of Accounts", "Standard", "Asset", "Cash"],
    ["Application", "Charts of Accounts", "Standard", "Asset", "Accounts Receivable"],
    ["Application", "Charts of Accounts", "Standard", "Asset", "Inventory"],
    ["Application", "Charts of Accounts", "Standard", "Liability", "Accounts Payable"],
    ["Application", "Charts of Accounts", "Standard", "Equity", "Retained Earnings"],
    ["Application", "Charts of Accounts", "Standard", "Income", "Sales"],
    ["Application", "Charts of Accounts", "Standard", "Expense", "Purchases"],
    ["Application", "Charts of Accounts", "Standard", "Expense", "Wages"],
    ["Businesses", global_business, "Users", "admin"],
    ["Businesses", global_business, "Roles", "Admin"],
  ]
  list.try_each(paths, fn(path) { ensure_path(db, top, path, 0) |> result.map(fn(_) { Nil }) })
}

/// Creates an instance. The user must be a user of the business. The ledger
/// is created if the business does not have it yet; most businesses only
/// ever open `Actual`.
pub fn open(db: String, user: String, business: String, ledger: String) -> Result(Instance, Error) {
  use business_id <- result.try(at(db, ["Businesses", business]))
  use user_id <- result.try(
    walk(db, business_id, ["Users", user])
    |> result.replace_error(NotFound("user " <> user <> " of " <> business)),
  )
  case business == global_business {
    True -> Ok(Instance(db, user_id, business_id, 0, True))
    False -> {
      use ledger_id <- result.try(ensure_path(db, business_id, ["Ledgers", ledger], user_id))
      Ok(Instance(db, user_id, business_id, ledger_id, False))
    }
  }
}

/// Only the Global Business can create a business. Nothing is copied into
/// the new one: it gets a name and its first user.
pub fn create_business(inst: Instance, name: String, first_user: String) -> Result(Int, Error) {
  case inst.global {
    False -> Error(Refused("a business can only be created from the Global Business"))
    True -> {
      use businesses <- result.try(at(inst.db, ["Businesses"]))
      use existing <- result.try(child(inst.db, businesses, name))
      case existing {
        Some(_) -> Error(Refused("a business named " <> name <> " already exists"))
        None -> {
          use business_id <- result.try(new_entity(inst.db, name, Some(businesses), inst.id))
          use _ <- result.try(ensure_path(inst.db, business_id, ["Users", first_user], inst.id))
          Ok(business_id)
        }
      }
    }
  }
}

// --- the four calls --------------------------------------------------------

/// Returns the entity of that name under that parent, creating it if it is
/// not there.
pub fn create(inst: Instance, name: String, parent: Int) -> Result(Int, Error) {
  ensure(inst.db, name, parent, inst.id)
}

/// Records one relation of a thing. No other relation is touched.
pub fn relate(inst: Instance, thing: Int, relation: String, target: Target) -> Result(Nil, Error) {
  use relation_id <- result.try(ensure(inst.db, relation, thing, inst.id))
  case target {
    Value(text) -> {
      use value_id <- result.try(ensure(inst.db, text, relation_id, inst.id))
      point(inst.db, relation_id, Some(value_id), inst.id)
    }
    To(id) -> point(inst.db, relation_id, Some(id), inst.id)
    Yes -> {
      use active <- result.try(at(inst.db, ["Active"]))
      point(inst.db, relation_id, Some(active), inst.id)
    }
    Nothing -> point(inst.db, relation_id, None, inst.id)
  }
}

/// What a relation of a thing currently relates it to: the target's id and
/// name, or None when the relation is absent or cleared.
pub fn related(inst: Instance, thing: Int, relation: String) -> Result(Option(#(Int, String)), Error) {
  use found <- result.try(rows(
    inst.db,
    "SELECT t.id" <> sep <> "t.name
     FROM current_entities r JOIN current_entities t ON t.id = r.relation_id
     WHERE r.parent_id = ? AND r.name = ?;",
    [sqlite_cli.int(thing), sqlite_cli.text(relation)],
  ))
  case found {
    [[id, name]] ->
      case int.parse(id) {
        Ok(n) -> Ok(Some(#(n, name)))
        Error(_) -> Ok(None)
      }
    _ -> Ok(None)
  }
}

/// Copies a prototype's children under another entity. The copy is
/// independent of the prototype from then on.
pub fn copy(inst: Instance, prototype: Int, under: Int) -> Result(Nil, Error) {
  use kids <- result.try(children(inst.db, prototype))
  list.try_each(kids, fn(kid) {
    let #(kid_id, name, relation) = kid
    use copy_id <- result.try(ensure(inst.db, name, under, inst.id))
    use _ <- result.try(copy(inst, kid_id, copy_id))
    case relation {
      None -> Ok(Nil)
      Some(target) -> {
        // A relation to one of the prototype's own value children must point
        // at the copied child, not back into the prototype.
        use #(target_name, target_parent) <- result.try(name_and_parent(inst.db, target))
        case target_parent == Some(kid_id) {
          True -> {
            use copied_target <- result.try(ensure(inst.db, target_name, copy_id, inst.id))
            point(inst.db, copy_id, Some(copied_target), inst.id)
          }
          False -> point(inst.db, copy_id, Some(target), inst.id)
        }
      }
    }
  })
}

// --- global first, local on first use -------------------------------------

fn resolve(db: String, local_root: Option(Int), global_root: Int, name: String) -> Result(Found, Error) {
  use local <- result.try(case local_root {
    Some(under) -> descendant_named(db, under, name)
    None -> Ok(None)
  })
  case local {
    Some(id) -> Ok(Local(id))
    None -> {
      use global <- result.try(descendant_named(db, global_root, name))
      case global, local_root {
        None, _ -> Error(NotFound(name))
        Some(global_id), None -> Ok(Global(global_id))
        Some(global_id), Some(under) -> {
          // The business may hold it under another name.
          use renamed <- result.try(local_instance_of(db, under, global_id))
          case renamed {
            Some(id) -> Ok(Local(id))
            None -> Ok(Global(global_id))
          }
        }
      }
    }
  }
}

/// The global entity and the ones above it, up to but not including
/// `global_root`, topmost first.
fn chain(db: String, global_id: Int, global_root: Int, below: List(#(Int, String))) -> Result(List(#(Int, String)), Error) {
  case global_id == global_root {
    True -> Ok(below)
    False -> {
      use #(name, parent) <- result.try(name_and_parent(db, global_id))
      case parent {
        Some(parent_id) -> chain(db, parent_id, global_root, [#(global_id, name), ..below])
        None -> Error(NotFound("the global root above " <> name))
      }
    }
  }
}

/// Makes the local instance of a global entity, and of the entities above
/// it, so that it sits in the same place locally as it does globally.
fn instantiate(inst: Instance, global_id: Int, local_root: Int, global_root: Int) -> Result(Int, Error) {
  use steps <- result.try(chain(inst.db, global_id, global_root, []))
  list.try_fold(steps, local_root, fn(parent, step) {
    let #(step_id, step_name) = step
    use existing <- result.try(local_instance_of(inst.db, local_root, step_id))
    case existing {
      Some(id) -> Ok(id)
      None -> {
        use id <- result.try(ensure(inst.db, step_name, parent, inst.id))
        use _ <- result.try(relate(inst, id, "Instance Of", To(step_id)))
        Ok(id)
      }
    }
  })
}

/// Looks a name up in one of the business's branches (`Vocabulary`, `Menus`,
/// `Roles`, ...), local first, then under Application. Creates nothing.
pub fn find(inst: Instance, branch: String, name: String) -> Result(Found, Error) {
  use local_root <- result.try(child(inst.db, inst.business, branch))
  use global_root <- result.try(at(inst.db, ["Application", branch]))
  resolve(inst.db, local_root, global_root, name)
}

/// The name the business shows for something in a branch: its own if it has
/// a local instance, otherwise the global one.
pub fn label(inst: Instance, branch: String, name: String) -> Result(String, Error) {
  use found <- result.try(find(inst, branch, name))
  let id = case found {
    Local(id) -> id
    Global(id) -> id
  }
  use #(shown, _) <- result.try(name_and_parent(inst.db, id))
  Ok(shown)
}

/// The business's own instance of something in a branch, made on this first
/// write if it only existed globally.
pub fn localise(inst: Instance, branch: String, name: String) -> Result(Int, Error) {
  use found <- result.try(find(inst, branch, name))
  case found {
    Local(id) -> Ok(id)
    Global(global_id) -> {
      use local_root <- result.try(ensure(inst.db, branch, inst.business, inst.id))
      use global_root <- result.try(at(inst.db, ["Application", branch]))
      instantiate(inst, global_id, local_root, global_root)
    }
  }
}

/// Renames the business's own instance. Every other business, and the
/// global entity, keep their names.
pub fn rename(inst: Instance, branch: String, name: String, new_name: String) -> Result(Nil, Error) {
  use id <- result.try(localise(inst, branch, name))
  rename_entity(inst.db, id, new_name, inst.id)
}

// --- accounts and posting --------------------------------------------------

fn chart_root(inst: Instance) -> Result(Int, Error) {
  use chosen <- result.try(related(inst, inst.business, "Chart of Accounts"))
  let chart = case chosen {
    Some(#(_, name)) -> name
    None -> "Standard"
  }
  at(inst.db, ["Application", "Charts of Accounts", chart])
}

fn find_account(inst: Instance, name: String) -> Result(Found, Error) {
  use accounts <- result.try(child(inst.db, inst.ledger, "Accounts"))
  use global_root <- result.try(chart_root(inst))
  resolve(inst.db, accounts, global_root, name)
  |> result.replace_error(NotFound("account " <> name))
}

/// An account's unit: its own, else its prototype's, else money ("").
fn unit_of(inst: Instance, found: Found) -> Result(String, Error) {
  let id = case found {
    Local(id) -> id
    Global(id) -> id
  }
  use own <- result.try(related(inst, id, "Unit"))
  case own, found {
    Some(#(_, unit)), _ -> Ok(unit)
    None, Global(_) -> Ok("")
    None, Local(_) -> {
      use prototype <- result.try(related(inst, id, "Instance Of"))
      case prototype {
        None -> Ok("")
        Some(#(prototype_id, _)) -> {
          use inherited <- result.try(related(inst, prototype_id, "Unit"))
          case inherited {
            Some(#(_, unit)) -> Ok(unit)
            None -> Ok("")
          }
        }
      }
    }
  }
}

fn today(db: String) -> Result(String, Error) {
  use found <- result.try(rows(db, "SELECT date('now');", []))
  case found {
    [[date]] -> Ok(date)
    _ -> Error(SqlError("could not read today's date"))
  }
}

/// Creates a business's own account that has no global counterpart, under a
/// named account of the ledger's chart (which is instantiated if need be).
pub fn create_account(inst: Instance, name: String, under: String) -> Result(Int, Error) {
  case inst.global {
    True -> Error(Refused("the Global Business has no accounts"))
    False -> {
      use parent <- result.try(account_for_writing(inst, under))
      ensure(inst.db, name, parent, inst.id)
    }
  }
}

fn account_for_writing(inst: Instance, name: String) -> Result(Int, Error) {
  use found <- result.try(find_account(inst, name))
  case found {
    Local(id) -> Ok(id)
    Global(global_id) -> {
      use accounts <- result.try(ensure(inst.db, "Accounts", inst.ledger, inst.id))
      use global_root <- result.try(chart_root(inst))
      instantiate(inst, global_id, accounts, global_root)
    }
  }
}

/// Posts one entry. Each line is an account name and an amount: positive is
/// a debit, negative a credit. The date is today when left out. The
/// relations (description, counterparty, the order delivered, recurrence)
/// are recorded on the entry entity. Returns the entry's id.
pub fn post(
  inst: Instance,
  reference: String,
  date: Option(String),
  lines: List(#(String, Int)),
  relations: List(#(String, Target)),
) -> Result(Int, Error) {
  use _ <- result.try(case inst.global, lines {
    True, _ -> Error(Refused("the Global Business never trades"))
    False, [] -> Error(Refused("an entry needs at least one line"))
    False, _ -> Ok(Nil)
  })
  use on <- result.try(case date {
    Some(given) -> Ok(given)
    None -> today(inst.db)
  })
  use locked <- result.try(related(inst, inst.ledger, "Locked Through"))
  use _ <- result.try(case locked {
    Some(#(_, through)) ->
      case string.compare(on, through) {
        order.Gt -> Ok(Nil)
        _ -> Error(Refused("the ledger is locked through " <> through))
      }
    None -> Ok(Nil)
  })

  // Everything is checked before anything is written.
  use found <- result.try(list.try_map(lines, fn(line) {
    use account <- result.try(find_account(inst, line.0))
    use unit <- result.try(unit_of(inst, account))
    Ok(#(line.0, line.1, unit))
  }))
  let totals =
    list.fold(found, dict.new(), fn(sums, line) {
      let #(_, amount, unit) = line
      dict.insert(sums, unit, amount + result.unwrap(dict.get(sums, unit), 0))
    })
  use _ <- result.try(case list.all(dict.values(totals), fn(sum) { sum == 0 }) {
    True -> Ok(Nil)
    False -> Error(Refused("the lines do not add up to zero within each unit"))
  })
  use entries <- result.try(ensure(inst.db, "Entries", inst.ledger, inst.id))
  use taken <- result.try(child(inst.db, entries, reference))
  use _ <- result.try(case taken {
    Some(_) -> Error(Refused("an entry named " <> reference <> " already exists in this ledger"))
    None -> Ok(Nil)
  })

  // Now write: the accounts first used here, the entry, then its amounts.
  use accounts <- result.try(list.try_map(found, fn(line) {
    use id <- result.try(account_for_writing(inst, line.0))
    Ok(#(id, line.1))
  }))
  use entry <- result.try(new_entity(inst.db, reference, Some(entries), inst.id))
  use _ <- result.try(list.try_each(relations, fn(relation) {
    relate(inst, entry, relation.0, relation.1)
  }))
  let line_sql =
    accounts
    |> list.map(fn(line) {
      sqlite_cli.bind(
        "INSERT INTO journal_line (entry_id, account_id, amount) VALUES (?, ?, ?);",
        [sqlite_cli.int(entry), sqlite_cli.int(line.0), sqlite_cli.int(line.1)],
      )
    })
    |> string.join("\n")
  use _ <- result.try(run(
    inst.db,
    "BEGIN;\nINSERT INTO journal (entry_id, date) VALUES (?, ?);\n" <> line_sql <> "\nCOMMIT;",
    [sqlite_cli.int(entry), sqlite_cli.text(on)],
  ))
  Ok(entry)
}

/// The sum of everything posted to an account of the instance's ledger.
/// An account the business has never posted to has a balance of zero.
pub fn balance(inst: Instance, account: String) -> Result(Int, Error) {
  use found <- result.try(find_account(inst, account))
  case found {
    Global(_) -> Ok(0)
    Local(id) -> {
      use sums <- result.try(rows(
        inst.db,
        "SELECT COALESCE(SUM(amount), 0) FROM journal_line WHERE account_id = ?;",
        [sqlite_cli.int(id)],
      ))
      Ok(option.unwrap(one_int(sums), 0))
    }
  }
}

/// Whether the business has its own instance of an account yet.
pub fn has_account(inst: Instance, account: String) -> Result(Bool, Error) {
  use found <- result.try(find_account(inst, account))
  case found {
    Local(_) -> Ok(True)
    Global(_) -> Ok(False)
  }
}
