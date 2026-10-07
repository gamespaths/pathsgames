"""v0.42.0 — Step 42 stack hardening: template.yaml and template/monitoring.yaml parsed (CloudFormation tags
tolerated), IsPublicStage evaluated per stage: PITR, deletion protection, throttling, monitoring module, tags."""
import json
import re
from pathlib import Path

import pytest
import yaml

AWS_DIR = Path(__file__).resolve().parent.parent
PUBLIC = ['alpha', 'beta', 'prod']
PRIVATE = ['dev', 'test']
FUNCTIONS = ['AdminIpAuthorizer', 'AuthFunction', 'GuestCleanupFunction', 'EchoFunction',
             'ContentFunction', 'MatchFunction', 'StoryFunction', 'SeedFunction']


class _CfnLoader(yaml.SafeLoader):
    """SafeLoader that turns the short intrinsic tags (!Ref, !Sub, !If...) into their long form."""


def _intrinsic(loader, suffix, node):
    if isinstance(node, yaml.ScalarNode):
        value = loader.construct_scalar(node)
    elif isinstance(node, yaml.SequenceNode):
        value = loader.construct_sequence(node, deep=True)
    else:
        value = loader.construct_mapping(node, deep=True)
    if suffix == 'Ref':
        return {'Ref': value}
    if suffix == 'Condition':
        return {'Condition': value}
    if suffix == 'GetAtt' and isinstance(value, str):
        value = value.split('.', 1)
    return {f'Fn::{suffix}': value}


_CfnLoader.add_multi_constructor('!', _intrinsic)


def _load(path):
    return yaml.load(Path(path).read_text(encoding='utf-8'), Loader=_CfnLoader)


@pytest.fixture(scope='module')
def tpl():
    return _load(AWS_DIR / 'template.yaml')


def _params(tpl, **overrides):
    values = {name: str(spec.get('Default', '')) for name, spec in tpl['Parameters'].items()}
    values.update({k: str(v) for k, v in overrides.items()})
    return values


def _value(expr, params):
    if isinstance(expr, dict) and 'Ref' in expr:
        return params[expr['Ref']]
    return expr


def _cond(tpl, expr, params):
    """Evaluates a condition expression (Equals, Or, And, Not, Condition) for the given parameters."""
    if isinstance(expr, str):
        return _cond(tpl, tpl['Conditions'][expr], params)
    (fn, args), = expr.items()
    if fn == 'Condition':
        return _cond(tpl, tpl['Conditions'][args], params)
    if fn == 'Fn::Equals':
        return str(_value(args[0], params)) == str(_value(args[1], params))
    if fn == 'Fn::Or':
        return any(_cond(tpl, a, params) for a in args)
    if fn == 'Fn::And':
        return all(_cond(tpl, a, params) for a in args)
    if fn == 'Fn::Not':
        return not _cond(tpl, args[0], params)
    raise AssertionError(f'unexpected condition function {fn}')


def _resolve_if(tpl, expr, params):
    """The branch an Fn::If picks; None stands for AWS::NoValue."""
    if isinstance(expr, dict) and 'Fn::If' in expr:
        name, yes, no = expr['Fn::If']
        picked = yes if _cond(tpl, name, params) else no
        return None if picked == {'Ref': 'AWS::NoValue'} else picked
    return expr


def _created(tpl, logical_id, params):
    cond = tpl['Resources'][logical_id].get('Condition')
    return True if cond is None else _cond(tpl, cond, params)


def _full_params(tpl, env):
    return _params(tpl, Environment=env, AlarmEmail='ops@example.com', CreateBudget='true',
                   BudgetEmail='ops@example.com')


# ── condition and parameters ─────────────────────────────────────────────

def test_is_public_stage_lists_exactly_alpha_beta_prod(tpl):
    expr = tpl['Conditions']['IsPublicStage']
    stages = sorted(e['Fn::Equals'][1] for e in expr['Fn::Or'])
    assert stages == sorted(PUBLIC)
    for env in tpl['Parameters']['Environment']['AllowedValues']:
        assert _cond(tpl, 'IsPublicStage', _params(tpl, Environment=env)) is (env in PUBLIC)


def test_new_parameters_and_defaults(tpl):
    p = tpl['Parameters']
    assert (p['ApiThrottleRate']['Default'], p['ApiThrottleBurst']['Default']) == (50, 100)
    assert (p['AdminApiThrottleRate']['Default'], p['AdminApiThrottleBurst']['Default']) == (5, 10)
    assert p['AlarmEmail']['Default'] == ''
    assert p['CreateBudget']['Default'] == 'false'
    assert p['CreateBudget']['AllowedValues'] == ['true', 'false']
    assert p['BudgetEmail']['Default'] == ''
    assert 'BudgetLimit' in p


