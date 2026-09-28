"""v0.39.1 — DynamoDB TTL on the rows Robot runs create, so they expire without a paid delete.
Only ENV dev/test honour ROBOT_TEST_DATA_TTL_HOURS; 0, unset or any other ENV = never expire."""
import os
import time

ROBOT_TEST_MARKER = 'robottest'
TTL_ATTRIBUTE = 'ttl'
TEST_ENVS = ('dev', 'development', 'test')  # v0.41.0 — the env rule of every backend


def is_test_env(env=None):
    """True on dev/test, anything else is production; an unset ENV reads 'dev' as elsewhere."""
    value = os.environ.get('ENV', 'dev') if env is None else env
    return str(value or '').strip().lower() in TEST_ENVS


def hours():
    """The configured lifetime in hours; 0 when disabled or outside dev/test."""
    if os.environ.get('ENV', 'dev') not in TEST_ENVS:
        return 0
    try:
        return max(0, int(os.environ.get('ROBOT_TEST_DATA_TTL_HOURS') or 0))
    except ValueError:
        return 0


def expiry(now_s=None):
    """Epoch seconds the row expires at, or None when the feature is off."""
    lifetime = hours()
    if lifetime <= 0:
        return None
    return int(time.time() if now_s is None else now_s) + lifetime * 3600


def is_robot_name(name):
    return str(name or '').startswith(ROBOT_TEST_MARKER)


def expires(item):
    """True when the row carries a TTL, i.e. DynamoDB removes it on its own."""
    return bool(item) and item.get(TTL_ATTRIBUTE) is not None
