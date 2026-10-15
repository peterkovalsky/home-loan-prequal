#!/usr/bin/env bash
# Local CDK commands for this project, always against the huskystudio account (never the default
# profile). CI does not use this: it signs in with OIDC.
#   ./cdk.sh synth | diff | deploy HomeLoanGitHubOidc | bootstrap
set -euo pipefail
cd "$(dirname "$0")"
export AWS_PROFILE=huskystudio AWS_REGION=ap-southeast-2
account=$(aws sts get-caller-identity --query Account --output text)
expected=$(python3 -c 'import json; print(json.load(open("cdk.json"))["context"]["account"])')
if [[ "$account" != "$expected" ]]; then
  echo "Refusing: profile $AWS_PROFILE is account $account, cdk.json expects $expected." >&2
  exit 1
fi
if [[ "${1:-}" == "bootstrap" ]]; then
  exec npx -y aws-cdk@2.1145.0 bootstrap "aws://$expected/$AWS_REGION"
fi
exec npx -y aws-cdk@2.1145.0 "$@"
