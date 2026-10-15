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
cat > frontend/config/aws/config.json <<JSON
{
	"apiBaseUrl": "${url%/}/api",
	"useMockApi": false,
	"maxApplicants": 4,
	"termsVersion": "2026-10"
}
JSON
echo "frontend/config/aws/config.json -> ${url%/}/api"
