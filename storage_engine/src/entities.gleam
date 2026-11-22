// Pure rules for the `entities` table — no I/O, no database. This is
// where "is this write allowed at all" lives; the actual INSERT SQL
// (storage.gleam) is dumb and only runs once this says Ok.
//
// Mirrors backend/schema/00-core.sql's entities_name_unique trigger
// from sqlite-ledger-ts, exactly: among the *current* rows (one per
// entity_id — the caller resolves that via the current_entities view
// the same way SQLite's own view does), no other, different entity
// may already hold this name under this parent. An entity's own
// superseded (renamed-away-from) row keeps its old name forever and
// is never checked against this rule again.

import gleam/list
import gleam/option.{type Option}

pub type EntityId =
  Int

/// One version of one real-world entity, as read from
/// current_entities — never a raw entities row (which may be stale).
pub type EntityRow {
  EntityRow(id: EntityId, name: String, parent_id: Option(EntityId), relation_id: Option(EntityId))
}

pub type EntityError {
  NameTaken
}

/// Validates a create, rename, or reparent before the caller inserts
/// it. A create passes a fresh id nothing else in `current` can
/// equal; a rename/reparent passes the entity's own existing id, so
/// it never collides with its own current row.
pub fn validate_write(
  current: List(EntityRow),
  id: EntityId,
  parent_id: Option(EntityId),
  name: String,
) -> Result(Nil, EntityError) {
  let taken =
    current
    |> list.any(fn(row) {
      row.parent_id == parent_id && row.name == name && row.id != id
    })

  case taken && !is_language(current, parent_id) {
    True -> Error(NameTaken)
    False -> Ok(Nil)
  }
}

/// Whether `parent_id` is a language (a child of `Languages`): its
/// children are translations, and two concepts may share a word in one
/// language, so names under it need not be unique.
fn is_language(current: List(EntityRow), parent_id: Option(EntityId)) -> Bool {
  case parent_id {
    option.None -> False
    option.Some(pid) ->
      case list.find(current, fn(row) { row.id == pid }) {
        Error(_) -> False
        Ok(lang) ->
          case lang.parent_id {
            option.None -> False
            option.Some(gid) ->
              list.any(current, fn(row) { row.id == gid && row.name == "Languages" })
          }
      }
  }
}
