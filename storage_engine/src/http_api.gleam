// The HTTP surface. Every handler does the same three things:
// decode the JSON body (json_lite — gleam_json wasn't vendored, see
// its own header comment), call the ledger actor (the only thing
// that ever touches SQL), and encode the result. No business rule
// lives in this file; it is a thin, dumb translation layer in front
// of the actor.

import accounting.{type Line, Line}
import entities.{type EntityRow}
import gleam/int
import gleam/list
import gleam/option.{type Option, None, Some}
import gleam/string
import http_server.{type Request, type Response, Response}
import json_lite.{JArray, JInt, JNull, JObject, JString}
import ledger.{type Ledger}
import storage.{type Error}

pub fn handle_request(req: Request, ledger: Ledger) -> Response {
  let segments = path_segments(req.path)
  case segments, req.method {
    ["entities"], "GET" -> list_entities(ledger)
    ["entities"], "POST" -> create_entity(req, ledger)
    ["entities", "lookup"], "POST" -> lookup_entity(req, ledger)
    ["entities", id], "GET" -> get_entity(ledger, id)
    ["entities", id, "children"], "GET" -> get_children(ledger, id)
    ["entities", id, "rename"], "POST" -> rename_entity(req, ledger, id)
    ["entities", id, "relate"], "POST" -> relate_entity(req, ledger, id)
    ["accounts", id, "balance"], "GET" -> get_balance(ledger, id)
    ["journal"], "POST" -> post_journal(req, ledger)
    ["journal", id, "reverse"], "POST" -> reverse_journal(req, ledger, id)
    _, _ -> json_error(404, "not found")
  }
}

fn path_segments(path: String) -> List(String) {
  path
  |> string.split("/")
  |> list.filter(fn(s) { s != "" })
}

fn error_response(err: Error) -> Response {
  case err {
    storage.NameTaken ->
      json_error(409, "a different, live entity already has this name under this parent")
    storage.NotFound(message) -> json_error(404, message)
    storage.PostingError(accounting.NoLines) ->
      json_error(422, "an entry needs at least one line")
    storage.PostingError(accounting.Unbalanced(currency, off_by)) ->
      json_error(
        422,
        "does not balance"
          <> case currency {
          Some(c) -> " in " <> c
          None -> ""
        }
          <> " (off by "
          <> int.to_string(off_by)
          <> " minor units)",
      )
    storage.SqlError(sqlite_cli_err) -> json_error(500, string.inspect(sqlite_cli_err))
  }
}

fn json_error(status: Int, message: String) -> Response {
  Response(status, json_lite.encode(JObject([#("error", JString(message))])))
}

fn json_response(status: Int, value: json_lite.Json) -> Response {
  Response(status, json_lite.encode(value))
}

fn parse_id(id: String) -> Result(Int, Response) {
  case int.parse(id) {
    Ok(n) -> Ok(n)
    Error(_) -> Error(json_error(400, "invalid id: " <> id))
  }
}

fn parse_body(req: Request) -> Result(json_lite.Json, Response) {
  case json_lite.parse(req.body) {
    Ok(value) -> Ok(value)
    Error(_) -> Error(json_error(400, "invalid JSON body"))
  }
}

fn required_string(body: json_lite.Json, name: String) -> Result(String, Nil) {
  json_lite.field(body, name) |> result_try(json_lite.as_string)
}

fn optional_int(body: json_lite.Json, name: String, default: Int) -> Int {
  case json_lite.field(body, name) {
    Ok(value) ->
      case json_lite.as_int(value) {
        Ok(n) -> n
        Error(_) -> default
      }
    Error(_) -> default
  }
}

fn optional_parent_id(body: json_lite.Json, name: String) -> Option(Int) {
  case json_lite.field(body, name) {
    Ok(value) ->
      case json_lite.is_null(value) {
        True -> None
        False ->
          case json_lite.as_int(value) {
            Ok(n) -> Some(n)
            Error(_) -> None
          }
      }
    Error(_) -> None
  }
}

fn result_try(result: Result(a, Nil), next: fn(a) -> Result(b, Nil)) -> Result(b, Nil) {
  case result {
    Ok(a) -> next(a)
    Error(_) -> Error(Nil)
  }
}

// --- entities --------------------------------------------------------------

fn entity_json(row: EntityRow) -> json_lite.Json {
  JObject([
    #("id", JInt(row.id)),
    #("name", JString(row.name)),
    #("parent_id", case row.parent_id {
      Some(id) -> JInt(id)
      None -> JNull
    }),
    #("relation_id", case row.relation_id {
      Some(id) -> JInt(id)
      None -> JNull
    }),
  ])
}

