"""v1.1.0 — SNS message of a failed smoke run (public stages); no topic (test stage) = log line only.
An SNS error is logged and never hides the test result."""
import json

SUBJECT_MAX = 100


def subject(env, failed_check):
    text = f'[pathsgames-{env}] smoke test FAILED: {failed_check}'
    text = ''.join(ch if 32 <= ord(ch) < 127 else '?' for ch in text)
    return text[:SUBJECT_MAX]


def message(summary, log_group):
    return json.dumps(summary, indent=2, sort_keys=True, default=str) + f'\n\nCloudWatch log group: {log_group}\n'


def publish(topic_arn, summary, log_group, sns_client=None):
    if not topic_arn:
        print(json.dumps({'level': 'INFO', 'event': 'SMOKE_NOTIFY_SKIPPED', 'reason': 'no SMOKE_ALARM_TOPIC_ARN'}))
        return False
    try:
        if sns_client is None:
            import boto3
            sns_client = boto3.client('sns')
        sns_client.publish(TopicArn=topic_arn, Subject=subject(summary.get('env'), summary.get('failedCheck')),
                           Message=message(summary, log_group))
        return True
    except Exception as exc:  # noqa: BLE001 - the run must still fail with its own check
        print(json.dumps({'level': 'ERROR', 'event': 'SMOKE_NOTIFY_FAILED', 'error': f'{type(exc).__name__}: {exc}'}))
        return False
