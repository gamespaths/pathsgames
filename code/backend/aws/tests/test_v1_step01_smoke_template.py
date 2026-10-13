"""v1.1.0 — V1 step 1: template/smoke.yaml and its wiring in template.yaml / monitoring.yaml / samconfig.toml
(condition per stage, schedule, tags, alarms, env without Turnstile secrets, free-tier limits)."""
import json
import re
import tomllib

import pytest

from test_step42_template_hardening import AWS_DIR, ALARMS, TAG_KEYS, _cond, _created, _load, _params, _resolve_if

STAGES = ['test', 'alpha', 'beta', 'prod']
SMOKE_ONLY_ENV = {'SMOKE_API_BASE_URL', 'SMOKE_WEBSITE_URL', 'SMOKE_TTL_DAYS', 'SMOKE_LATENCY_WARN_MS',
                  'SMOKE_ALARM_TOPIC_ARN', 'TURNSTILE_ENABLED'}
SMOKE_ALARMS = ['SmokeTestFailedAlarm', 'SmokeTestMissingAlarm']


@pytest.fixture(scope='module')
def tpl():
    return _load(AWS_DIR / 'template.yaml')


@pytest.fixture(scope='module')
def smoke():
    return _load(AWS_DIR / 'template' / 'smoke.yaml')


@pytest.fixture(scope='module')
def mon():
    return _load(AWS_DIR / 'template' / 'monitoring.yaml')


def _smoke_params(smoke, **overrides):
    base = dict(Environment='alpha', EnvironmentTag='alpha', Version='1.0.0', TableName='t', ApiBaseUrl='https://a')
    base.update(overrides)
    return _params(smoke, **base)


def _fn(smoke):
    return smoke['Resources']['SmokeTestFunction']['Properties']


def _event(smoke):
    return _fn(smoke)['Events']['DailySmokeTest']['Properties']


# ── root stack ───────────────────────────────────────────────────────────

@pytest.mark.parametrize('env, expected', [('dev', False)] + [(s, True) for s in STAGES])
def test_has_smoke_test_on_test_and_public_stages_only(tpl, env, expected):
    params = _params(tpl, Environment=env)
    assert _cond(tpl, 'HasSmokeTest', params) is expected
    assert _created(tpl, 'SmokeModule', params) is expected
    assert _cond(tpl, tpl['Outputs']['SmokeTestFunctionName']['Condition'], params) is expected


def test_root_parameters_and_defaults(tpl):
    p = tpl['Parameters']
    assert (p['SmokeTestEnabled']['Default'], p['SmokeTestEnabled']['AllowedValues']) == ('true', ['true', 'false'])
    assert p['SmokeTestSchedule']['Default'] == 'cron(42 4 * * ? *)'
    assert (p['SmokeTestTtlDays']['Default'], p['SmokeTestWebsiteUrl']['Default']) == ('7', '')
    assert p['SmokeTestLatencyWarnMs']['Default'] == '5000'


# Java-style full match, as CloudFormation applies AllowedPattern.
@pytest.mark.parametrize('value, allowed', [
    ('', True), ('https://paths.games', True), ('https://test.paths.games/', True),
    ('test.paths.games/', False), ('http://test.paths.games', False), ('https://', False),
    ('https://test paths', False),
])
def test_website_url_must_be_empty_or_https(tpl, smoke, value, allowed):
    for doc in (tpl, smoke):
        pattern = doc['Parameters']['SmokeTestWebsiteUrl']['AllowedPattern']
        assert bool(re.fullmatch(pattern, value)) is allowed


def test_module_location_dependencies_and_tags(tpl):
    module = tpl['Resources']['SmokeModule']
    assert module['Type'] == 'AWS::Serverless::Application'
    assert module['Properties']['Location'] == 'template/smoke.yaml'
    assert module['DependsOn'] == ['EchoModule', 'AuthModule', 'StoryModule', 'MatchModule']
    assert sorted(module['Properties']['Tags']) == sorted(TAG_KEYS)


