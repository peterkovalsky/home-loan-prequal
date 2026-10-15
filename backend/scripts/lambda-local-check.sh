#!/usr/bin/env bash
# Runs the Lambda container images locally under the AWS Runtime Interface Emulator (built into the
# base image) against the docker compose SQL Server, and sends them real API Gateway HTTP API events.
# Proves start-up, ICU, time zones, SQL connectivity and routing before anything goes to AWS.
#   Prereq: docker compose up -d sqlserver migrator   (from the repo root, with .env)
set -euo pipefail
cd "$(dirname "$0")/.."
source ../.env

net=$(docker inspect homeloan-sqlserver-1 --format '{{range $k, $v := .NetworkSettings.Networks}}{{$k}}{{end}}')
db="Server=sqlserver,1433;Database=HomeLoan;Encrypt=True;TrustServerCertificate=True"
invoke() { curl -sS -X POST "http://localhost:$1/2015-03-31/functions/function/invocations" -d "$2"; echo; }
event() { # method path [body]
  python3 -c 'import json,sys; m,p=sys.argv[1],sys.argv[2]; b=sys.argv[3] if len(sys.argv)>3 else None
print(json.dumps({"version":"2.0","routeKey":"$default","rawPath":p,"rawQueryString":"",
 "headers":{"host":"local","content-type":"application/json"},"body":b,"isBase64Encoded":False,
 "requestContext":{"http":{"method":m,"path":p,"protocol":"HTTP/1.1","sourceIp":"127.0.0.1","userAgent":"check"},
 "requestId":"local","routeKey":"$default","stage":"$default","timeEpoch":0}}))' "$@"; }

echo "== building images"
docker build -q --target lambda -t homeloan-lambda-api . >/dev/null
docker build -q --target migrator-lambda -t homeloan-lambda-migrator . >/dev/null
trap 'docker rm -f hl-api hl-migrator >/dev/null 2>&1 || true' EXIT

echo "== migrator (expects a summary, not an error)"
docker run -d --rm --name hl-migrator --network "$net" -p 9001:8080 \
  -e "ConnectionStrings__Admin=$db;User Id=sa;Password=$MSSQL_SA_PASSWORD" \
  -e "Database__AppLoginPassword=$APP_DB_PASSWORD" homeloan-lambda-migrator >/dev/null
sleep 2; invoke 9001 '{}'

echo "== api: /health/ready, GET applicants (200 or 404), then a validation error (400)"
docker run -d --rm --name hl-api --network "$net" -p 9000:8080 \
  -e "ConnectionStrings__HomeLoan=$db;User Id=homeloan_app;Password=$APP_DB_PASSWORD" homeloan-lambda-api >/dev/null
sleep 2
invoke 9000 "$(event GET /health/ready)"
invoke 9000 "$(event GET /api/applications/1/applicants)" | cut -c1-200
invoke 9000 "$(event PUT /api/applications/2/applicants '{"applicants":[]}')" | cut -c1-200