# ── DynamoDB ─────────────────────────────────────────────────────────────

@pytest.mark.parametrize('env', PUBLIC)
def test_public_stage_table_has_pitr_and_deletion_protection(tpl, env):
    props = tpl['Resources']['PathsGamesTable']['Properties']
    params = _params(tpl, Environment=env)
    assert _resolve_if(tpl, props['PointInTimeRecoverySpecification'], params) == {'PointInTimeRecoveryEnabled': True}
    assert _resolve_if(tpl, props['DeletionProtectionEnabled'], params) is True


@pytest.mark.parametrize('env', PRIVATE)
def test_dev_and_test_table_has_neither(tpl, env):
    props = tpl['Resources']['PathsGamesTable']['Properties']
    params = _params(tpl, Environment=env)
    assert _resolve_if(tpl, props['PointInTimeRecoverySpecification'], params) is None
    assert _resolve_if(tpl, props['DeletionProtectionEnabled'], params) is False


# ── API throttling ───────────────────────────────────────────────────────

@pytest.mark.parametrize('stage, rate, burst', [('PathsGamesApiStage', 'ApiThrottleRate', 'ApiThrottleBurst'),
                                                ('PathsGamesAdminApiStage', 'AdminApiThrottleRate', 'AdminApiThrottleBurst')])
def test_both_api_stages_throttle_only_on_public_stages(tpl, stage, rate, burst):
    settings = tpl['Resources'][stage]['Properties']['DefaultRouteSettings']
    for env in PUBLIC:
        picked = _resolve_if(tpl, settings, _params(tpl, Environment=env))
        assert picked == {'ThrottlingRateLimit': {'Ref': rate}, 'ThrottlingBurstLimit': {'Ref': burst}}
    for env in PRIVATE:
        assert _resolve_if(tpl, settings, _params(tpl, Environment=env)) is None


# ── monitoring nested stack (template/monitoring.yaml) ───────────────────

MONITORING = ['MonitoringDashboard', 'AlarmTopic', 'AlarmEmailSubscription', 'LambdaErrorsAlarm',
              'LambdaThrottlesAlarm', 'PublicApi5xxAlarm', 'AdminApi5xxAlarm', 'DynamoDbThrottlesAlarm',
              'MonthlyBudget']
ALARMS = ['LambdaErrorsAlarm', 'LambdaThrottlesAlarm', 'PublicApi5xxAlarm', 'AdminApi5xxAlarm',
          'DynamoDbThrottlesAlarm']
TAG_KEYS = ['Name', 'CostCenter', 'Environment', 'ManagedBy', 'Owner', 'Project', 'version']


@pytest.fixture(scope='module')
def mon():
    return _load(AWS_DIR / 'template' / 'monitoring.yaml')


def _mon_params(mon, **overrides):
    return _params(mon, Environment='alpha', EnvironmentTag='alpha', Version='0.42.0', ApiId='a', AdminApiId='b',
                   TableName='t', **overrides)


def test_root_holds_no_monitoring_resource_only_the_module(tpl):
    assert [r for r in MONITORING if r in tpl['Resources']] == []
    module = tpl['Resources']['MonitoringModule']
    assert module['Type'] == 'AWS::Serverless::Application'
    assert module['Properties']['Location'] == 'template/monitoring.yaml'
    assert module['Condition'] == 'IsPublicStage'
    for name in ('HasAlarms', 'HasBudget', 'HasBudgetEmail'):
        assert name not in tpl['Conditions']


def test_module_receives_ids_and_monitoring_parameters(tpl, mon):
    params = tpl['Resources']['MonitoringModule']['Properties']['Parameters']
    assert params['ApiId'] == {'Ref': 'PathsGamesApi'}
    assert params['AdminApiId'] == {'Ref': 'PathsGamesAdminApi'}
    assert params['TableName'] == {'Ref': 'PathsGamesTable'}
    for name in ('AlarmEmail', 'CreateBudget', 'BudgetLimit', 'BudgetEmail', 'Version', 'Environment'):
        assert params[name] == {'Ref': name}
    assert set(params) == set(mon['Parameters'])


@pytest.mark.parametrize('env', PRIVATE)
def test_dev_and_test_get_no_monitoring_even_with_every_parameter_set(tpl, env):
    params = _full_params(tpl, env)
    assert not _created(tpl, 'MonitoringModule', params)
    assert not _cond(tpl, tpl['Outputs']['DashboardUrl']['Condition'], params)


