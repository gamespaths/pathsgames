#!/usr/bin/env bash
# v0.42.0 — creates (or updates with a new default version) the IAM managed policy `paths-games-deployer` used by GitHub Actions for alpha.
# Usage: aws_create_policy_github_actions.sh [--dry-run] [--account-id ID] [--attach-user USER [--detach-full]]
set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
ENV_FILE="$PROJECT_ROOT/.env"
if [ -f "$ENV_FILE" ]; then
	# shellcheck disable=SC1090
	. "$ENV_FILE"
fi
SAMCONFIG="$PROJECT_ROOT/code/backend/aws/samconfig.toml"
POLICY_NAME="paths-games-deployer"

usage() { sed -n '2,3p' "$0" | sed 's/^# \{0,1\}//'; }

DRY_RUN=false
ACCOUNT_ID=""
ATTACH_USER=""
DETACH_FULL=false
while [ $# -gt 0 ]; do
	case "$1" in
		--dry-run) DRY_RUN=true; shift ;;
		--account-id) ACCOUNT_ID="${2:-}"; shift 2 ;;
		--attach-user) ATTACH_USER="${2:-}"; shift 2 ;;
		--detach-full) DETACH_FULL=true; shift ;;
		-h|--help) usage; exit 0 ;;
		*) echo "Error: unknown argument '$1'." >&2; usage >&2; exit 2 ;;
	esac
done
if [ "$DETACH_FULL" = true ] && [ -z "$ATTACH_USER" ]; then
	echo "Error: --detach-full needs --attach-user." >&2
	exit 2
fi

# Stack, region and SAM artifact bucket come from samconfig.toml [alpha.deploy.parameters].
read -r STACK REGION ARTIFACT_BUCKET ARTIFACT_PREFIX < <(python3 - "$SAMCONFIG" <<'PY'
import sys, tomllib
with open(sys.argv[1], "rb") as fh:
    p = tomllib.load(fh)["alpha"]["deploy"]["parameters"]
print(p["stack_name"], p["region"], p["s3_bucket"], p["s3_prefix"])
PY
)

WEBSITE_BUCKET="${AWS_ALPHA_S3_BUCKET_WEBSITE:-}"
DISTRIBUTION_ID="${AWS_ALPHA_CLOUDFRONT_DISTRIBUTION_ID:-}"
HOSTED_ZONE_ID="${AWS_ALPHA_ROUTE53_DOMAIN_HOSTED_ZONE:-}"
HOSTED_ZONE_ID="${HOSTED_ZONE_ID#/hostedzone/}"

if [ "$DRY_RUN" = true ]; then
	ACCOUNT_ID="${ACCOUNT_ID:-ACCOUNT_ID}"
	WEBSITE_BUCKET="${WEBSITE_BUCKET:-WEBSITE_BUCKET}"
	DISTRIBUTION_ID="${DISTRIBUTION_ID:-DISTRIBUTION_ID}"
	HOSTED_ZONE_ID="${HOSTED_ZONE_ID:-HOSTED_ZONE_ID}"
else
	for _key in AWS_ALPHA_S3_BUCKET_WEBSITE AWS_ALPHA_CLOUDFRONT_DISTRIBUTION_ID AWS_ALPHA_ROUTE53_DOMAIN_HOSTED_ZONE; do
		if [ -z "${!_key:-}" ]; then
			echo "Error: $_key is not set in .env (or the environment)." >&2
			exit 1
		fi
	done
	if [ -z "$ACCOUNT_ID" ]; then
		ACCOUNT_ID="$(aws sts get-caller-identity --query Account --output text)"
	fi
fi

# Least-privilege document: SAM deploy of the alpha stack + react-game sync and invalidation (replaces S3/CloudFront FullAccess).
POLICY_FILE="$(mktemp)"
trap 'rm -f "$POLICY_FILE"' EXIT
python3 - "$POLICY_FILE" "$ACCOUNT_ID" "$REGION" "$STACK" "$ARTIFACT_BUCKET" "$ARTIFACT_PREFIX" \
	"$WEBSITE_BUCKET" "$DISTRIBUTION_ID" "$HOSTED_ZONE_ID" <<'PY'
