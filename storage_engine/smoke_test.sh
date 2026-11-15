#!/usr/bin/env bash
# A plain curl smoke test against the running HTTP server
# (gleam run &, then this script). Exercises the same scenarios the
# gleeunit integration tests exercise against the actor directly, but
# over the real wire, end to end.
set -euo pipefail

HOST="http://localhost:8080"
pass=0
fail=0

check() {
  local label="$1" expected="$2" actual="$3"
  if [ "$expected" = "$actual" ]; then
    echo "OK   $label"
    pass=$((pass + 1))
  else
    echo "FAIL $label -- expected [$expected] got [$actual]"
    fail=$((fail + 1))
  fi
}

echo "== create two entities =="
cash_id=$(curl -s -X POST "$HOST/entities" -d '{"name":"Cash"}' | python3 -c 'import sys,json;print(json.load(sys.stdin)["id"])')
sales_id=$(curl -s -X POST "$HOST/entities" -d '{"name":"Sales"}' | python3 -c 'import sys,json;print(json.load(sys.stdin)["id"])')
echo "cash=$cash_id sales=$sales_id"

echo "== duplicate name under the same (root) parent is rejected =="
status=$(curl -s -o /dev/null -w '%{http_code}' -X POST "$HOST/entities" -d '{"name":"Cash"}')
check "duplicate name -> 409" "409" "$status"

echo "== balance starts at zero before any posting =="
balance=$(curl -s "$HOST/accounts/$cash_id/balance" | python3 -c 'import sys,json;print(json.load(sys.stdin)["balance_minor"])')
check "cash balance before posting" "0" "$balance"

echo "== post a balanced entry =="
post_resp=$(curl -s -X POST "$HOST/journal" -d "{\"reference\":\"INV-1\",\"transdate\":\"2026-01-01\",\"lines\":[{\"account_id\":$cash_id,\"amount_minor\":500},{\"account_id\":$sales_id,\"amount_minor\":-500}]}")
journal_id=$(echo "$post_resp" | python3 -c 'import sys,json;print(json.load(sys.stdin)["id"])')
cash_balance=$(curl -s "$HOST/accounts/$cash_id/balance" | python3 -c 'import sys,json;print(json.load(sys.stdin)["balance_minor"])')
sales_balance=$(curl -s "$HOST/accounts/$sales_id/balance" | python3 -c 'import sys,json;print(json.load(sys.stdin)["balance_minor"])')
check "cash balance after posting" "500" "$cash_balance"
check "sales balance after posting" "-500" "$sales_balance"

echo "== post an unbalanced entry is rejected, and changes nothing =="
status=$(curl -s -o /dev/null -w '%{http_code}' -X POST "$HOST/journal" -d "{\"reference\":\"INV-BAD\",\"transdate\":\"2026-01-01\",\"lines\":[{\"account_id\":$cash_id,\"amount_minor\":500},{\"account_id\":$sales_id,\"amount_minor\":-400}]}")
check "unbalanced entry -> 422" "422" "$status"
cash_balance=$(curl -s "$HOST/accounts/$cash_id/balance" | python3 -c 'import sys,json;print(json.load(sys.stdin)["balance_minor"])')
check "cash balance unchanged after rejected post" "500" "$cash_balance"

echo "== reverse the entry =="
curl -s -X POST "$HOST/journal/$journal_id/reverse" -d '{"transdate":"2026-01-02"}' > /dev/null
cash_balance=$(curl -s "$HOST/accounts/$cash_id/balance" | python3 -c 'import sys,json;print(json.load(sys.stdin)["balance_minor"])')
check "cash balance after reversal" "0" "$cash_balance"

echo "== reversing the same entry twice is rejected =="
status=$(curl -s -o /dev/null -w '%{http_code}' -X POST "$HOST/journal/$journal_id/reverse" -d '{"transdate":"2026-01-03"}')
check "double reversal -> error status" "1" "$([ "$status" != "201" ] && echo 1 || echo 0)"

echo
echo "pass=$pass fail=$fail"
[ "$fail" -eq 0 ]
