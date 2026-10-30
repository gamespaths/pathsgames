"""v1.2.0 Google ID token verification: PyJWT + PyJWKClient (keys cached in the warm container, no client
secret) and the test-only fake provider (HS256, kid paths-games-fake-google), only with the test endpoints."""
import hashlib
import hmac
import os
import time
import uuid as uuid_lib

GOOGLE_JWKS_URL = 'https://www.googleapis.com/oauth2/v3/certs'
GOOGLE_ISSUERS = ('accounts.google.com', 'https://accounts.google.com')
FAKE_KID = 'paths-games-fake-google'
DEV_CLIENT_ID = 'paths-games-dev.apps.googleusercontent.com'
_JWKS = None


class VerifyError(Exception):
    """INVALID_TOKEN or PROVIDER_UNAVAILABLE."""

    def __init__(self, code, message):
        super().__init__(message)
        self.code, self.message = code, message


def client_id():
    return (os.environ.get('GOOGLE_CLIENT_ID') or '').strip() or DEV_CLIENT_ID


def enabled():
    """GOOGLE_ENABLED (code default true): false only on test, for trials."""
    return os.environ.get('GOOGLE_ENABLED', 'true').strip().lower() not in ('false', '0', 'no')


def fake_enabled():
    from common import test_data_ttl
    return test_data_ttl.is_test_env()


def _secret():
    from common import jwt_utils
    return jwt_utils.JWT_SECRET


def fake_key(secret=None):
    """HMAC-SHA256(jwtSecret, "paths-games-fake-google"): the same on Java, Python and AWS."""
    return hmac.new((secret or _secret()).encode('utf-8'), FAKE_KID.encode('utf-8'), hashlib.sha256).digest()


def claims_of(payload):
    aud = payload.get('aud')
    if isinstance(aud, list):
        aud = aud[0] if aud else None
    return {'sub': payload.get('sub'), 'email': payload.get('email'),
            'email_verified': payload.get('email_verified') in (True, 'true'), 'name': payload.get('name'),
            'given_name': payload.get('given_name'), 'family_name': payload.get('family_name'),
            'picture': payload.get('picture'), 'locale': payload.get('locale'), 'nonce': payload.get('nonce'),
            'iss': payload.get('iss'), 'aud': aud, 'exp': int(payload.get('exp') or 0),
            'iat': int(payload.get('iat') or 0)}


def _int(value, fallback):
    try:
        return int(value)
    except (TypeError, ValueError):
        return fallback


def mint_fake(claims):
    """A fake ID token: claims not given default to iss Google, aud = client id, exp now + 1 h."""
    import jwt
    if not fake_enabled():
        raise VerifyError('DEV_ENDPOINTS_DISABLED', 'The fake Google provider is disabled')
    c = dict(claims or {})
    now = int(time.time())
    c['iat'] = now + _int(c.pop('iatOffsetSeconds', 0), 0)
    c['exp'] = now + _int(c.pop('expOffsetSeconds', 3600), 3600)
    c.setdefault('iss', 'https://accounts.google.com')
    c.setdefault('aud', client_id())
    c.setdefault('email_verified', True)
    # each minted token is unique, as Google's are (the replay check keys on the token hash)
    c.setdefault('jti', str(uuid_lib.uuid4()))
    return jwt.encode(c, fake_key(), algorithm='HS256', headers={'kid': FAKE_KID})


def is_fake(id_token):
    import jwt
    if not id_token:
        return False
    try:
        return jwt.get_unverified_header(id_token).get('kid') == FAKE_KID
    except jwt.PyJWTError:
        return False


def _jwks():
    global _JWKS
    if _JWKS is None:
        import jwt
        _JWKS = jwt.PyJWKClient(GOOGLE_JWKS_URL, cache_keys=True, lifespan=3600)
    return _JWKS


def verify(id_token):
    """The claims of a valid token (signature and, for Google tokens, aud/iss/exp); raises VerifyError."""
    import jwt
    if not id_token:
        raise VerifyError('INVALID_TOKEN', 'The Google token is malformed')
    if is_fake(id_token):
        if not fake_enabled():
            raise VerifyError('INVALID_TOKEN', 'Unknown Google token key')
        try:
            return claims_of(jwt.decode(id_token, fake_key(), algorithms=['HS256'], options={'verify_aud': False}))
        except jwt.PyJWTError:
            raise VerifyError('INVALID_TOKEN', 'The Google token is invalid or expired')
    try:
        key = _jwks().get_signing_key_from_jwt(id_token)
    except jwt.PyJWKClientConnectionError:
        raise VerifyError('PROVIDER_UNAVAILABLE', 'Google keys are not reachable')
    except jwt.PyJWTError:
        raise VerifyError('INVALID_TOKEN', 'The Google token is malformed')
    try:
        payload = jwt.decode(id_token, key.key, algorithms=['RS256'], audience=client_id(),
                             issuer=list(GOOGLE_ISSUERS), leeway=60)
    except jwt.PyJWTError:
        raise VerifyError('INVALID_TOKEN', 'The Google token is invalid or expired')
    return claims_of(payload)
