"""v0.41.6 — common/user_lookup: resolution uuid -> email -> username, ambiguity, state, expiry, view."""
from unittest.mock import MagicMock, patch

import pytest
from botocore.exceptions import ClientError

from common import db_utils
from common import user_lookup as ul
from helpers import FakeTable, patch_table

UUID_B = '11111111-2222-3333-4444-555555555555'
NOW = 1_800_000_000_000


def _user(uuid, username, **over):
    base = {'PK': f'USER#{uuid}', 'SK': 'METADATA', 'uuid': uuid, 'username': username, 'role': 'PLAYER',
            'state': 6, 'is_guest': True}
    base.update(over)
    return base


def _table():
    return FakeTable([
        _user('old', 'alice', email='Alice@X.it'),
        _user(UUID_B, 'bob', email='dup@x.it', guest_expires_at=NOW + 1000),
        _user('c', 'carl', email='DUP@x.it', state=2, is_guest=False),
        _user('d', 'twin'), _user('e', 'twin'),
        {'PK': 'MATCH#m1', 'SK': 'METADATA', 'GSI1_PK': f'USER_MATCHES#{UUID_B}'},
    ])


def _resolve(identifier):
    with patch_table(_table(), module='common.user_lookup'):
        return ul.resolve(identifier)


def test_resolution_order():
    assert _resolve(f' {UUID_B} ')['username'] == 'bob'
    assert _resolve('alice@x.IT')['username'] == 'alice'
    assert _resolve('carl')['uuid'] == 'c'
    assert _resolve('alice')['uuid'] == 'old'


def test_a_uuid_miss_falls_back_and_a_fake_uuid_is_no_uuid():
    table = _table()
    table.put_item(_user('x', '99999999-2222-3333-4444-555555555555'))
    with patch_table(table, module='common.user_lookup'):
        assert ul.resolve('99999999-2222-3333-4444-555555555555')['uuid'] == 'x'
    assert not ul._is_uuid('zzzzzzzz-zzzz-zzzz-zzzz-zzzzzzzzzzzz')
    assert not ul._is_uuid('1-1-1-1-1')


@pytest.mark.parametrize('identifier, status, code', [
    ('', 404, 'USER_NOT_FOUND'), ('ghost', 404, 'USER_NOT_FOUND'),
    ('dup@x.it', 409, 'USER_AMBIGUOUS'), ('twin', 409, 'USER_AMBIGUOUS')])
def test_resolution_errors(identifier, status, code):
    with pytest.raises(ul.UserLookupError) as err:
        _resolve(identifier)
    assert (err.value.status, err.value.code) == (status, code)


def test_state_expiry_and_reason():
    assert ul.state_of({'is_guest': True}) == 6 and ul.state_of({}) == 1 and ul.state_of({'state': 'x'}) == 1
    assert not ul.is_expired({'state': 6}, NOW)
    assert ul.is_expired({'state': 6, 'guest_expires_at': NOW - 1}, NOW)
    assert not ul.is_expired({'state': 2, 'guest_expires_at': NOW - 1}, NOW)
    assert ul.reason({'state': 2}, NOW) is None
    assert ul.reason({'state': 6, 'guest_expires_at': NOW + 1}, NOW) is None
    assert ul.reason({'state': 2, 'role': 'admin'}, NOW) == 'USER_NOT_ALLOWED'
    for state in (1, 3, 4, 5):
        assert ul.reason({'state': state}, NOW) == 'USER_NOT_ALLOWED'
    assert ul.reason({'state': 6, 'guest_expires_at': NOW - 1}, NOW) == 'USER_EXPIRED'
    assert ul.is_expired({'state': 6, 'guest_expires_at': 1})


def test_view_and_match_count():
    item = _user(UUID_B, 'bob', email='b@x.it', guest_expires_at=NOW - 1000, ts_registration=NOW - 5000,
                 ts_last_access=NOW - 2000)
    with patch_table(_table(), module='common.user_lookup'):
        body = ul.view(item, now_ms=NOW)
        assert ul.match_count(None) == 0
    assert body['matchCount'] == 1 and body['guest'] is True and body['expired'] is True
    assert body['eligible'] is False and body['reason'] == 'USER_EXPIRED'
    assert body['guestExpiresAt'].endswith('Z') and body['tsLastAccess'] and body['tsRegistration']
    imported = ul.view({'uuid': 'i', 'username': 'imp', 'state': 6}, count=0, now_ms=NOW)
    assert imported['guestExpiresAt'] is None and imported['eligible'] is True and imported['role'] == 'PLAYER'
    assert ul._iso('bad') is None and ul.by_uuid(None) is None


def test_db_utils_scans_and_count(monkeypatch):
    table = MagicMock()
    table.scan.side_effect = [
        {'Items': [{'PK': 'USER#b', 'SK': 'METADATA', 'email': 'A@x.it', 'username': 'u'}], 'LastEvaluatedKey': {'k': 1}},
        {'Items': [{'PK': 'USER#a', 'SK': 'METADATA', 'email': 'a@x.it ', 'username': 'v'}]},
        {'Items': [{'PK': 'USER#c', 'SK': 'METADATA', 'username': 'u'}]},
    ]
    table.query.side_effect = [{'Count': 2, 'LastEvaluatedKey': {'k': 1}}, {'Count': 3}]
    monkeypatch.setattr(db_utils, '_table', table)
    assert [i['PK'] for i in db_utils.find_users_by_email(' a@X.it')] == ['USER#a', 'USER#b']
    assert [i['PK'] for i in db_utils.find_users_by_username('u')] == ['USER#c']
    assert db_utils.find_users_by_email('') == [] and db_utils.find_users_by_username(' ') == []
    assert db_utils.count_gsi('GSI1', 'USER_MATCHES#x') == 5
    assert table.query.call_args.kwargs['Select'] == 'COUNT'


def test_db_utils_read_errors_answer_empty(monkeypatch):
    error = ClientError({'Error': {'Code': 'X', 'Message': 'down'}}, 'op')
    table = MagicMock()
    table.scan.side_effect = error
    table.query.side_effect = error
    monkeypatch.setattr(db_utils, '_table', table)
    assert db_utils.find_users_by_username('u') == []
    assert db_utils.count_gsi('GSI2', 'x') == 0
