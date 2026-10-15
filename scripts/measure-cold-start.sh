#!/usr/bin/env bash
# Summarises the cold starts of the API version that is live now, from CloudWatch: Lambda's INIT
# Duration, the first request's duration, the first SQL connection, and the API's own start-up
# phases. Read-only apart from the optional requests.
#   scripts/measure-cold-start.sh [minutes=60] [parallel-requests=0]
# Traffic can't reliably force cold starts (a warm instance answers in milliseconds, so a handful
# absorbs a burst), so this reports the real ones: after a deploy, the CI smoke test and journeys
# start fresh instances; after a quiet spell, the next request does.
set -euo pipefail
export AWS_PROFILE=huskystudio AWS_REGION=ap-southeast-2
minutes="${1:-60}"
parallel="${2:-0}"
url=$(aws cloudformation describe-stacks --stack-name HomeLoanApi \
  --query "Stacks[0].Outputs[?OutputKey=='ApiEndpoint'].OutputValue" --output text)
group=$(aws logs describe-log-groups --log-group-name-prefix HomeLoanApi-ApiFunctionLogs \
  --query 'logGroups[0].logGroupName' --output text)
fn=$(aws cloudformation describe-stack-resources --stack-name HomeLoanApi \
  --query "StackResources[?ResourceType=='AWS::Lambda::Function' && starts_with(LogicalResourceId, 'ApiFunction')].PhysicalResourceId" --output text)
version=$(aws lambda get-alias --function-name "$fn" --name live --query FunctionVersion --output text)
memory=$(aws lambda get-function-configuration --function-name "$fn" --qualifier "$version" --query MemorySize --output text)

if [ "$parallel" -gt 0 ]; then
  echo "== $parallel parallel requests to $url"
  args=()
  for i in $(seq 1 "$parallel"); do
    args+=(-o /dev/null -w "%{http_code} %{time_total}s\n" "$url/api/applications/900002/loan-details?n=$i")
  done
  curl -s --parallel --parallel-immediate --parallel-max "$parallel" "${args[@]}" | sort -k2 -n
  echo "== waiting 20s for CloudWatch"
  sleep 20
fi

echo "== cold starts of version $version ($memory MB) in the last $minutes min"
aws logs filter-log-events --log-group-name "$group" --start-time $(( ($(date +%s) - minutes * 60) * 1000 )) \
  --filter-pattern '?"Init Duration" ?"Startup timings" ?"First SQL connection"' \
  --query 'events[].[logStreamName,message]' --output json | python3 -c '
import sys, json, re, statistics as st
version = sys.argv[1]
text = "\n".join(m for s, m in json.load(sys.stdin) if f"[{version}]" in s)
inits = [float(x) for x in re.findall(r"Init Duration: ([\d.]+)", text)]
firsts = [float(m.group(1)) for m in re.finditer(r"\tDuration: ([\d.]+) ms[^\n]*Init Duration", text)]
# Anchored to the top-level Message: the JSON console logger repeats the text inside State.
sql = [int(x) for x in re.findall(r"\"Message\":\"First SQL connection opened in (\d+) ms\",\"State", text)]
phases = {}
for line in re.findall(r"\"Message\":\"Startup timings ms: ([^\"]+)\",\"State", text):
    for k, v in re.findall(r"(\w+)=(\d+)", line):
        phases.setdefault(k, []).append(int(v))
med = lambda xs: f"{st.median(xs):6.0f} ms (n={len(xs)}, min {min(xs):.0f}, max {max(xs):.0f})" if xs else "     -"
print(f"cold starts seen:        {len(inits)}")
print(f"Lambda init (median):    {med(inits)}")
print(f"first request (median):  {med(firsts)}")
print(f"  of which first SQL:    {med(sql)}")
for k, v in phases.items():
    label = k + ":"
    print(f"  startup {label:17}{med(v)}")
' "$version"
