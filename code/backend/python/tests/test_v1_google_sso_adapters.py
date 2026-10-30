"""v1.2.0 Google SSO adapters: Google verifier and fake provider, JWT iss/aud, identity and merge persistence
on SQLite, schema alignment, account jobs scheduler and the admin bootstrap CLI."""
import io
import time
from types import SimpleNamespace
from unittest.mock import MagicMock

import jwt
import pytest
from cryptography.hazmat.primitives.asymmetric import rsa
from sqlalchemy import create_engine, inspect, text
from sqlalchemy.orm import sessionmaker

import app.adapters.persistence.match.models  # noqa: F401  - tables the users FKs need
import app.adapters.persistence.story.models  # noqa: F401
from app.adapters.auth.google_verifier import (FAKE_KID, FakeGoogleTokens, GoogleIdTokenVerifier, _claims,
                                               derive_fake_key)
from app.adapters.auth.jwt_adapter import JwtAdapter
from app.adapters.persistence import database
from app.adapters.persistence.auth.guest_merge_persistence_adapter import GuestMergePersistenceAdapter
from app.adapters.persistence.auth.identity_persistence_adapter import IdentityPersistenceAdapter, field_of
from app.adapters.persistence.auth.models import Base, User, UserToken
from app.adapters.persistence.match.models import GamingCharacterInstanceEntity, GamingMatchEntity
from app.adapters.scheduler import account_jobs_scheduler
from app.core.models.auth.auth_error import AuthError
from app.core.models.auth.identity import DuplicateUserError, NewUser, UserIdentity

SECRET = "PathsGamesDevSecret2026_MustBeAtLeast32Chars!"
CLIENT = "client.apps.googleusercontent.com"


# ── fake provider and Google verifier ──────────────────────────────────────

def test_fake_tokens_round_trip_and_overrides():
    fake = FakeGoogleTokens(True, CLIENT, SECRET)
    token = fake.mint({"sub": "s", "email": "m@gmail.com", "nonce": "n", "expOffsetSeconds": "120",
                       "iatOffsetSeconds": -10})
    assert FakeGoogleTokens.is_fake(token)
    c = fake.verify(token)
    assert c.subject == "s" and c.audience == CLIENT and c.issuer == "https://accounts.google.com"
    assert c.email_verified and c.nonce == "n" and c.expires_at > c.issued_at
    other = fake.verify(fake.mint({"sub": "s", "aud": "other", "iss": "evil", "email_verified": False,
                                   "expOffsetSeconds": "x"}))
    assert other.audience == "other" and other.issuer == "evil" and not other.email_verified
    with pytest.raises(AuthError):
        fake.verify(fake.mint({"sub": "s", "expOffsetSeconds": -120}))
    with pytest.raises(AuthError):
        fake.verify("a.b.c")
    assert fake.mint(None)


def test_fake_provider_is_off_without_the_test_endpoints():
    token = FakeGoogleTokens(True, CLIENT, SECRET).mint({"sub": "s"})
    off = FakeGoogleTokens(False, CLIENT, SECRET)
    with pytest.raises(RuntimeError):
        off.mint({})
    with pytest.raises(AuthError):
        off.verify(token)
    with pytest.raises(AuthError):
        FakeGoogleTokens(True, CLIENT, SECRET + "-other").verify(token)
    assert len(derive_fake_key(SECRET)) == 32
    assert not FakeGoogleTokens.is_fake(None) and not FakeGoogleTokens.is_fake("garbage")


def _rsa_token(claims, key):
    return jwt.encode(claims, key, algorithm="RS256", headers={"kid": "google-kid"})


def _google_claims(**kw):
    now = int(time.time())
    c = {"iss": "https://accounts.google.com", "aud": CLIENT, "sub": "sub-1", "email": "m@gmail.com",
         "email_verified": True, "given_name": "Mario", "exp": now + 600, "iat": now}
    c.update(kw)
    return c


def test_google_verifier_with_the_cached_jwks():
    private = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    jwks = MagicMock()
    jwks.get_signing_key_from_jwt.return_value = SimpleNamespace(key=private.public_key())
    verifier = GoogleIdTokenVerifier(CLIENT, None, jwks)
    assert verifier.client_id() == CLIENT
    assert verifier.verify(_rsa_token(_google_claims(), private)).given_name == "Mario"
    for bad in (_google_claims(aud="other"), _google_claims(iss="evil"), _google_claims(exp=int(time.time()) - 600)):
        with pytest.raises(AuthError) as e:
            verifier.verify(_rsa_token(bad, private))
        assert e.value.code == "INVALID_TOKEN"
    with pytest.raises(AuthError):
        verifier.verify("")
    jwks.get_signing_key_from_jwt.side_effect = jwt.PyJWKClientConnectionError("down")
    with pytest.raises(AuthError) as e:
        verifier.verify("x.y.z")
    assert e.value.code == "PROVIDER_UNAVAILABLE"
    jwks.get_signing_key_from_jwt.side_effect = jwt.DecodeError("bad")
    with pytest.raises(AuthError) as e:
        verifier.verify("x.y.z")
    assert e.value.code == "INVALID_TOKEN"


