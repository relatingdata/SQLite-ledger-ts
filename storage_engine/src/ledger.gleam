// The ledger actor: the ONE process that ever calls into storage.gleam
// for a given db_path. Every public function here sends a message
// and blocks for the reply (process.call) — since the actor handles
// one message at a time off its own mailbox, two callers can never
// race on the same database. There is no lock anywhere in this
// module; the mailbox is the lock.
//
// If the actor crashes, its supervisor restarts it fresh — "let it
// crash" rather than defensively guarding every call site.

import accounting.{type Line}
import entities.{type EntityId}
import gleam/erlang/process.{type Subject}
import gleam/option.{type Option}
import gleam/otp/actor
import storage.{type Error}

pub opaque type Message {
  CreateEntity(
    reply_to: Subject(Result(EntityId, Error)),
    name: String,
    parent_id: Option(EntityId),
    created_by: Int,
  )
  RenameEntity(
    reply_to: Subject(Result(Nil, Error)),
    id: EntityId,
    name: String,
    parent_id: Option(EntityId),
    created_by: Int,
  )
  ListCurrentEntities(reply_to: Subject(Result(List(entities.EntityRow), Error)))
  GetEntity(reply_to: Subject(Result(entities.EntityRow, Error)), id: EntityId)
  GetChildren(reply_to: Subject(Result(List(entities.EntityRow), Error)), parent_id: Option(EntityId))
  GetByNameUnder(
    reply_to: Subject(Result(Option(entities.EntityRow), Error)),
    parent_id: Option(EntityId),
    name: String,
  )
  GetByName(reply_to: Subject(Result(List(entities.EntityRow), Error)), name: String)
  RelateEntity(
    reply_to: Subject(Result(Nil, Error)),
    id: EntityId,
    target_id: Option(EntityId),
    created_by: Int,
  )
  GetBalance(reply_to: Subject(Result(Int, Error)), account_id: EntityId)
  PostJournalEntry(
    reply_to: Subject(Result(storage.PostedEntry, Error)),
    reference: String,
    description: String,
    transdate: String,
    user_id: Int,
    lines: List(Line),
  )
  ReverseJournalEntry(
    reply_to: Subject(Result(storage.PostedEntry, Error)),
    journal_id: Int,
    transdate: String,
    user_id: Int,
  )
}

pub type Ledger =
  Subject(Message)

type State {
  State(db_path: String)
}

fn handle_message(state: State, message: Message) -> actor.Next(State, Message) {
  case message {
    CreateEntity(reply_to, name, parent_id, created_by) -> {
      process.send(reply_to, storage.create_entity(state.db_path, name, parent_id, created_by))
      actor.continue(state)
    }
    RenameEntity(reply_to, id, name, parent_id, created_by) -> {
      process.send(
        reply_to,
        storage.rename_entity(state.db_path, id, name, parent_id, created_by),
      )
      actor.continue(state)
    }
    ListCurrentEntities(reply_to) -> {
      process.send(reply_to, storage.list_current_entities(state.db_path))
      actor.continue(state)
    }
    GetEntity(reply_to, id) -> {
      process.send(reply_to, storage.get_entity(state.db_path, id))
      actor.continue(state)
    }
    GetChildren(reply_to, parent_id) -> {
      process.send(reply_to, storage.get_children(state.db_path, parent_id))
      actor.continue(state)
    }
    GetByNameUnder(reply_to, parent_id, name) -> {
      process.send(reply_to, storage.get_by_name_under(state.db_path, parent_id, name))
      actor.continue(state)
    }
    GetByName(reply_to, name) -> {
      process.send(reply_to, storage.get_by_name(state.db_path, name))
      actor.continue(state)
    }
    RelateEntity(reply_to, id, target_id, created_by) -> {
      process.send(reply_to, storage.relate_entity(state.db_path, id, target_id, created_by))
      actor.continue(state)
    }
    GetBalance(reply_to, account_id) -> {
      process.send(reply_to, storage.get_balance(state.db_path, account_id))
      actor.continue(state)
    }
    PostJournalEntry(reply_to, reference, description, transdate, user_id, lines) -> {
      process.send(
        reply_to,
        storage.post_journal_entry(state.db_path, reference, description, transdate, user_id, lines),
      )
      actor.continue(state)
    }
    ReverseJournalEntry(reply_to, journal_id, transdate, user_id) -> {
      process.send(
        reply_to,
        storage.reverse_journal_entry(state.db_path, journal_id, transdate, user_id),
      )
      actor.continue(state)
    }
  }
}

