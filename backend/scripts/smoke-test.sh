#!/usr/bin/env bash
# Exercises a deployed API end to end on its own application id (900001), so demo data in
# application 1 is never touched. Usage: smoke-test.sh https://xxxx.execute-api.ap-southeast-2.amazonaws.com
set -euo pipefail
base="${1:?API endpoint required}/api/applications/900001"
pass=0
check() { # expected-status description curl-args...
  local expected=$1 what=$2; shift 2
  local status
  status=$(curl -sS -o /tmp/smoke-body -w '%{http_code}' "$@")
  if [[ "$status" != "$expected" ]]; then
    echo "FAIL $what: expected $expected, got $status"; cat /tmp/smoke-body; echo; exit 1
  fi
  echo "ok   $what ($status)"; pass=$((pass + 1))
}
json=(-H 'Content-Type: application/json')
loan='{"purpose":1006,"propertyUsage":1003,"numberOfApplicants":1,"isSameHousehold":null,"numberOfDependants":0,"loanAmount":500000,"deposit":null,"estimatedPropertyValue":900000,"isAddressKnown":false,"address":null,"state":1001}'
applicants='{"applicants":[{"title":1,"firstName":"Smoke","lastName":"Test","email":"smoke@example.com","mobile":"0412 345 678","dateOfBirth":"1988-03-14"}],"consent":{"accepted":true,"termsVersion":"2026-10"}}'

seconds=$(curl -sS -o /dev/null -w '%{time_total}' "${1}/health/live")
echo "     first request took ${seconds}s (includes any cold start)"
check 200 "health (ready, database reachable)" "${1}/health/ready"

check 204 "reset" -X DELETE "$base"
check 404 "loan details not saved yet" "$base/loan-details"
check 201 "create loan details" -X PUT "${json[@]}" -d "$loan" "$base/loan-details"
etag=$(curl -sS -D - -o /dev/null "$base/loan-details" | awk 'tolower($1)=="etag:" {print $2}' | tr -d '\r')
[[ -n "$etag" ]] || { echo "FAIL no ETag on GET"; exit 1; }
echo "ok   ETag $etag"
check 428 "update without If-Match is refused" -X PUT "${json[@]}" -d "$loan" "$base/loan-details"
check 200 "update with If-Match" -X PUT "${json[@]}" -H "If-Match: $etag" -d "$loan" "$base/loan-details"
check 412 "stale If-Match is refused" -X PUT "${json[@]}" -H "If-Match: $etag" -d "$loan" "$base/loan-details"
check 201 "create applicants" -X PUT "${json[@]}" -d "$applicants" "$base/applicants"
check 400 "validation error" -X PUT "${json[@]}" -d '{"applicants":[]}' "$base/applicants"
check 204 "clean up" -X DELETE "$base"
echo "smoke test passed ($pass checks)"