def test_google_verifier_routes_fake_tokens_and_builds_its_client():
    fake = FakeGoogleTokens(True, CLIENT, SECRET)
    verifier = GoogleIdTokenVerifier(CLIENT, fake)
    assert verifier.verify(fake.mint({"sub": "s"})).subject == "s"
    assert isinstance(verifier.jwks, jwt.PyJWKClient)
    assert _claims({"aud": [], "exp": None}).audience is None
    assert _claims({"aud": ["a", "b"]}).audience == "a"
    assert FAKE_KID == "paths-games-fake-google"


# ── JWT iss / aud ───────────────────────────────────────────────────────────

def test_jwt_issuer_and_audience_are_required():
    java_like = JwtAdapter(SECRET, 30, 7, "pathsgames-dev-java")
    python = JwtAdapter(SECRET, 30, 7)
    access = python.generate_access_token("u", "n", "PLAYER")
    assert python.validate_token(access) and python.validate_token(python.generate_refresh_token("u"))
    assert not java_like.validate_token(access)
    with pytest.raises(ValueError):
        java_like.parse_token(access)
    legacy = jwt.encode({"sub": "u", "type": "access", "exp": int(time.time()) + 60}, SECRET, algorithm="HS256")
    assert not python.validate_token(legacy)
    admin = python.generate_access_token("u", "admin_x", "ADMIN", lifetime_seconds=365 * 86400)
    assert python.parse_token(admin).exp > time.time() + 364 * 86400


# ── identity and merge persistence ──────────────────────────────────────────

@pytest.fixture
def db():
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(engine)
    return sessionmaker(bind=engine)


def _new(adapter, uuid, nickname, email):
    identity = None if email is None else UserIdentity(None, None, "GOOGLE", "sub-" + uuid, email, "M R", "M", "R",
                                                       "pic", "it", "t")
    return adapter.create_user(NewUser(uuid, "google_" + uuid[:8], nickname, email, "PLAYER", 2, "en"), identity)


def test_identity_persistence(db):
    a = IdentityPersistenceAdapter(db)
    user_id = _new(a, "11111111-a", "mario", "Mario@Gmail.com")
    found = a.find_identity_by_email("GOOGLE", "MARIO@gmail.com")
    assert found.user_id == user_id and found.email == "mario@gmail.com"
    assert a.find_identity_by_email("GOOGLE", None) is None
    assert a.find_user_by_uuid("11111111-a").nickname == "mario"
    assert a.find_user_by_uuid(None) is None
    assert a.find_user_by_email("mario@gmail.com").id == user_id and a.find_user_by_email(None) is None
    assert a.find_user_by_nickname("mario").id == user_id and a.find_user_by_id(user_id) is not None
    assert a.nickname_exists("mario") and not a.nickname_exists("luigi")
    a.update_identity_profile(found.id, UserIdentity(None, None, "GOOGLE", "x", "x", "L", "Luigi", "V", "p2", "en",
                                                     "t2"))
    a.update_identity_profile(999, found)
    assert a.find_identities_of_user(user_id)[0].given_name == "Luigi"
    a.update_last_access(user_id)
    a.update_state(user_id, 7)
    assert a.find_user_ids_by_state(7, 10) == [user_id]


def test_identity_persistence_unique_clashes(db):
    a = IdentityPersistenceAdapter(db)
    _new(a, "22222222-a", "mario", "mario@gmail.com")
    with pytest.raises(DuplicateUserError) as e:
        _new(a, "33333333-a", "mario", "other@gmail.com")
    assert e.value.field == "nickname"
    with pytest.raises(DuplicateUserError) as e:
        _new(a, "44444444-a", "luigi", "mario@gmail.com")
    assert e.value.field == "email"
    admin = _new(a, "55555555-a", "boss", None)
    with pytest.raises(DuplicateUserError):
        a.create_identity(admin, UserIdentity(None, None, "GOOGLE", "s", "mario@gmail.com"))
    a.create_identity(admin, UserIdentity(None, None, "GOOGLE", "s2", "boss@gmail.com"))
    assert field_of(Exception("x")) == "other"


def test_replay_store_retention_and_full_delete(db):
    a = IdentityPersistenceAdapter(db)
    assert a.mark_id_token_seen("h1", "2020-01-01T00:00:00+00:00")
    assert not a.mark_id_token_seen("h1", "2020-01-01T00:00:00+00:00")
    assert a.mark_id_token_seen("h2", "2999-01-01T00:00:00+00:00")
    assert a.delete_expired_id_tokens("2026-01-01T00:00:00+00:00") == 1
    idle = _new(a, "66666666-a", "robottest.idle", "idle@gmail.com")
    fresh = _new(a, "77777777-a", "fresh", "fresh@gmail.com")
    with db() as session:
        session.query(User).filter(User.id == idle).update({"last_access": "2020-01-01T00:00:00+00:00"})
        session.add(UserToken(id_user=idle, refresh_token="h", expires_at="2999"))
        session.commit()
    assert a.find_inactive_identity_user_ids("2024-01-01T00:00:00+00:00", 10) == [idle]
    assert a.find_non_guest_user_ids_by_nickname_like("robottest%") == [idle]
    a.delete_user_fully(idle)
    assert a.find_user_by_id(idle) is None and a.find_user_by_id(fresh) is not None