@pytest.mark.parametrize('env', PUBLIC)
def test_public_stages_get_everything_with_email_and_budget(tpl, mon, env):
    assert _created(tpl, 'MonitoringModule', _full_params(tpl, env))
    params = _mon_params(mon, AlarmEmail='ops@example.com', CreateBudget='true', BudgetEmail='ops@example.com')
    assert [r for r in MONITORING if not _created(mon, r, params)] == []


def test_alarms_need_the_email_dashboard_does_not(mon):
    params = _mon_params(mon)
    assert _created(mon, 'MonitoringDashboard', params)
    assert 'Condition' not in mon['Resources']['MonitoringDashboard']
    for logical_id in MONITORING[1:-1]:
        assert mon['Resources'][logical_id]['Condition'] == 'HasAlarms'
        assert not _created(mon, logical_id, params)


def test_budget_only_when_create_budget_is_true(mon):
    assert not _created(mon, 'MonthlyBudget', _mon_params(mon))
    assert _created(mon, 'MonthlyBudget', _mon_params(mon, CreateBudget='true'))
    assert mon['Resources']['MonthlyBudget']['Condition'] == 'HasBudget'


def test_budget_filters_on_the_project_tag_of_stack_and_websites(tpl, mon):
    budget = mon['Resources']['MonthlyBudget']['Properties']['Budget']
    assert budget['BudgetName'] == {'Fn::Sub': 'pathsgames-${Environment}-monthly'}
    assert budget['BudgetLimit']['Amount'] == {'Ref': 'BudgetLimit'}
    stack_tag, websites_tag = budget['CostFilters']['TagKeyValue']
    prefix, project = stack_tag['Fn::Join'][1]
    assert prefix == 'user:Project$'
    assert project == {'Fn::Sub': 'Paths.games.aws.${EnvironmentTag}.serverless'}
    assert tpl['Mappings']['EnvironmentTags']['alpha']['Project'] == 'Paths.games.aws.alpha.serverless'
    assert websites_tag == 'user:Project$Paths.games.aws.websites'
    notes = mon['Resources']['MonthlyBudget']['Properties']['NotificationsWithSubscribers']
    assert _resolve_if(mon, notes, _mon_params(mon)) is None
    picked = _resolve_if(mon, notes, _mon_params(mon, BudgetEmail='a@b.c'))
    assert [n['Subscribers'][0]['Address'] for n in picked] == [{'Ref': 'BudgetEmail'}] * 2


def test_project_tag_of_the_module_matches_the_root_mapping(tpl):
    for env, row in tpl['Mappings']['EnvironmentTags'].items():
        assert row['Project'] == f"Paths.games.aws.{row['Name']}.serverless", env


def _nested_function_names():
    names = {'AdminIpAuthorizer'}
    for path in (AWS_DIR / 'template').glob('*.yaml'):
        for res in _load(path)['Resources'].values():
            if res.get('Type') == 'AWS::Serverless::Function':
                names.add(res['Properties']['FunctionName']['Fn::Sub'].split('-')[-1])
    return names


@pytest.mark.parametrize('logical_id, metric', [('LambdaErrorsAlarm', 'Errors'), ('LambdaThrottlesAlarm', 'Throttles')])
def test_lambda_alarms_sum_the_metric_over_all_eight_functions(mon, logical_id, metric):
    assert sorted(_nested_function_names()) == sorted(FUNCTIONS)
    metrics = mon['Resources'][logical_id]['Properties']['Metrics']
    expression = [m for m in metrics if 'Expression' in m]
    assert len(expression) == 1 and expression[0]['Expression'] == 'SUM(METRICS())'
    stats = [m['MetricStat']['Metric'] for m in metrics if 'MetricStat' in m]
    assert {s['MetricName'] for s in stats} == {metric}
    names = sorted(s['Dimensions'][0]['Value']['Fn::Sub'] for s in stats)
    assert names == sorted(f'pathsgames-${{Environment}}-{f}' for f in FUNCTIONS)


@pytest.mark.parametrize('logical_id, api', [('PublicApi5xxAlarm', 'ApiId'), ('AdminApi5xxAlarm', 'AdminApiId')])
def test_api_5xx_alarm_per_api(mon, logical_id, api):
    props = mon['Resources'][logical_id]['Properties']
    assert (props['Namespace'], props['MetricName']) == ('AWS/ApiGateway', '5xx')
    assert props['Dimensions'][0] == {'Name': 'ApiId', 'Value': {'Ref': api}}
    assert props['AlarmActions'] == [{'Ref': 'AlarmTopic'}]


def test_dynamodb_throttle_alarm_reads_the_table(mon):
    metrics = mon['Resources']['DynamoDbThrottlesAlarm']['Properties']['Metrics']
    stats = [m['MetricStat']['Metric'] for m in metrics if 'MetricStat' in m]
    assert {s['MetricName'] for s in stats} == {'ReadThrottleEvents', 'WriteThrottleEvents'}
    assert all(s['Dimensions'][0]['Value'] == {'Ref': 'TableName'} for s in stats)


