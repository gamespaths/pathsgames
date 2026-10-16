"""v1.1.0 — V1 step 1: SNS message of a failed smoke run; no topic on test = log only;
an SNS error is logged and the run still fails with its own check."""
import json
import sys
import types

import pytest

from smoke import client, handler, inprocess, notify, ttl

SUMMARY = {'result': 'FAIL', 'env': 'alpha', 'failedCheck': 'join', 'httpStatus': 409, 'steps': []}


class FakeSns:
    def __init__(self, error=None):
        self.error = error
        self.calls = []

    def publish(self, **kwargs):
        if self.error:
            raise self.error
        self.calls.append(kwargs)


def test_subject_and_body_when_the_topic_is_set():
    sns = FakeSns()
    assert notify.publish('arn:t', SUMMARY, '/aws/lambda/pathsgames-alpha-SmokeTestFunction', sns) is True
    call, = sns.calls
    assert call['TopicArn'] == 'arn:t'
    assert call['Subject'] == '[pathsgames-alpha] smoke test FAILED: join'
    body = call['Message']
    assert json.loads(body.split('\n\nCloudWatch')[0]) == SUMMARY
    assert body.rstrip().endswith('CloudWatch log group: /aws/lambda/pathsgames-alpha-SmokeTestFunction')


def test_subject_is_ascii_and_at_most_100_chars():
    text = notify.subject('alpha', 'città-' + 'x' * 200)
    assert len(text) == 100 and text.isascii() and 'citt?' in text


def test_nothing_published_without_a_topic(capsys):
    sns = FakeSns()
    assert notify.publish('', SUMMARY, 'g', sns) is False
    assert sns.calls == []
    assert 'SMOKE_NOTIFY_SKIPPED' in capsys.readouterr().out


def test_sns_error_is_logged_not_raised(capsys):
    assert notify.publish('arn:t', SUMMARY, 'g', FakeSns(RuntimeError('denied'))) is False
    assert 'SMOKE_NOTIFY_FAILED' in capsys.readouterr().out


def test_default_client_comes_from_boto3(monkeypatch):
    sns = FakeSns()
    fake_boto3 = types.SimpleNamespace(client=lambda name: sns if name == 'sns' else None)
    monkeypatch.setitem(sys.modules, 'boto3', fake_boto3)
    assert notify.publish('arn:t', SUMMARY, 'g') is True
    assert len(sns.calls) == 1


def test_sns_error_keeps_the_original_failed_check(monkeypatch):
    monkeypatch.setenv('SMOKE_API_BASE_URL', 'https://api')
    monkeypatch.setenv('SMOKE_WEBSITE_URL', '')
    monkeypatch.setenv('SMOKE_ALARM_TOPIC_ARN', 'arn:t')
    monkeypatch.setenv('ENV', 'alpha')
    monkeypatch.setenv('APP_VERSION', '1.0.0')
    monkeypatch.setattr(client, 'request', lambda *a, **k: client.Response(503, None, '', 5))
    monkeypatch.setattr(inprocess, 'create_match', lambda *a: (201, {'uuid': 'm'}))
    monkeypatch.setattr(ttl, 'apply', lambda *a: {})
    fake_boto3 = types.SimpleNamespace(client=lambda name: FakeSns(RuntimeError('denied')))
    monkeypatch.setitem(sys.modules, 'boto3', fake_boto3)
    with pytest.raises(handler.SmokeTestFailed) as info:
        handler.lambda_handler({}, None)
    assert json.loads(str(info.value))['failedCheck'] == 'echo'
