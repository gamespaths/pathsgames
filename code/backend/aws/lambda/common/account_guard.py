"""v1.7.0 step 10 — banned-subject hashes (mirror of SubjectHasher.java / AccountGuardService.java): HMAC-SHA256 of
the Google sub and of the email with the stage pepper, items BANSUB#<hash> and BANEMAIL#<hash>; no personal data."""
import hashlib
import hmac
import os

from common import db_utils

DEFAULT_PEPPER = 'PathsGamesDevBannedSubjectPepper2026'


def pepper():
    value = (os.environ.get('BANNED_SUBJECT_PEPPER') or '').strip()
    return value or DEFAULT_PEPPER


def misconfigured():
    """True on a non dev/test stack with the committed (or blank) pepper."""
    from common import test_data_ttl
    if test_data_ttl.is_test_env():
        return False
    return pepper() == DEFAULT_PEPPER


def misconfigured_response():
    from common.response import err
    return err(500, 'MISCONFIGURED', 'Server misconfigured: banned-subject pepper not set for this environment')


def _hmac(value):
    return hmac.new(pepper().encode('utf-8'), value.encode('utf-8'), hashlib.sha256).hexdigest()


def hash_subject(sub):
    return _hmac(str(sub).strip()) if sub and str(sub).strip() else None


def hash_email(email):
    return _hmac(str(email).strip().lower()) if email and str(email).strip() else None


def is_banned(sub, email):
    hs, he = hash_subject(sub), hash_email(email)
    return bool((hs and db_utils.get_item(f'BANSUB#{hs}', consistent=False))
                or (he and db_utils.get_item(f'BANEMAIL#{he}', consistent=False)))


def store(user_uuid, sub, email):
    """Conditional puts (a hash already stored for another user is kept); answers what this user owns."""
    owned = {}
    for kind, value in (('BANSUB', hash_subject(sub)), ('BANEMAIL', hash_email(email))):
        if value and db_utils.put_item_if_absent({'PK': f'{kind}#{value}', 'SK': 'METADATA',
                                                  'user_uuid': user_uuid}):
            owned[kind] = value
    return owned


def remove(owned):
    for kind, value in (owned or {}).items():
        db_utils.delete_item(f'{kind}#{value}')
