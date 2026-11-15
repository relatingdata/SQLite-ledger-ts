# storage_engine

The simplest possible Gleam storage engine for sqlite-ledger-ts's 4
core tables — `entities`, `account`, `journal`, `journal_line` — built
and verified as a design exploration alongside that project.

It is **not** a reimplementation of sqlite-ledger-ts's schema or data:
it is the same shape and the same transactional/append-only rules
(see `priv/schema.sql`), running as a standalone Gleam/BEAM service
with its own SQLite file, driven over HTTP.

## Design

- Storage is plain SQLite (`priv/schema.sql`), not ETS, not a custom
  log file — the same durability SQLite always had.
- One OTP actor (`src/ledger.gleam`) owns exclusive access to that
  file. Every write is a `process.call` to it, so the actor's mailbox
  serializes writes — there is no lock anywhere else in this codebase.
- Every write handler runs inside a single SQLite transaction
  (`src/storage.gleam`): either every statement in it lands on disk,
  or none do.
- The business rules — "is this name free under this parent",
  "does this entry balance, per currency" — are pure functions with
  no I/O at all (`src/entities.gleam`, `src/accounting.gleam`),
  unit-tested on their own.
- `journal`/`journal_line` are append-only by trigger, not just by
  convention — `journal.reversal_of` is the one, narrow, write-once
  exception (see `priv/schema.sql`'s guard triggers, lifted straight
  from sqlite-ledger-ts's own `backend/schema/00-core.sql`).

### Why there's no sqlight, mist, or wisp here

`repo.hex.pm` (where every Gleam/Erlang package beyond the four on
GitHub below is published) isn't reachable from the sandbox this was
built in. Rather than stub the engine out, every layer that would
normally be a hex dependency is instead a small, real, hand-rolled
module:

- **SQL**: `src/sqlite_cli.gleam` + `src/sqlite_cli_ffi.erl` drive
  the real `sqlite3` CLI binary as a subprocess per script (one
  `sqlite3 -bail <db> < <script>` per transaction) instead of
  sqlight's NIF binding to `esqlite`. Same real file, same real
  transactions and triggers — a process spawn per call instead of an
  in-process C call.
- **HTTP**: `src/http_server.gleam` + `src/http_server_ffi.erl` are a
  minimal HTTP/1.1 server directly on `gen_tcp`, using Erlang's own
  built-in `{packet, http_bin}` request decoder — no mist/glisten.
- **JSON**: `src/json_lite.gleam` is a small hand-rolled encoder/
  decoder for the flat shapes this API actually needs — no gleam_json.

`gleam_stdlib`, `gleam_otp`, `gleam_erlang`, and `gleeunit` *are* on
GitHub under `gleam-lang`/`lpil`, so those four are real, plain `git
clone`s referenced as local `path` dependencies in `gleam.toml` (see
that file's own comment) — nothing in this project is faked or
mocked, just sourced differently than usual.

One more constraint this sandbox's Erlang/OTP (25) imposed: the
Gleam compiler had to be built from source too (`cargo build
--release` against a shallow clone of `gleam-lang/gleam`), pinned to
v1.17.0 — the newest tag before a compiler-internal refactor (v1.18+)
started emitting Erlang forms and a `maybe`-expression-based build
helper that OTP 25 can't parse without patches. None of this affects
the engine's own code, only how the toolchain that builds it got
assembled here.

## Running

```sh
gleam run    # listens on :8080, db=storage_engine.sqlite3 (in gleam.toml's project root)
```

## HTTP API

| Method | Path                     | Body                                                              |
|--------|--------------------------|--------------------------------------------------------------------|
| GET    | `/entities`              | —                                                                   |
| POST   | `/entities`               | `{"name": "Cash", "parent_id": null}`                              |
| POST   | `/entities/:id/rename`    | `{"name": "Cash and Bank", "parent_id": null}`                     |
| GET    | `/accounts/:id/balance`   | —                                                                   |
| POST   | `/journal`                 | `{"reference": "INV-1", "transdate": "2026-01-01", "lines": [{"account_id": 1, "amount_minor": 500}, {"account_id": 2, "amount_minor": -500}]}` |
| POST   | `/journal/:id/reverse`     | `{"transdate": "2026-01-02"}`                                      |

## Tests

```sh
gleam test
```

- `test/entities_test.gleam`, `test/accounting_test.gleam` — the pure
  rules, no database.
- `test/ledger_test.gleam` — the real actor against a real, on-disk
  SQLite file: posting, balance updates, unbalanced-entry rejection
  (and that nothing is written when it's rejected), reversal, and
  that reversing the same entry twice is rejected.
- `smoke_test.sh` — a plain `curl` script against the running HTTP
  server, exercising the same scenarios end to end over the wire.