import json, sys
out, acct, region, stack, art_bucket, art_prefix, web_bucket, dist_id, zone = sys.argv[1:]
arn = lambda svc, res, reg=region: f"arn:aws:{svc}:{reg}:{acct}:{res}"
statements = [
    {"Sid": "CloudFormation", "Effect": "Allow", "Action": "cloudformation:*",
     "Resource": arn("cloudformation", f"stack/{stack}*/*")},
    {"Sid": "SamTransform", "Effect": "Allow", "Action": "cloudformation:CreateChangeSet",
     "Resource": f"arn:aws:cloudformation:{region}:aws:transform/Serverless-2016-10-31"},
    {"Sid": "CfnRead", "Effect": "Allow",
     "Action": ["cloudformation:ValidateTemplate", "cloudformation:GetTemplateSummary", "cloudformation:ListStacks"],
     "Resource": "*"},
    {"Sid": "SamArtifactsList", "Effect": "Allow", "Action": ["s3:ListBucket", "s3:GetBucketLocation"],
     "Resource": f"arn:aws:s3:::{art_bucket}"},
    {"Sid": "SamArtifacts", "Effect": "Allow", "Action": ["s3:GetObject", "s3:PutObject"],
     "Resource": f"arn:aws:s3:::{art_bucket}/{art_prefix}/*"},
    {"Sid": "Lambda", "Effect": "Allow", "Action": "lambda:*", "Resource": arn("lambda", f"function:{stack}-*")},
    {"Sid": "ApiGateway", "Effect": "Allow",
     "Action": ["apigateway:GET", "apigateway:POST", "apigateway:PUT", "apigateway:PATCH", "apigateway:DELETE",
                "apigateway:TagResource", "apigateway:UntagResource"],
     "Resource": f"arn:aws:apigateway:{region}::/*"},
    {"Sid": "DynamoDB", "Effect": "Allow", "Action": "dynamodb:*",
     "Resource": arn("dynamodb", "table/PathsGamesBackend-alpha*")},
    {"Sid": "IamRoles", "Effect": "Allow",
     "Action": ["iam:CreateRole", "iam:DeleteRole", "iam:GetRole", "iam:UpdateRole", "iam:TagRole", "iam:UntagRole",
                "iam:PutRolePolicy", "iam:DeleteRolePolicy", "iam:GetRolePolicy", "iam:ListRolePolicies",
                "iam:AttachRolePolicy", "iam:DetachRolePolicy", "iam:ListAttachedRolePolicies",
                "iam:UpdateAssumeRolePolicy"],
     "Resource": f"arn:aws:iam::{acct}:role/{stack}-*"},
    {"Sid": "PassRoleToLambda", "Effect": "Allow", "Action": "iam:PassRole",
     "Resource": f"arn:aws:iam::{acct}:role/{stack}-*",
     "Condition": {"StringEquals": {"iam:PassedToService": "lambda.amazonaws.com"}}},
    {"Sid": "Logs", "Effect": "Allow", "Action": "logs:*",
     "Resource": arn("logs", f"log-group:/aws/lambda/{stack}-*")},
    {"Sid": "LogsDescribe", "Effect": "Allow", "Action": "logs:DescribeLogGroups", "Resource": "*"},
    {"Sid": "EventBridge", "Effect": "Allow", "Action": "events:*", "Resource": arn("events", f"rule/{stack}-*")},
    {"Sid": "CloudWatch", "Effect": "Allow",
     "Action": ["cloudwatch:PutDashboard", "cloudwatch:GetDashboard", "cloudwatch:DeleteDashboards", "cloudwatch:ListDashboards",
                "cloudwatch:PutMetricAlarm", "cloudwatch:DeleteAlarms", "cloudwatch:DescribeAlarms",
                "cloudwatch:TagResource", "cloudwatch:UntagResource", "cloudwatch:ListTagsForResource"],
     "Resource": "*"},
    {"Sid": "Sns", "Effect": "Allow", "Action": "sns:*", "Resource": arn("sns", f"{stack}-*")},
    {"Sid": "Budgets", "Effect": "Allow",
     "Action": ["budgets:ViewBudget", "budgets:ModifyBudget", "budgets:TagResource", "budgets:UntagResource",
                "budgets:ListTagsForResource"],
     "Resource": f"arn:aws:budgets::{acct}:budget/{stack}*"},
    {"Sid": "Route53", "Effect": "Allow",
     "Action": ["route53:GetHostedZone", "route53:ChangeResourceRecordSets", "route53:ListResourceRecordSets"],
     "Resource": f"arn:aws:route53:::hostedzone/{zone}"},
    {"Sid": "Route53Read", "Effect": "Allow", "Action": ["route53:GetChange", "acm:DescribeCertificate"], "Resource": "*"},
    {"Sid": "WebsiteList", "Effect": "Allow", "Action": ["s3:ListBucket", "s3:GetBucketLocation"],
     "Resource": f"arn:aws:s3:::{web_bucket}"},
    {"Sid": "WebsiteObjects", "Effect": "Allow", "Action": ["s3:GetObject", "s3:PutObject", "s3:DeleteObject"],
     "Resource": f"arn:aws:s3:::{web_bucket}/*"},
    {"Sid": "CloudFrontInvalidation", "Effect": "Allow",
     "Action": ["cloudfront:CreateInvalidation", "cloudfront:GetInvalidation", "cloudfront:ListInvalidations"],
     "Resource": f"arn:aws:cloudfront::{acct}:distribution/{dist_id}"},
]
doc = {"Version": "2012-10-17", "Statement": statements}
text = json.dumps(doc, separators=(",", ":"))
# IAM managed policy limit: 6144 characters without whitespace.
if len(text) > 6144:
    sys.exit(f"Error: the policy is {len(text)} characters, over the 6144 IAM limit.")
