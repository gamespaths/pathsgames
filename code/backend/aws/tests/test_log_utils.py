"""v0.38.1 — botocore.credentials is raised to WARNING by every handler at import."""
import logging
import os
import subprocess
import sys

import pytest

from common import log_utils


@pytest.fixture(autouse=True)
def reset_noisy_loggers():
    for name in log_utils.NOISY_LOGGERS:
        logging.getLogger(name).setLevel(logging.NOTSET)
    yield
    for name in log_utils.NOISY_LOGGERS:
        logging.getLogger(name).setLevel(logging.NOTSET)


def test_quiet_botocore_raises_only_the_noisy_loggers():
    logging.getLogger('botocore').setLevel(logging.NOTSET)
    log_utils.quiet_botocore()
    assert logging.getLogger('botocore.credentials').level == logging.WARNING
    # siblings and the root logger are left alone: application INFO still flows
    assert logging.getLogger('botocore').level == logging.NOTSET
    assert logging.getLogger('botocore.credentials').getEffectiveLevel() == logging.WARNING
    assert not logging.getLogger('botocore.credentials').isEnabledFor(logging.INFO)


def test_quiet_botocore_takes_a_custom_level_and_is_idempotent():
    log_utils.quiet_botocore(logging.ERROR)
    log_utils.quiet_botocore(logging.ERROR)
    assert logging.getLogger('botocore.credentials').level == logging.ERROR


@pytest.mark.parametrize('module', [
    'auth.handler', 'authorizer.handler', 'content.handler', 'echo.handler',
    'match.handler', 'seed.handler', 'story.handler',
])
def test_every_handler_quiets_botocore_on_import(module):
    # A fresh interpreter per handler: reloading in-process would reset module state other tests rely on.
    code = (f"import logging, {module}; "
            "print(logging.getLogger('botocore.credentials').level)")
    env = dict(os.environ, PYTHONPATH=os.path.join(os.path.dirname(__file__), '..', 'lambda'))
    out = subprocess.run([sys.executable, '-c', code], capture_output=True, text=True, env=env, check=True)
    assert out.stdout.strip() == str(logging.WARNING)
