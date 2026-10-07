# run python script purge_robot_test_data.py to purge test data from AWS DynamoDB (--dry to only look)

PROJECT_ROOT="$(cd "$(dirname "$0")/../../../.." && pwd)"
python3 "$PROJECT_ROOT/code/scripts/dev/aws/purge_robot_test_data.py" "$@"
