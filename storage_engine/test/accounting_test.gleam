import accounting.{Line, NoLines, Unbalanced}
import gleam/dict
import gleam/option.{None, Some}
import gleeunit/should

fn no_currency(_account_id: Int) -> option.Option(String) {
  None
}

pub fn a_balanced_pair_is_ok_test() {
  let lines = [Line(1, 500), Line(2, -500)]

  accounting.validate_balanced(lines, no_currency)
  |> should.equal(Ok(Nil))
}

pub fn an_unbalanced_pair_is_rejected_with_the_real_shortfall_test() {
  let lines = [Line(1, 500), Line(2, -400)]

  accounting.validate_balanced(lines, no_currency)
  |> should.equal(Error(Unbalanced(None, 100)))
}

pub fn no_lines_at_all_is_rejected_test() {
  accounting.validate_balanced([], no_currency)
  |> should.equal(Error(NoLines))
}

pub fn each_currency_must_independently_balance_test() {
  let currency_of = fn(account_id: Int) {
    case account_id {
      1 | 2 -> None
      3 | 4 -> Some("EUR")
      _ -> None
    }
  }
  // Home-currency legs balance (500 - 500 = 0); EUR legs do not
  // (300 - 200 = 100) — flat total across both is still zero, so a
  // naive single-total check would wrongly call this balanced.
  let lines = [Line(1, 500), Line(2, -500), Line(3, 300), Line(4, -200)]

  accounting.validate_balanced(lines, currency_of)
  |> should.equal(Error(Unbalanced(Some("EUR"), 100)))
}

pub fn balance_deltas_sum_per_account_test() {
  // Two lines can hit the same account within one entry; the delta
  // applied to balance_minor is their sum, not just the last line.
  let lines = [Line(1, 500), Line(1, -200), Line(2, -300)]

  accounting.balance_deltas(lines)
  |> should.equal(dict.from_list([#(1, 300), #(2, -300)]))
}

pub fn reversing_lines_negates_every_amount_and_keeps_the_same_accounts_test() {
  let lines = [Line(1, 500), Line(2, -500)]

  accounting.reversing_lines(lines)
  |> should.equal([Line(1, -500), Line(2, 500)])
}

pub fn reversing_an_already_balanced_entry_is_itself_always_balanced_test() {
  let lines = [Line(1, 500), Line(2, -300), Line(3, -200)]
  let assert Ok(Nil) = accounting.validate_balanced(lines, no_currency)

  accounting.reversing_lines(lines)
  |> accounting.validate_balanced(no_currency)
  |> should.equal(Ok(Nil))
}
