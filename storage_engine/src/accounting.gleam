// Pure rules for journal/journal_line — no I/O, no database. Decides
// whether a journal entry may post at all; the real INSERTs and the
// matching account.balance_minor updates (storage.gleam) only run
// once validate_balanced returns Ok.
//
// Mirrors db-journal.ts's own per-currency balance check from
// sqlite-ledger-ts, exactly: every distinct currency present across
// the entry's lines must independently sum to zero. A multi-currency
// entry is fine, but one currency may never silently absorb another
// currency's imbalance.

import gleam/dict.{type Dict}
import gleam/list
import gleam/option.{type Option, None, Some}

pub type AccountId =
  Int

/// One staged line of a not-yet-posted entry. Positive = debit,
/// negative = credit — the same sign convention journal_line's own
/// amount_minor column uses.
pub type Line {
  Line(account_id: AccountId, amount_minor: Int)
}

pub type PostingError {
  NoLines
  Unbalanced(currency: Option(String), off_by_minor: Int)
}

fn add_to(totals: Dict(a, Int), key: a, amount: Int) -> Dict(a, Int) {
  dict.upsert(totals, key, fn(existing) {
    case existing {
      Some(total) -> total + amount
      None -> amount
    }
  })
}

/// Every distinct currency present across the entry's lines must
/// independently sum to zero. `currency_of` is the caller's lookup of
/// each line's own account.currency (None = home/reporting currency).
pub fn validate_balanced(
  lines: List(Line),
  currency_of: fn(AccountId) -> Option(String),
) -> Result(Nil, PostingError) {
  case lines {
    [] -> Error(NoLines)
    _ -> {
      let totals =
        lines
        |> list.fold(dict.new(), fn(totals, line) {
          add_to(totals, currency_of(line.account_id), line.amount_minor)
        })

      case list.find(dict.to_list(totals), fn(pair) { pair.1 != 0 }) {
        Ok(#(currency, total)) -> Error(Unbalanced(currency, total))
        Error(_) -> Ok(Nil)
      }
    }
  }
}

/// The matching balance_minor deltas, one per account, once
/// validate_balanced has already returned Ok for these same lines.
pub fn balance_deltas(lines: List(Line)) -> Dict(AccountId, Int) {
  lines
  |> list.fold(dict.new(), fn(deltas, line) {
    add_to(deltas, line.account_id, line.amount_minor)
  })
}

/// The reversing lines for an entry being reversed — same accounts,
/// every amount negated. Posting these through the normal path
/// balances by construction, since negating every line in an already-
/// balanced set leaves every currency group still summing to zero.
pub fn reversing_lines(lines: List(Line)) -> List(Line) {
  lines
  |> list.map(fn(line) { Line(line.account_id, -line.amount_minor) })
}