open(out, "w").write(json.dumps(doc, indent=2) + "\n")
print(f"Policy document: {len(statements)} statements, {len(text)}/6144 characters.", file=sys.stderr)
PY

POLICY_ARN="arn:aws:iam::${ACCOUNT_ID}:policy/${POLICY_NAME}"
echo "Policy $POLICY_NAME — stack $STACK ($REGION), artifacts s3://$ARTIFACT_BUCKET/$ARTIFACT_PREFIX, website s3://$WEBSITE_BUCKET, distribution $DISTRIBUTION_ID, zone $HOSTED_ZONE_ID"
if [ "$DRY_RUN" = true ]; then
	cat "$POLICY_FILE"
	echo "Dry run: nothing created."
	exit 0
fi

if aws iam get-policy --policy-arn "$POLICY_ARN" > /dev/null 2>&1; then
	# Max 5 versions: drop the oldest non-default one before adding the new default.
	_versions="$(aws iam list-policy-versions --policy-arn "$POLICY_ARN" \
		--query 'Versions[?IsDefaultVersion==`false`].VersionId' --output text)"
	_count="$(aws iam list-policy-versions --policy-arn "$POLICY_ARN" --query 'length(Versions)' --output text)"
	if [ "$_count" -ge 5 ]; then
		_oldest="$(printf '%s\n' $_versions | sort -V | head -1)"
		echo "Deleting old policy version $_oldest (limit 5)."
		aws iam delete-policy-version --policy-arn "$POLICY_ARN" --version-id "$_oldest"
	fi
	aws iam create-policy-version --policy-arn "$POLICY_ARN" \
		--policy-document "file://$POLICY_FILE" --set-as-default > /dev/null
	echo "Updated $POLICY_ARN (new default version)."
else
	aws iam create-policy --policy-name "$POLICY_NAME" \
		--description "Paths Games - GitHub Actions deploy of the alpha stack and website (v0.42.0)" \
		--policy-document "file://$POLICY_FILE" \
		--tags Key=Name,Value="$POLICY_NAME" Key=CostCenter,Value=Paths.games Key=Environment,Value=alpha \
		Key=ManagedBy,Value=Script Key=Owner,Value=AlNao Key=Project,Value=Paths.games.aws.alpha.serverless > /dev/null
	echo "Created $POLICY_ARN."
fi

if [ -n "$ATTACH_USER" ]; then
	aws iam attach-user-policy --user-name "$ATTACH_USER" --policy-arn "$POLICY_ARN"
	echo "Attached to user $ATTACH_USER."
	if [ "$DETACH_FULL" = true ]; then
		for _full in AmazonS3FullAccess CloudFrontFullAccess; do
			aws iam detach-user-policy --user-name "$ATTACH_USER" --policy-arn "arn:aws:iam::aws:policy/$_full" 2>/dev/null \
				&& echo "Detached $_full from $ATTACH_USER." || echo "$_full was not attached to $ATTACH_USER."
		done
	fi
fi