def test_module_parameters_match_the_nested_stack_and_carry_no_turnstile_secret(tpl, smoke):
    params = tpl['Resources']['SmokeModule']['Properties']['Parameters']
    assert set(params) == set(smoke['Parameters'])
    assert 'TurnstileSecretKey' not in params and 'TurnstileBypassToken' not in params
    assert 'TurnstileSecretKey' not in json.dumps(params) and 'TurnstileBypassToken' not in json.dumps(params)
    assert params['JwtSecret'] == {'Ref': 'JwtSecret'}
    for name in ('SmokeTestEnabled', 'SmokeTestSchedule', 'SmokeTestTtlDays', 'SmokeTestWebsiteUrl',
                 'SmokeTestLatencyWarnMs', 'CsrfEnforced', 'AllowMockAccess', 'RateLimitMatchPerIp'):
        assert params[name] == {'Ref': name}


def test_module_api_base_url_alarm_topic_and_turnstile_flag(tpl):
    params = tpl['Resources']['SmokeModule']['Properties']['Parameters']
    custom = _resolve_if(tpl, params['ApiBaseUrl'], _params(tpl, Environment='alpha', CustomDomainName='api.x'))
    assert custom == {'Fn::Sub': 'https://${CustomDomainName}'}
    default = _resolve_if(tpl, params['ApiBaseUrl'], _params(tpl, Environment='test'))
    assert default == {'Fn::Sub': 'https://${PathsGamesApi}.execute-api.${AWS::Region}.amazonaws.com/${Environment}'}
    assert _resolve_if(tpl, params['AlarmTopicArn'], _params(tpl, Environment='test')) == ''
    assert _resolve_if(tpl, params['AlarmTopicArn'], _params(tpl, Environment='alpha')) == {
        'Fn::GetAtt': ['MonitoringModule', 'Outputs.AlarmTopicArn']}
    assert _resolve_if(tpl, params['TurnstileEnabled'], _params(tpl, Environment='alpha')) == 'false'
    assert _resolve_if(tpl, params['TurnstileEnabled'], _params(tpl, Environment='alpha', TurnstileSecretKey='s')) == 'true'


def test_output_function_name_comes_from_the_module(tpl, smoke):
    assert tpl['Outputs']['SmokeTestFunctionName']['Value'] == {
        'Fn::GetAtt': ['SmokeModule', 'Outputs.SmokeTestFunctionName']}
    assert smoke['Outputs']['SmokeTestFunctionName']['Value'] == {'Ref': 'SmokeTestFunction'}


def test_samconfig_alpha_checks_the_website_beta_and_prod_do_not():
    cfg = tomllib.loads((AWS_DIR / 'samconfig.toml').read_text(encoding='utf-8'))
    overrides = {env: cfg[env]['deploy']['parameters']['parameter_overrides'] for env in ('alpha', 'beta', 'prod')}
    assert 'SmokeTestWebsiteUrl=https://paths.games' in overrides['alpha'].split()
    assert 'SmokeTestWebsiteUrl' not in overrides['beta'] and 'SmokeTestWebsiteUrl' not in overrides['prod']


# ── nested stack: function, schedule ─────────────────────────────────────

def test_function_shape(smoke):
    fn = _fn(smoke)
    assert fn['FunctionName'] == {'Fn::Sub': 'pathsgames-${Environment}-SmokeTestFunction'}
    assert (fn['Runtime'], fn['Architectures'], fn['Handler']) == ('python3.13', ['arm64'], 'smoke.handler.lambda_handler')
    assert (fn['Timeout'], fn['MemorySize'], fn['CodeUri']) == (180, 512, '../lambda/')
    assert fn['LoggingConfig'] == {'LogFormat': 'JSON', 'SystemLogLevel': {'Ref': 'LambdaSystemLogLevel'},
                                   'ApplicationLogLevel': 'INFO'}
    assert fn['PropagateTags'] is True
    assert fn['EventInvokeConfig'] == {'MaximumRetryAttempts': 0}
    assert (AWS_DIR / 'lambda' / 'smoke' / 'handler.py').exists()


