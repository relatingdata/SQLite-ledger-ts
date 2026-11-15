// A minimal, hand-rolled JSON encoder/decoder — gleam_json wasn't
// vendored (repo.hex.pm is unreachable from this sandbox; see
// storage.gleam/sqlite_cli.gleam's own header comments for the same
// constraint on the SQL side). Every shape this engine's HTTP API
// actually needs is small and flat (see http_api.gleam), so this
// covers exactly that: objects, arrays, strings, ints, null — no
// floats, no deeply nested structures.

import gleam/int
import gleam/list
import gleam/string

pub type Json {
  JString(String)
  JInt(Int)
  JNull
  JBool(Bool)
  JObject(List(#(String, Json)))
  JArray(List(Json))
}

// --- encoding -----------------------------------------------------------

pub fn encode(value: Json) -> String {
  case value {
    JString(s) -> "\"" <> escape(s) <> "\""
    JInt(n) -> int.to_string(n)
    JNull -> "null"
    JBool(True) -> "true"
    JBool(False) -> "false"
    JObject(fields) ->
      "{"
      <> {
        fields
        |> list.map(fn(field) { "\"" <> escape(field.0) <> "\":" <> encode(field.1) })
        |> string.join(",")
      }
      <> "}"
    JArray(items) -> "[" <> { items |> list.map(encode) |> string.join(",") } <> "]"
  }
}

fn escape(s: String) -> String {
  s
  |> string.replace("\\", "\\\\")
  |> string.replace("\"", "\\\"")
  |> string.replace("\n", "\\n")
  |> string.replace("\r", "\\r")
  |> string.replace("\t", "\\t")
}

// --- decoding -------------------------------------------------------------

pub type DecodeError {
  Malformed(String)
}

/// Parses a whole JSON document. Trailing content after the first
/// value is an error — there is never more than one body per HTTP
/// request here.
pub fn parse(input: String) -> Result(Json, DecodeError) {
  case parse_value(skip_whitespace(input)) {
    Ok(#(value, rest)) ->
      case skip_whitespace(rest) {
        "" -> Ok(value)
        _ -> Error(Malformed("unexpected trailing content"))
      }
    Error(err) -> Error(err)
  }
}

fn skip_whitespace(input: String) -> String {
  case string.pop_grapheme(input) {
    Ok(#(" ", rest)) | Ok(#("\n", rest)) | Ok(#("\r", rest)) | Ok(#("\t", rest)) ->
      skip_whitespace(rest)
    _ -> input
  }
}

fn parse_value(input: String) -> Result(#(Json, String), DecodeError) {
  case string.pop_grapheme(input) {
    Ok(#("{", rest)) -> parse_object(skip_whitespace(rest), [])
    Ok(#("[", rest)) -> parse_array(skip_whitespace(rest), [])
    Ok(#("\"", rest)) ->
      case parse_string_body(rest, "") {
        Ok(#(s, rest)) -> Ok(#(JString(s), rest))
        Error(err) -> Error(err)
      }
    Ok(#("t", _)) ->
      case string.starts_with(input, "true") {
        True -> Ok(#(JBool(True), string.drop_start(input, 4)))
        False -> Error(Malformed("expected 'true'"))
      }
    Ok(#("f", _)) ->
      case string.starts_with(input, "false") {
        True -> Ok(#(JBool(False), string.drop_start(input, 5)))
        False -> Error(Malformed("expected 'false'"))
      }
    Ok(#("n", _)) ->
      case string.starts_with(input, "null") {
        True -> Ok(#(JNull, string.drop_start(input, 4)))
        False -> Error(Malformed("expected 'null'"))
      }
    Ok(#(c, _)) if c == "-" -> parse_number(input, "")
    Ok(#(c, _)) -> {
      case is_digit(c) {
        True -> parse_number(input, "")
        False -> Error(Malformed("unexpected character: " <> c))
      }
    }
    Error(_) -> Error(Malformed("unexpected end of input"))
  }
}

fn is_digit(c: String) -> Bool {
  case c {
    "0" | "1" | "2" | "3" | "4" | "5" | "6" | "7" | "8" | "9" -> True
    _ -> False
  }
}

fn parse_number(input: String, acc: String) -> Result(#(Json, String), DecodeError) {
  case string.pop_grapheme(input) {
    Ok(#(c, rest)) if c == "-" -> parse_number(rest, acc <> c)
    Ok(#(c, rest)) ->
      case is_digit(c) {
        True -> parse_number(rest, acc <> c)
        False -> finish_number(acc, input)
      }
    Error(_) -> finish_number(acc, input)
  }
}

fn finish_number(acc: String, rest: String) -> Result(#(Json, String), DecodeError) {
  case int.parse(acc) {
    Ok(n) -> Ok(#(JInt(n), rest))
    Error(_) -> Error(Malformed("invalid number: " <> acc))
  }
}

fn parse_string_body(input: String, acc: String) -> Result(#(String, String), DecodeError) {
  case string.pop_grapheme(input) {
    Ok(#("\"", rest)) -> Ok(#(acc, rest))
    Ok(#("\\", rest)) ->
      case string.pop_grapheme(rest) {
        Ok(#("n", rest2)) -> parse_string_body(rest2, acc <> "\n")
        Ok(#("r", rest2)) -> parse_string_body(rest2, acc <> "\r")
        Ok(#("t", rest2)) -> parse_string_body(rest2, acc <> "\t")
        Ok(#("\"", rest2)) -> parse_string_body(rest2, acc <> "\"")
        Ok(#("\\", rest2)) -> parse_string_body(rest2, acc <> "\\")
        Ok(#("/", rest2)) -> parse_string_body(rest2, acc <> "/")
        Ok(#(other, rest2)) -> parse_string_body(rest2, acc <> other)
        Error(_) -> Error(Malformed("unterminated escape"))
      }
    Ok(#(c, rest)) -> parse_string_body(rest, acc <> c)
    Error(_) -> Error(Malformed("unterminated string"))
  }
}

fn parse_object(
  input: String,
  acc: List(#(String, Json)),
) -> Result(#(Json, String), DecodeError) {
  case string.pop_grapheme(input) {
    Ok(#("}", rest)) -> Ok(#(JObject(list.reverse(acc)), rest))
    _ ->
      case string.pop_grapheme(input) {
        Ok(#("\"", rest)) ->
          case parse_string_body(rest, "") {
            Error(err) -> Error(err)
            Ok(#(key, rest)) -> {
              let rest = skip_whitespace(rest)
              case string.pop_grapheme(rest) {
                Ok(#(":", rest)) -> {
                  let rest = skip_whitespace(rest)
                  case parse_value(rest) {
                    Error(err) -> Error(err)
                    Ok(#(value, rest)) -> {
                      let rest = skip_whitespace(rest)
                      case string.pop_grapheme(rest) {
                        Ok(#(",", rest)) -> parse_object(skip_whitespace(rest), [#(key, value), ..acc])
                        Ok(#("}", rest)) -> Ok(#(JObject(list.reverse([#(key, value), ..acc])), rest))
                        _ -> Error(Malformed("expected ',' or '}' in object"))
                      }
                    }
                  }
                }
                _ -> Error(Malformed("expected ':' in object"))
              }
            }
          }
        _ -> Error(Malformed("expected string key in object"))
      }
  }
}

fn parse_array(input: String, acc: List(Json)) -> Result(#(Json, String), DecodeError) {
  case string.pop_grapheme(input) {
    Ok(#("]", rest)) -> Ok(#(JArray(list.reverse(acc)), rest))
    _ ->
      case parse_value(input) {
        Error(err) -> Error(err)
        Ok(#(value, rest)) -> {
          let rest = skip_whitespace(rest)
          case string.pop_grapheme(rest) {
            Ok(#(",", rest)) -> parse_array(skip_whitespace(rest), [value, ..acc])
            Ok(#("]", rest)) -> Ok(#(JArray(list.reverse([value, ..acc])), rest))
            _ -> Error(Malformed("expected ',' or ']' in array"))
          }
        }
      }
  }
}

// --- accessors --------------------------------------------------------

pub fn field(value: Json, name: String) -> Result(Json, Nil) {
  case value {
    JObject(fields) ->
      fields
      |> list.find(fn(pair) { pair.0 == name })
      |> result_map(fn(pair) { pair.1 })
    _ -> Error(Nil)
  }
}

fn result_map(result: Result(a, b), f: fn(a) -> c) -> Result(c, b) {
  case result {
    Ok(a) -> Ok(f(a))
    Error(b) -> Error(b)
  }
}

pub fn as_string(value: Json) -> Result(String, Nil) {
  case value {
    JString(s) -> Ok(s)
    _ -> Error(Nil)
  }
}

pub fn as_int(value: Json) -> Result(Int, Nil) {
  case value {
    JInt(n) -> Ok(n)
    _ -> Error(Nil)
  }
}

pub fn as_array(value: Json) -> Result(List(Json), Nil) {
  case value {
    JArray(items) -> Ok(items)
    _ -> Error(Nil)
  }
}

pub fn is_null(value: Json) -> Bool {
  case value {
    JNull -> True
    _ -> False
  }
}
