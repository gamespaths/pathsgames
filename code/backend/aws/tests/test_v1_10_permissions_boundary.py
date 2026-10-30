"""v1.10.0 — the optional IAM permissions boundary on every Lambda and scheduler role, wired from template.yaml."""
import pytest

from test_step42_template_hardening import AWS_DIR, _load

NESTED = ['echo', 'auth', 'story', 'match', 'content', 'seed', 'smoke']
BOUNDARY = {'Fn::If': ['HasPermissionsBoundary', {'Ref': 'PermissionsBoundaryArn'}, {'Ref': 'AWS::NoValue'}]}


def _functions(tpl):
    return {k: v for k, v in tpl['Resources'].items() if v['Type'] == 'AWS::Serverless::Function'}


@pytest.mark.parametrize('name', NESTED)
def test_every_function_and_schedule_of_a_module_gets_the_boundary(name):
    tpl = _load(AWS_DIR / 'template' / f'{name}.yaml')
    assert tpl['Parameters']['PermissionsBoundaryArn']['Default'] == ''
    assert tpl['Conditions']['HasPermissionsBoundary'] == {'Fn::Not': [{'Fn::Equals': [
        {'Ref': 'PermissionsBoundaryArn'}, '']}]}
    functions = _functions(tpl)
    assert functions
    for fn in functions.values():
        assert fn['Properties']['PermissionsBoundary'] == BOUNDARY
        for event in (fn['Properties'].get('Events') or {}).values():
            if event['Type'] == 'ScheduleV2':
                assert event['Properties']['PermissionsBoundary'] == BOUNDARY


def test_the_root_passes_the_boundary_to_every_module_with_functions():
    tpl = _load(AWS_DIR / 'template.yaml')
    assert tpl['Parameters']['PermissionsBoundaryArn']['Default'] == ''
    assert _functions(tpl)['AdminIpAuthorizerFunction']['Properties']['PermissionsBoundary'] == BOUNDARY
    modules = {k: v for k, v in tpl['Resources'].items() if v['Type'] == 'AWS::Serverless::Application'}
    for key, module in modules.items():
        params = module['Properties']['Parameters']
        if module['Properties']['Location'] == 'template/monitoring.yaml':
            assert 'PermissionsBoundaryArn' not in params  # no role in the monitoring stack
        else:
            assert params['PermissionsBoundaryArn'] == {'Ref': 'PermissionsBoundaryArn'}, key