def test_function_is_not_reachable_from_api_gateway(smoke):
    types = {res['Type'] for res in smoke['Resources'].values()}
    assert 'AWS::Lambda::Permission' not in types
    assert not any(t.startswith('AWS::ApiGatewayV2') for t in types)
    assert [e['Type'] for e in _fn(smoke)['Events'].values()] == ['ScheduleV2']


def test_schedule_daily_utc_no_retry(smoke):
    event = _event(smoke)
    assert event['Name'] == {'Fn::Sub': 'pathsgames-${Environment}-smoke-test-daily'}
    assert event['GroupName'] == {'Ref': 'SmokeTestScheduleGroup'}
    assert event['ScheduleExpression'] == {'Ref': 'SmokeTestSchedule'}
    assert smoke['Parameters']['SmokeTestSchedule']['Default'] == 'cron(42 4 * * ? *)'
    assert event['ScheduleExpressionTimezone'] == 'UTC'
    assert event['FlexibleTimeWindow'] == {'Mode': 'OFF'}
    assert event['RetryPolicy'] == {'MaximumRetryAttempts': 0}
    assert json.loads(event['Input']) == {'trigger': 'schedule'}
    group = smoke['Resources']['SmokeTestScheduleGroup']
    assert group['Type'] == 'AWS::Scheduler::ScheduleGroup'
    assert group['Properties']['Name'] == {'Fn::Sub': 'pathsgames-${Environment}-smoke-test'}


@pytest.mark.parametrize('enabled, state', [('true', 'ENABLED'), ('false', 'DISABLED')])
def test_schedule_state_follows_smoke_test_enabled(smoke, enabled, state):
    assert _resolve_if(smoke, _event(smoke)['State'], _smoke_params(smoke, SmokeTestEnabled=enabled)) == state


def test_sns_publish_only_with_a_topic(smoke):
    policies = _fn(smoke)['Policies']
    assert policies[0] == {'DynamoDBCrudPolicy': {'TableName': {'Ref': 'TableName'}}}
    assert _resolve_if(smoke, policies[1], _smoke_params(smoke)) is None
    picked = _resolve_if(smoke, policies[1], _smoke_params(smoke, AlarmTopicArn='arn:t'))
    statement, = picked['Statement']
    assert (statement['Action'], statement['Resource']) == ('sns:Publish', {'Ref': 'AlarmTopicArn'})


def test_env_equals_match_function_env_without_turnstile_secrets(smoke):
    match_env = _load(AWS_DIR / 'template' / 'match.yaml')['Resources']['MatchFunction']['Properties'][
        'Environment']['Variables']
    smoke_env = _fn(smoke)['Environment']['Variables']
    expected = {k: v for k, v in match_env.items() if k not in ('TURNSTILE_SECRET_KEY', 'TURNSTILE_BYPASS_TOKEN')}
    assert {k: v for k, v in smoke_env.items() if k not in SMOKE_ONLY_ENV} == expected
    assert SMOKE_ONLY_ENV <= set(smoke_env)
    assert 'TURNSTILE_SECRET_KEY' not in smoke_env and 'TURNSTILE_BYPASS_TOKEN' not in smoke_env
    assert smoke_env['TURNSTILE_ENABLED'] == {'Ref': 'TurnstileEnabled'}
    assert smoke_env['SMOKE_API_BASE_URL'] == {'Ref': 'ApiBaseUrl'}
    assert smoke_env['SMOKE_ALARM_TOPIC_ARN'] == {'Ref': 'AlarmTopicArn'}


# ── alarms ───────────────────────────────────────────────────────────────

@pytest.mark.parametrize('enabled, topic, created', [('true', 'arn:t', True), ('false', 'arn:t', False),
                                                     ('true', '', False)])
def test_alarms_need_the_schedule_and_a_topic(smoke, enabled, topic, created):
    params = _smoke_params(smoke, SmokeTestEnabled=enabled, AlarmTopicArn=topic)
    for logical_id in SMOKE_ALARMS:
        assert smoke['Resources'][logical_id]['Condition'] == 'HasSmokeAlarms'
        assert _created(smoke, logical_id, params) is created


