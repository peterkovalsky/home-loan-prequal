#!/usr/bin/env bash
# Points the front end's "aws" configuration at the deployed API.
#   scripts/write-aws-config.sh                 # look up the URL with the huskystudio profile
#   scripts/write-aws-config.sh https://...     # or pass it (CI does, from cdk-outputs.json)
set -euo pipefail
cd "$(dirname "$0")/.."
url="${1:-}"
if [[ -z "$url" ]]; then
  url=$(aws cloudformation describe-stacks --profile huskystudio --region ap-southeast-2 --stack-name HomeLoanApi \
    --query "Stacks[0].Outputs[?OutputKey=='ApiEndpoint'].OutputValue" --output text)
fi
# Only the API URL changes; the other settings (applicant cap, terms, Addressfinder key) are kept.
node -e '
const fs = require("fs");
const file = "frontend/config/aws/config.json";
const config = JSON.parse(fs.readFileSync(file, "utf8"));
config.apiBaseUrl = process.argv[1];
fs.writeFileSync(file, JSON.stringify(config, null, "\t") + "\n");
' "${url%/}/api"
echo "frontend/config/aws/config.json -> ${url%/}/api"