fn get_entity(ledger: Ledger, id_str: String) -> Response {
  case parse_id(id_str) {
    Error(resp) -> resp
    Ok(id) ->
      case ledger.get_entity(ledger, id) {
        Ok(row) -> json_response(200, entity_json(row))
        Error(err) -> error_response(err)
      }
  }
}

fn get_children(ledger: Ledger, id_str: String) -> Response {
  case parse_id(id_str) {
    Error(resp) -> resp
    Ok(id) ->
      case ledger.get_children(ledger, Some(id)) {
        Ok(rows) -> json_response(200, JArray(list.map(rows, entity_json)))
        Error(err) -> error_response(err)
      }
  }
}

/// {"name": string, "scope": "global"} — every current entity
/// anywhere with this name (unscoped).
/// {"name": string, "scope": "under", "parent_id": int|null} — the one
/// live entity with this name directly under this exact parent
/// (null parent_id means directly under the root).
fn lookup_entity(req: Request, ledger: Ledger) -> Response {
  case parse_body(req) {
    Error(resp) -> resp
    Ok(body) ->
      case required_string(body, "name"), required_string(body, "scope") {
        Ok(name), Ok("global") ->
          case ledger.get_by_name(ledger, name) {
            Ok(rows) -> json_response(200, JArray(list.map(rows, entity_json)))
            Error(err) -> error_response(err)
          }
        Ok(name), Ok("under") -> {
          let parent_id = optional_parent_id(body, "parent_id")
          case ledger.get_by_name_under(ledger, parent_id, name) {
            Ok(Some(row)) -> json_response(200, entity_json(row))
            Ok(None) -> json_error(404, "no live entity named " <> name <> " under that parent")
            Error(err) -> error_response(err)
          }
        }
        _, _ -> json_error(400, "expected {\"name\": string, \"scope\": \"global\"|\"under\", \"parent_id\"?: int|null}")
      }
  }
}

fn relate_entity(req: Request, ledger: Ledger, id_str: String) -> Response {
  case parse_id(id_str) {
    Error(resp) -> resp
    Ok(id) ->
      case parse_body(req) {
        Error(resp) -> resp
        Ok(body) -> {
          let target_id = optional_parent_id(body, "target_id")
          let created_by = optional_int(body, "created_by", 1)
          case ledger.relate_entity(ledger, id, target_id, created_by) {
            Ok(_) -> Response(204, "")
            Error(err) -> error_response(err)
          }
        }
      }
  }
}

fn list_entities(ledger: Ledger) -> Response {
  case ledger.list_current_entities(ledger) {
    Ok(rows) -> json_response(200, JArray(list.map(rows, entity_json)))
    Error(err) -> error_response(err)
  }
}

