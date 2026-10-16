#!/usr/bin/env bash
# Exercises a deployed API end to end on an application of its own (created with POST, so demo
# data is never touched), then deletes it. Usage: smoke-test.sh https://xxxx.execute-api.ap-southeast-2.amazonaws.com
set -euo pipefail
api="${1:?API endpoint required}/api"
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

check 201 "start an application" -X POST "$api/applications"
id=$(python3 -c 'import json,sys; print(json.load(open("/tmp/smoke-body"))["id"])')
token=$(python3 -c 'import json,sys; print(json.load(open("/tmp/smoke-body"))["resumeToken"])')
base="$api/applications/$id"
json+=(-H "X-Application-Token: $token")
echo "     application $id"

check 404 "refused without its token" "$base/loan-details"
check 404 "loan details not saved yet" "${json[@]}" "$base/loan-details"
check 204 "save a half-filled draft" -X PUT "${json[@]}" -d '{"purpose":1006,"loanAmount":null}' "$base/drafts/loan-details"
check 201 "create loan details" -X PUT "${json[@]}" -d "$loan" "$base/loan-details"
etag=$(curl -sS -D - -o /dev/null -H "X-Application-Token: $token" "$base/loan-details" | awk 'tolower($1)=="etag:" {print $2}' | tr -d '\r')
[[ -n "$etag" ]] || { echo "FAIL no ETag on GET"; exit 1; }
echo "ok   ETag $etag"
check 428 "update without If-Match is refused" -X PUT "${json[@]}" -d "$loan" "$base/loan-details"
check 200 "update with If-Match" -X PUT "${json[@]}" -H "If-Match: $etag" -d "$loan" "$base/loan-details"
check 412 "stale If-Match is refused" -X PUT "${json[@]}" -H "If-Match: $etag" -d "$loan" "$base/loan-details"
check 201 "create applicants" -X PUT "${json[@]}" -d "$applicants" "$base/applicants"
check 400 "validation error" -X PUT "${json[@]}" -d '{"applicants":[]}' "$base/applicants"
check 204 "clean up" -X DELETE "${json[@]}" "$base"
echo "smoke test passed ($pass checks)"
