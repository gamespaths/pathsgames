#!/usr/bin/env bash
# v1.2.0 — admin bootstrap on the Java backend: creates (or finds again) a real admin user and prints user and token.
# Usage: create_admin_java.sh <local|ec2> <nickname>; the token goes to stdout only, never to a file or a log.
set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
TARGET="${1:-}"
NICKNAME="${2:-}"
if [ -z "$TARGET" ] || [ -z "$NICKNAME" ]; then
	echo "Usage: $0 <local|ec2> <nickname>" >&2
	exit 2
fi
if [ -f "$PROJECT_ROOT/.env" ]; then
	set -a; . "$PROJECT_ROOT/.env"; set +a
fi

case "$TARGET" in
	local)
		JAVA_DIR="$PROJECT_ROOT/code/backend/java"
		JAR="$(ls "$JAVA_DIR"/ms-launcher/target/ms-launcher-*.jar 2>/dev/null | grep -v original | head -1 || true)"
		if [ -z "$JAR" ]; then
			echo "Building the launcher (mvn -q -DskipTests install) ..." >&2
			(cd "$JAVA_DIR" && mvn -q -DskipTests install) >&2
			JAR="$(ls "$JAVA_DIR"/ms-launcher/target/ms-launcher-*.jar | grep -v original | head -1)"
		fi
		java -jar "$JAR" --paths.admin.create="$NICKNAME" | grep '^ADMIN_'
		;;
	ec2)
		REGION="${AWS_TEST_REGION:-us-east-2}"
		INSTANCE="${AWS_TEST_EC2_INSTANCE_NAME:-api-test-server2}"
		KEY_NAME="${AWS_TEST_EC2_KEY_NAME:-paths-games-ohio}"
		KEY_PATH="${AWS_TEST_EC2_KEY_PATH:-$HOME/.ssh/${KEY_NAME}.pem}"
		IP="$(aws ec2 describe-instances --region "$REGION" \
			--filters "Name=tag:Name,Values=$INSTANCE" "Name=instance-state-name,Values=running" \
			--query 'Reservations[0].Instances[0].PublicIpAddress' --output text)"
		if [ -z "$IP" ] || [ "$IP" = "None" ]; then
			echo "Error: no running instance named '$INSTANCE' in $REGION." >&2
			exit 1
		fi
		ssh -i "$KEY_PATH" -o StrictHostKeyChecking=accept-new "ubuntu@$IP" \
			"sudo docker exec pathsgames-backend java -jar app.jar --paths.admin.create='$NICKNAME'" | grep '^ADMIN_'
		;;
	*)
		echo "Error: target must be local or ec2 (got '$TARGET')." >&2
		exit 2
		;;
esac