/// Starts the actor against the real SQLite file at `path`, applying
/// the schema first (idempotent — every statement in it is CREATE
/// TABLE/TRIGGER/VIEW IF NOT EXISTS).
pub fn start(path: String, schema_sql: String) -> Result(Ledger, actor.StartError) {
  case storage.apply_schema(path, schema_sql) {
    Ok(_) ->
      actor.new(State(path))
      |> actor.on_message(handle_message)
      |> actor.start
      |> fn(result) {
        case result {
          Ok(started) -> Ok(started.data)
          Error(err) -> Error(err)
        }
      }
    Error(_) -> Error(actor.InitTimeout)
  }
}

// 15s, not 5s: confirmed directly, the hard way, running the real
// tutorial e2e suite against the real, shared entities.sqlite —
// db.ts's better-sqlite3 connection and this actor's own sqlite3 CLI
// subprocess calls are two separate SQLite clients against the SAME
// file, and under real write contention a single call can need its
// own full sqlite-level lock wait (.timeout 5000 in sqlite_cli_ffi.erl)
// before it even starts running. A process.call timeout equal to that
// busy-wait window races it — whichever fires first "wins," and losing
// that race crashes the caller (`let assert` on `process.perform_call`
// in http_api.gleam) with the write possibly still in flight
// underneath. 15s gives a full busy-wait cycle real room to resolve on
// its own first.
pub fn create_entity(
  ledger: Ledger,
  name: String,
  parent_id: Option(EntityId),
  created_by: Int,
) -> Result(EntityId, Error) {
  process.call(ledger, 25_000, CreateEntity(_, name, parent_id, created_by))
}

pub fn rename_entity(
  ledger: Ledger,
  id: EntityId,
  name: String,
  parent_id: Option(EntityId),
  created_by: Int,
) -> Result(Nil, Error) {
  process.call(ledger, 25_000, RenameEntity(_, id, name, parent_id, created_by))
}

pub fn list_current_entities(ledger: Ledger) -> Result(List(entities.EntityRow), Error) {
  process.call(ledger, 25_000, ListCurrentEntities(_))
}

pub fn get_entity(ledger: Ledger, id: EntityId) -> Result(entities.EntityRow, Error) {
  process.call(ledger, 25_000, GetEntity(_, id))
}

pub fn get_children(ledger: Ledger, parent_id: Option(EntityId)) -> Result(List(entities.EntityRow), Error) {
  process.call(ledger, 25_000, GetChildren(_, parent_id))
}

pub fn get_by_name_under(
  ledger: Ledger,
  parent_id: Option(EntityId),
  name: String,
) -> Result(Option(entities.EntityRow), Error) {
  process.call(ledger, 25_000, GetByNameUnder(_, parent_id, name))
}

pub fn get_by_name(ledger: Ledger, name: String) -> Result(List(entities.EntityRow), Error) {
  process.call(ledger, 25_000, GetByName(_, name))
}

pub fn relate_entity(
  ledger: Ledger,
  id: EntityId,
  target_id: Option(EntityId),
  created_by: Int,
) -> Result(Nil, Error) {
  process.call(ledger, 25_000, RelateEntity(_, id, target_id, created_by))
}

pub fn get_balance(ledger: Ledger, account_id: EntityId) -> Result(Int, Error) {
  process.call(ledger, 25_000, GetBalance(_, account_id))
}

pub fn post_journal_entry(
  ledger: Ledger,
  reference: String,
  description: String,
  transdate: String,
  user_id: Int,
  lines: List(Line),
) -> Result(storage.PostedEntry, Error) {
  process.call(ledger, 25_000, PostJournalEntry(_, reference, description, transdate, user_id, lines))
}

pub fn reverse_journal_entry(
  ledger: Ledger,
  journal_id: Int,
  transdate: String,
  user_id: Int,
) -> Result(storage.PostedEntry, Error) {
  process.call(ledger, 25_000, ReverseJournalEntry(_, journal_id, transdate, user_id))
}