@pytest.mark.parametrize('logical_id, metric, operator, missing, name', [
    ('SmokeTestFailedAlarm', 'Errors', 'GreaterThanOrEqualToThreshold', 'notBreaching', 'smoke-failed'),
    ('SmokeTestMissingAlarm', 'Invocations', 'LessThanThreshold', 'breaching', 'smoke-missing')])
def test_alarm_definition(smoke, logical_id, metric, operator, missing, name):
    props = smoke['Resources'][logical_id]['Properties']
    assert props['AlarmName'] == {'Fn::Sub': f'pathsgames-${{Environment}}-{name}'}
    assert (props['Namespace'], props['MetricName'], props['Statistic']) == ('AWS/Lambda', metric, 'Sum')
    assert props['Dimensions'] == [{'Name': 'FunctionName', 'Value': {'Ref': 'SmokeTestFunction'}}]
    assert (props['Period'], props['EvaluationPeriods'], props['Threshold']) == (86400, 1, 1)
    assert (props['ComparisonOperator'], props['TreatMissingData']) == (operator, missing)
    assert props['AlarmActions'] == [{'Ref': 'AlarmTopicArn'}]


def test_total_alarm_metrics_stay_inside_the_ten_free(mon, smoke):
    def count(props):
        return len([m for m in props['Metrics'] if 'MetricStat' in m]) if 'Metrics' in props else 1
    total = sum(count(mon['Resources'][a]['Properties']) for a in ALARMS)
    total += sum(count(smoke['Resources'][a]['Properties']) for a in SMOKE_ALARMS)
    assert total == 8 and total <= 10


# ── tags ─────────────────────────────────────────────────────────────────

@pytest.mark.parametrize('logical_id', ['SmokeTestLogGroup', 'SmokeTestScheduleGroup'] + SMOKE_ALARMS)
def test_list_tagged_resources_carry_the_seven_tags(smoke, logical_id):
    rows = smoke['Resources'][logical_id]['Properties']['Tags']
    assert [r['Key'] for r in rows] == TAG_KEYS
    values = {r['Key']: r['Value'] for r in rows}
    assert values['Environment'] == {'Ref': 'EnvironmentTag'}
    assert values['Project'] == {'Fn::Sub': 'Paths.games.aws.${EnvironmentTag}.serverless'}
    assert values['version'] == {'Ref': 'Version'}


def test_function_carries_the_seven_tags(smoke):
    tags = _fn(smoke)['Tags']
    assert list(tags) == TAG_KEYS
    assert tags['Name'] == _fn(smoke)['FunctionName']


def test_log_group_name_and_retention(smoke):
    props = smoke['Resources']['SmokeTestLogGroup']['Properties']
    assert props['LogGroupName'] == {'Fn::Sub': '/aws/lambda/pathsgames-${Environment}-SmokeTestFunction'}
    assert props['RetentionInDays'] == 14
    assert smoke['Resources']['SmokeTestLogGroup']['DeletionPolicy'] == 'Delete'
    assert smoke['Resources']['SmokeTestFunction']['DependsOn'] == 'SmokeTestLogGroup'


# ── monitoring ───────────────────────────────────────────────────────────

def test_alarm_topic_arn_output_is_always_present(mon):
    output = mon['Outputs']['AlarmTopicArn']
    assert 'Condition' not in output
    assert output['Value'] == {'Fn::If': ['HasAlarms', {'Ref': 'AlarmTopic'}, '']}


def test_dashboard_has_the_smoke_function_and_stays_under_fifty_metrics(mon):
    body = mon['Resources']['MonitoringDashboard']['Properties']['DashboardBody']['Fn::Sub']
    assert body.count('pathsgames-${Environment}-SmokeTestFunction"') == 3
    widgets = json.loads(re.sub(r'\$\{[^}]+\}', 'X', body))['widgets']
    total = sum(len(w['properties']['metrics']) for w in widgets)
    assert total == 45 and total <= 50