def test_guest_merge_persistence(db):
    a = IdentityPersistenceAdapter(db)
    target = _new(a, "88888888-a", "mario", "mario@gmail.com")
    with db() as session:
        session.execute(text("INSERT INTO list_stories (id, uuid) VALUES (1, 's-1')"))
        guest = User(uuid="g-900", username="guest_900", nickname="guest_900", role="PLAYER", state=6)
        session.add(guest)
        session.flush()
        session.add(UserToken(id_user=guest.id, refresh_token="h", expires_at="2999"))
        for mid, owner, ts in ((100, guest.id, "2026-10-02T00:00:00Z"), (101, target, "2026-10-01T00:00:00Z")):
            session.add(GamingMatchEntity(id=mid, uuid=f"m-{mid}", id_story=1, id_difficulty=1, status="RUNNING",
                                          id_user_creator=owner, ts_insert=ts, ts_update=ts))
        session.add(GamingCharacterInstanceEntity(id=1, id_match=100, uuid="c-1", id_user=guest.id,
                                                  id_character_template=1, ts_insert="t", ts_update="t"))
        session.commit()
        guest_id = guest.id
    m = GuestMergePersistenceAdapter(db)
    assert [x.uuid for x in m.matches_of_user(guest_id)] == ["m-100"]
    assert m.apply_merge(guest_id, target, [101], "2026-10-19T00:00:00+00:00") == 1
    with db() as session:
        moved = session.query(GamingMatchEntity).filter(GamingMatchEntity.id == 100).one()
        assert moved.id_user_creator == target and moved.ts_update == "2026-10-02T00:00:00Z"
        assert session.query(GamingMatchEntity).filter(GamingMatchEntity.id == 101).one().status == "CANCELLED"
        assert session.query(User).filter(User.id == guest_id).count() == 0
        assert session.query(UserToken).filter(UserToken.id_user == guest_id).count() == 0
    assert m.apply_merge(999, target, [], "t") == 0


# ── schema alignment ────────────────────────────────────────────────────────

def test_align_schema_drops_the_password_columns_and_adds_the_v120_bits():
    engine = create_engine("sqlite:///:memory:")
    with engine.begin() as c:
        c.execute(text("CREATE TABLE users (id INTEGER, state INTEGER, last_access TEXT, email_address TEXT,"
                       " nickname TEXT, password_hash TEXT, google_id_sso TEXT)"))
        c.execute(text("CREATE INDEX idx_users_google_sso ON users (google_id_sso)"))
        c.execute(text("CREATE TABLE users_tokens (id INTEGER, refresh_token TEXT)"))
        c.execute(text("INSERT INTO users (id, nickname) VALUES (1, 'twin'), (2, 'twin')"))
    applied = database.align_schema(engine)
    assert "DROP INDEX IF EXISTS idx_users_google_sso" in applied
    columns = {c["name"] for c in inspect(engine).get_columns("users")}
    assert "password_hash" not in columns and "google_id_sso" not in columns
    assert "ts_rotated" in {c["name"] for c in inspect(engine).get_columns("users_tokens")}
    assert "uq_users_nickname" in {i["name"] for i in inspect(engine).get_indexes("users")}
    with engine.begin() as c:
        assert [r[0] for r in c.execute(text("SELECT nickname FROM users ORDER BY id"))] == ["twin", "twin#2"]
    assert database.align_schema(engine) == []


# ── jobs and CLI ────────────────────────────────────────────────────────────

def test_account_jobs_scheduler():
    service = MagicMock()
    service.run_deletion_job.return_value = 2
    service.retire_inactive_users.return_value = 1
    assert account_jobs_scheduler.run_deletion(service) == 2
    assert account_jobs_scheduler.run_retention(service) == 1
    assert account_jobs_scheduler.start_account_jobs(service, SimpleNamespace(account_jobs_enabled=False)) is None
    scheduler = MagicMock()
    started = account_jobs_scheduler.start_account_jobs(service, SimpleNamespace(account_jobs_enabled=True),
                                                        lambda timezone: scheduler)
    assert started is scheduler and scheduler.add_job.call_count == 2
    scheduler.start.assert_called_once()


def test_create_admin_cli(monkeypatch):
    from app.scripts import create_admin
    import app.launcher as launcher
    from app.core.models.auth.identity import AdminBootstrapResult
    fake = MagicMock()
    fake.create_admin.return_value = AdminBootstrapResult("uuid-1", "admin_uuid1", "owner", True, "signed", 0)
    monkeypatch.setattr(launcher, "admin_bootstrap_service", fake)
    out = io.StringIO()
    assert create_admin.main(["owner"], out) == 0
    assert "ADMIN_TOKEN=signed" in out.getvalue() and "ADMIN_USER_UUID=uuid-1" in out.getvalue()
    assert create_admin.main([], out) == 2
    fake.create_admin.side_effect = AuthError("NICKNAME_TAKEN", "taken")
    assert create_admin.main(["mario"], out) == 1