def test_subscription_uses_the_alarm_email(mon):
    props = mon['Resources']['AlarmEmailSubscription']['Properties']
    assert props == {'TopicArn': {'Ref': 'AlarmTopic'}, 'Protocol': 'email', 'Endpoint': {'Ref': 'AlarmEmail'}}


def test_dashboard_body_is_json_with_lambda_api_and_dynamodb_widgets(mon):
    body = mon['Resources']['MonitoringDashboard']['Properties']['DashboardBody']['Fn::Sub']
    rendered = re.sub(r'\$\{[^}]+\}', 'X', body)
    widgets = json.loads(rendered)['widgets']
    text = json.dumps(widgets)
    for metric in ['Invocations', 'Errors', 'Throttles', 'Duration', 'ConcurrentExecutions', 'Count', '4xx',
                   '5xx', 'Latency', 'ConsumedReadCapacityUnits', 'ConsumedWriteCapacityUnits',
                   'ReadThrottleEvents', 'WriteThrottleEvents', 'SystemErrors']:
        assert f'"{metric}' in text or f'\\"{metric}\\"' in text, metric
    assert '${ApiId}' in body and '${AdminApiId}' in body and '${TableName}' in body
    for fn in FUNCTIONS:
        assert body.count(f'pathsgames-${{Environment}}-{fn}"') == 5


def test_dashboard_url_output_comes_from_the_module(tpl, mon):
    assert tpl['Outputs']['DashboardUrl']['Value'] == {'Fn::GetAtt': ['MonitoringModule', 'Outputs.DashboardUrl']}
    assert 'pathsgames-${Environment}' in mon['Outputs']['DashboardUrl']['Value']['Fn::Sub']


# ── tags: every taggable monitoring resource carries the project tag set ─

def _tag_keys(rows):
    return [row['Key'] for row in rows]


@pytest.mark.parametrize('logical_id', ['AlarmTopic'] + ALARMS)
def test_topic_and_alarms_carry_every_tag(mon, logical_id):
    rows = mon['Resources'][logical_id]['Properties']['Tags']
    assert _tag_keys(rows) == TAG_KEYS
    values = {row['Key']: row['Value'] for row in rows}
    assert values['Environment'] == {'Ref': 'EnvironmentTag'}
    assert values['Project'] == {'Fn::Sub': 'Paths.games.aws.${EnvironmentTag}.serverless'}
    assert values['version'] == {'Ref': 'Version'}
    name = mon['Resources'][logical_id]['Properties'].get('AlarmName') or mon['Resources'][logical_id]['Properties']['TopicName']
    assert values['Name'] == name


def test_budget_carries_every_tag_as_resource_tags(mon):
    rows = mon['Resources']['MonthlyBudget']['Properties']['ResourceTags']
    assert _tag_keys(rows) == TAG_KEYS
    assert rows[0]['Value'] == mon['Resources']['MonthlyBudget']['Properties']['Budget']['BudgetName']


def test_module_itself_is_tagged(tpl):
    tags = tpl['Resources']['MonitoringModule']['Properties']['Tags']
    assert sorted(tags) == sorted(TAG_KEYS)
    assert tags['Project'] == {'Fn::FindInMap': ['EnvironmentTags', {'Ref': 'Environment'}, 'Project']}


def test_untaggable_types_are_the_only_ones_without_tags(mon):
    untaggable = {'AWS::CloudWatch::Dashboard', 'AWS::SNS::Subscription'}
    for logical_id, res in mon['Resources'].items():
        props = res.get('Properties') or {}
        if res['Type'] in untaggable:
            continue
        assert 'Tags' in props or 'ResourceTags' in props, logical_id


# ── naming (IAM policy pathsgames-alpha*) ────────────────────────────────

@pytest.mark.parametrize('logical_id, path', [
    ('MonitoringDashboard', ['DashboardName']), ('AlarmTopic', ['TopicName']),
    ('LambdaErrorsAlarm', ['AlarmName']), ('LambdaThrottlesAlarm', ['AlarmName']),
    ('PublicApi5xxAlarm', ['AlarmName']), ('AdminApi5xxAlarm', ['AlarmName']),
    ('DynamoDbThrottlesAlarm', ['AlarmName']), ('MonthlyBudget', ['Budget', 'BudgetName'])])
def test_names_start_with_the_stack_prefix(mon, logical_id, path):
    value = mon['Resources'][logical_id]['Properties']
    for key in path:
        value = value[key]
    assert value['Fn::Sub'].startswith('pathsgames-${Environment}')
