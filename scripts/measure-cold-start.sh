#!/usr/bin/env bash
# Forces N cold starts (N concurrent requests: Lambda starts a new instance for each one it can't
# serve warm), then summarises them from CloudWatch: Lambda's Init Duration, the first request's
# duration, and the API's own start-up phase timings. Read-only apart from the requests.
#   scripts/measure-cold-start.sh [concurrency=8]
set -euo pipefail
export AWS_PROFILE=huskystudio AWS_REGION=ap-southeast-2
n="${1:-8}"
url=$(aws cloudformation describe-stacks --stack-name HomeLoanApi \
  --query "Stacks[0].Outputs[?OutputKey=='ApiEndpoint'].OutputValue" --output text)
group=$(aws logs describe-log-groups --log-group-name-prefix HomeLoanApi-ApiFunctionLogs \
  --query 'logGroups[0].logGroupName' --output text)
since=$(( $(date +%s) * 1000 ))

echo "== $n concurrent requests to $url (each reads the database)"
for i in $(seq 1 "$n"); do
  curl -s -o /dev/null -w "%{http_code} %{time_total}s\n" "$url/api/applications/900002/loan-details" &
done | sort
wait
echo "== waiting 20s for CloudWatch"
sleep 20

aws logs filter-log-events --log-group-name "$group" --start-time "$since" \
  --filter-pattern '?"Init Duration" ?"Startup timings" ?"First SQL connection"' \
  --query 'events[].message' --output text | python3 -c '
import sys, re, statistics as st
text = sys.stdin.read()
inits = [float(x) for x in re.findall(r"Init Duration: ([\d.]+)", text)]
firsts = [float(m.group(1)) for m in re.finditer(r"\tDuration: ([\d.]+) ms[^\n]*Init Duration", text)]
sql = [int(x) for x in re.findall(r"First SQL connection opened in (\d+) ms", text)]
phases = {}
for line in re.findall(r"Startup timings ms: ([^\"\\]+)", text):
    for k, v in re.findall(r"(\w+)=(\d+)", line):
        phases.setdefault(k, []).append(int(v))
med = lambda xs: f"{st.median(xs):6.0f} ms (n={len(xs)}, min {min(xs):.0f}, max {max(xs):.0f})" if xs else "     -"
print(f"cold starts seen:        {len(inits)}")
print(f"Lambda init (median):    {med(inits)}")
print(f"first request (median):  {med(firsts)}")
print(f"  of which first SQL:    {med(sql)}")
for k, v in phases.items():
    print(f"  startup {k:<16}{med(v)}")
'