fn create_entity(req: Request, ledger: Ledger) -> Response {
  case parse_body(req) {
    Error(resp) -> resp
    Ok(body) ->
      case required_string(body, "name") {
        Error(_) -> json_error(400, "expected {\"name\": string, \"parent_id\": int|null}")
        Ok(name) -> {
          let parent_id = optional_parent_id(body, "parent_id")
          let created_by = optional_int(body, "created_by", 1)
          case ledger.create_entity(ledger, name, parent_id, created_by) {
            Ok(id) -> json_response(201, JObject([#("id", JInt(id))]))
            Error(err) -> error_response(err)
          }
        }
      }
  }
}

fn rename_entity(req: Request, ledger: Ledger, id_str: String) -> Response {
  case parse_id(id_str) {
    Error(resp) -> resp
    Ok(id) ->
      case parse_body(req) {
        Error(resp) -> resp
        Ok(body) ->
          case required_string(body, "name") {
            Error(_) -> json_error(400, "expected {\"name\": string, \"parent_id\": int|null}")
            Ok(name) -> {
              let parent_id = optional_parent_id(body, "parent_id")
              let created_by = optional_int(body, "created_by", 1)
              case ledger.rename_entity(ledger, id, name, parent_id, created_by) {
                Ok(_) -> Response(204, "")
                Error(err) -> error_response(err)
              }
            }
          }
      }
  }
}

// --- accounts ---------------------------------------------------------

fn get_balance(ledger: Ledger, id_str: String) -> Response {
  case parse_id(id_str) {
    Error(resp) -> resp
    Ok(id) ->
      case ledger.get_balance(ledger, id) {
        Ok(balance) ->
          json_response(200, JObject([#("account_id", JInt(id)), #("balance_minor", JInt(balance))]))
        Error(err) -> error_response(err)
      }
  }
}

// --- journal ------------------------------------------------------------

fn parse_line(value: json_lite.Json) -> Result(Line, Nil) {
  use account_id <- result_try(json_lite.field(value, "account_id") |> result_try(json_lite.as_int))
  use amount_minor <- result_try(json_lite.field(value, "amount_minor") |> result_try(json_lite.as_int))
  Ok(Line(account_id, amount_minor))
}

fn posted_entry_json(posted: storage.PostedEntry) -> json_lite.Json {
  JObject([#("id", JInt(posted.id)), #("reference", JString(posted.reference))])
}

fn post_journal(req: Request, ledger: Ledger) -> Response {
  case parse_body(req) {
    Error(resp) -> resp
    Ok(body) ->
      case required_string(body, "reference"), required_string(body, "transdate") {
        Ok(reference), Ok(transdate) -> {
          let description = case required_string(body, "description") {
            Ok(d) -> d
            Error(_) -> ""
          }
          let user_id = optional_int(body, "user_id", 1)
          let lines_result =
            json_lite.field(body, "lines")
            |> result_try(json_lite.as_array)
            |> result_try(fn(items) { list.try_map(items, parse_line) })

          case lines_result {
            Error(_) ->
              json_error(
                400,
                "expected {\"reference\": string, \"transdate\": string, \"lines\": [{\"account_id\": int, \"amount_minor\": int}]}",
              )
            Ok(lines) ->
              case ledger.post_journal_entry(ledger, reference, description, transdate, user_id, lines) {
                Ok(posted) -> json_response(201, posted_entry_json(posted))
                Error(err) -> error_response(err)
              }
          }
        }
        _, _ ->
          json_error(400, "expected {\"reference\": string, \"transdate\": string, \"lines\": [...]}")
      }
  }
}

fn reverse_journal(req: Request, ledger: Ledger, id_str: String) -> Response {
  case parse_id(id_str) {
    Error(resp) -> resp
    Ok(id) ->
      case parse_body(req) {
        Error(resp) -> resp
        Ok(body) ->
          case required_string(body, "transdate") {
            Error(_) -> json_error(400, "expected {\"transdate\": string}")
            Ok(transdate) -> {
              let user_id = optional_int(body, "user_id", 1)
              case ledger.reverse_journal_entry(ledger, id, transdate, user_id) {
                Ok(posted) -> json_response(201, posted_entry_json(posted))
                Error(err) -> error_response(err)
              }
            }
          }
      }
  }
}
