"""v0.39.1 — common/test_data_ttl.py: the TTL stamped on the rows Robot runs create."""
import os
from unittest.mock import patch

from common import test_data_ttl


def _env(env='test', hours='1'):
    values = {'ENV': env}
    if hours is not None:
        values['ROBOT_TEST_DATA_TTL_HOURS'] = hours
    return patch.dict(os.environ, values)


def test_hours_is_read_on_dev_and_test():
    for env in ('dev', 'test'):
        with _env(env, '3'):
            assert test_data_ttl.hours() == 3


def test_hours_is_zero_outside_dev_and_test():
    with _env('prod', '5'):
        assert test_data_ttl.hours() == 0


def test_hours_is_zero_when_unset_blank_negative_or_not_a_number():
    with patch.dict(os.environ, {'ENV': 'test'}):
        os.environ.pop('ROBOT_TEST_DATA_TTL_HOURS', None)
        assert test_data_ttl.hours() == 0
    for raw in ('', '-2', 'one', '1.5'):
        with _env('test', raw):
            assert test_data_ttl.hours() == 0, raw


def test_expiry_adds_the_hours_to_now():
    with _env('test', '2'):
        assert test_data_ttl.expiry(now_s=1_000) == 1_000 + 2 * 3600


def test_expiry_defaults_to_the_current_time():
    with _env('test', '1'), patch('common.test_data_ttl.time.time', return_value=500.9):
        assert test_data_ttl.expiry() == 500 + 3600


def test_expiry_is_none_when_disabled():
    with _env('test', '0'):
        assert test_data_ttl.expiry(now_s=1_000) is None
    with _env('prod', '1'):
        assert test_data_ttl.expiry(now_s=1_000) is None


def test_is_robot_name():
    assert test_data_ttl.is_robot_name('robottest_match')
    assert not test_data_ttl.is_robot_name('My run')
    assert not test_data_ttl.is_robot_name(None)


def test_expires():
    assert test_data_ttl.expires({'ttl': 123})
    assert not test_data_ttl.expires({'ttl': None})
    assert not test_data_ttl.expires({'uuid': 'x'})
    assert not test_data_ttl.expires(None)
