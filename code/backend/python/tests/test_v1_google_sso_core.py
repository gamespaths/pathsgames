"""v1.2.0 Google SSO core (mirror of the Java core tests): models, hasher, nicknames, merge, state cache,
login checks, account deletion, admin bootstrap, log sanitizer."""
from datetime import datetime, timedelta, timezone
from unittest.mock import MagicMock

import pytest

from app.core.models.auth.auth_error import AuthError, UserStates
from app.core.models.auth.identity import (AdminBootstrapResult, AuthenticatedSession, DuplicateUserError,
                                           GoogleIdentityClaims, MatchOwnership, MergeResult, NewUser, UserIdentity,
                                           UserProfile, UserStatus, display_name_of)
from app.core.services.auth import nickname_generator, token_hasher
from app.core.services.auth.account_service import AccountService, months_ago
from app.core.services.auth.admin_bootstrap_service import AdminBootstrapService
from app.core.services.auth.google_login_service import GoogleLoginService, check_claims, language
from app.core.services.auth.guest_merge_service import GuestMergeService, epoch_millis, matches_to_cancel
from app.core.services.auth.user_state_service import UserStateService
from app.core.services.security import log_sanitizer

NOW = datetime(2026, 10, 19, 10, 0, tzinfo=timezone.utc)
CLIENT = "client.apps.googleusercontent.com"


def claims(sub="sub-1", email="Mario.Rossi+x@Gmail.com", verified=True, aud=CLIENT,
           iss="https://accounts.google.com", exp=None, nonce="nonce", iat=None):
    return GoogleIdentityClaims(sub, email, verified, "Mario Rossi", "Mario", "Rossi", "pic", "it-IT", nonce, iss,
                                aud, exp if exp is not None else int(NOW.timestamp()) + 600,
                                iat if iat is not None else int(NOW.timestamp()))


# ── models ──────────────────────────────────────────────────────────────────

def test_auth_error_codes_and_states():
    e = AuthError("IDENTITY_MISMATCH", "support")
    assert e.http_status == 409 and e.body()["error"] == "IDENTITY_MISMATCH"
    assert AuthError("UNKNOWN", "x").http_status == 400
    UserStates.require_usable(2)
    for state, code in ((3, "ACCOUNT_DISABLED"), (4, "ACCOUNT_DISABLED"), (7, "ACCOUNT_DELETION_IN_PROGRESS")):
        with pytest.raises(AuthError) as err:
            UserStates.require_usable(state)
        assert err.value.code == code


def test_display_name_and_profile():
    both = UserIdentity.from_google(claims(), "m@gmail.com", "t")
    assert display_name_of(both, "nick") == "Mario Rossi"
    only_name = UserIdentity(None, None, "GOOGLE", "s", "e", " Full ", None, " ")
    assert display_name_of(only_name, "nick") == "Full"
    assert display_name_of(UserIdentity(None, None, "GOOGLE", "s", "e"), "nick") == "nick"
    assert display_name_of(None, "nick") == "nick"
    player = UserStatus(1, "u", "google_x", "mario", "PLAYER", 2, "it")
    profile = UserProfile.of(player, both)
    assert profile.account_type == "GOOGLE" and profile.to_body()["pictureUrl"] == "pic"
    assert UserProfile.of(UserStatus(2, "g", "guest_x", "guest_x", "PLAYER", 6), None).account_type == "GUEST"
    assert UserProfile.of(UserStatus(3, "a", "admin_x", "boss", "ADMIN", 2), None).account_type == "INTERNAL"
    assert UserStatus(3, "a", "admin_x", "boss", "ADMIN", 2).is_admin


def test_reprs_never_carry_personal_data():
    objects = [claims(), UserIdentity.from_google(claims(), "mario@gmail.com", "t"),
               NewUser("u", "google_x", "mario", "mario@gmail.com", "PLAYER", 2, "en"),
               UserProfile("u", "g", "m", "Mario Rossi", "p", "PLAYER", 2, "en", "GOOGLE"),
               AuthenticatedSession(UserProfile("u", "g", "m", "Mario Rossi", "p", "PLAYER", 2, "en", "GOOGLE"),
                                    "secret-access", "r", 1, 2, True, None, 0),
               AdminBootstrapResult("u", "admin_x", "boss", True, "secret-token", 1)]
    for o in objects:
        text = repr(o)
        assert "gmail" not in text.lower() and "Rossi" not in text and "secret" not in text
    assert DuplicateUserError("email").field == "email"
    assert MergeResult().moved_matches == 0


# ── hasher and nicknames ────────────────────────────────────────────────────

def test_hasher():
    assert token_hasher.sha256("hello") == "2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824"
    assert token_hasher.sha256(None) is None
    assert token_hasher.legacy("c", NOW) == "c"
    assert token_hasher.legacy("c", token_hasher.LEGACY_FALLBACK_UNTIL) is None
    assert token_hasher.legacy("c") in ("c", None)


def test_nicknames():
    assert nickname_generator.base("Mario.Rossi+games@gmail.com") == "mario.rossi"
    assert nickname_generator.base(None) == "player"
    assert nickname_generator.base("+tag@gmail.com") == "player"
    assert len(nickname_generator.base("a" * 120 + "@gmail.com")) == 90
    taken = {"mario", "mario#2"}
    assert nickname_generator.first_free("mario", 1, taken.__contains__, "12345678") == "mario#3"
    assert nickname_generator.first_free("mario", 1, lambda n: True, "12345678-x") == "mario#12345678"


# ── merge ───────────────────────────────────────────────────────────────────

def test_merge_keeps_the_latest_started_match_per_story():
    port = MagicMock()
    port.matches_of_user.side_effect = lambda uid: {
        2: [MatchOwnership(10, "a", 1, "RUNNING", "2026-10-01T10:00:00Z"), MatchOwnership(11, "b", 2, "ENDED", None)],
        5: [MatchOwnership(20, "c", 1, "PAUSED", "2026-10-02 09:00:00"), MatchOwnership(21, "d", 2, "CREATED", None)],
    }[uid]
    port.apply_merge.return_value = 2
    result = GuestMergeService(port).merge(5, 2)
    assert result.moved_matches == 2 and result.cancelled_match_ids == [10]
    assert GuestMergeService(port).merge(3, 3).moved_matches == 0


def test_merge_ties_and_timestamps():
    assert matches_to_cancel([MatchOwnership(7, "a", 1, "RUNNING", None),
                              MatchOwnership(9, "b", 1, "CREATED", "garbage")]) == [7]
    assert epoch_millis(None) == 0 and epoch_millis("nope") == 0
    assert epoch_millis("2026-10-01 10:00:00") == epoch_millis("2026-10-01T10:00:00Z")
    assert epoch_millis("2026-10-01T12:00:00+02:00") == epoch_millis("2026-10-01T10:00:00Z")


# ── state cache ─────────────────────────────────────────────────────────────

def test_user_state_cache():
    clock = [100.0]
    port = MagicMock()
    port.find_user_by_uuid.return_value = UserStatus(1, "u", "n", "n", "PLAYER", 2)
    svc = UserStateService(port, 60, lambda: clock[0])
    assert svc.current("u").uuid == "u"
    clock[0] += 59
    svc.current("u")
    assert port.find_user_by_uuid.call_count == 1
    clock[0] += 2
    svc.current("u")
    assert port.find_user_by_uuid.call_count == 2
    svc.evict("u")
    svc.evict(None)
    svc.current("u")
    assert port.find_user_by_uuid.call_count == 3
    assert svc.current(None) is None and svc.current(" ") is None


def test_user_state_cache_sweeps(monkeypatch):
    from app.core.services.auth import user_state_service as uss
    monkeypatch.setattr(uss, "SWEEP_ABOVE", 2)
    clock = [0.0]
    port = MagicMock()
    port.find_user_by_uuid.return_value = None
    svc = UserStateService(port, 1, lambda: clock[0])
    for i in range(4):
        svc.current(f"u{i}")
    clock[0] += 5
    svc.current("last")
    assert len(svc._cache) == 1


# ── google login ────────────────────────────────────────────────────────────

@pytest.fixture
def deps():
    d = {k: MagicMock() for k in ("verifier", "identities", "jwt", "tokens", "guests", "merge", "state")}
    d["verifier"].client_id.return_value = CLIENT
    d["verifier"].verify.return_value = claims()
    d["identities"].find_identity_by_email.return_value = None
    d["identities"].find_user_by_email.return_value = None
    d["identities"].nickname_exists.return_value = False
    d["identities"].mark_id_token_seen.return_value = True
    d["identities"].create_user.return_value = 42
    d["jwt"].generate_access_token.return_value = "access"
    d["jwt"].generate_refresh_token.return_value = "refresh"
    d["jwt"].get_refresh_token_expiration_ms.return_value = int(NOW.timestamp() * 1000) + 600000
    d["jwt"].get_access_token_expiration_ms.return_value = 1
    d["jwt"].validate_token.return_value = False
    d["guests"].find_guest_by_cookie_token.return_value = None
    return d


def login_service(d, enabled=True):
    return GoogleLoginService(d["verifier"], d["identities"], d["jwt"], d["tokens"], d["guests"], d["merge"],
                              enabled, 5, d["state"], clock=lambda: NOW)


def refused(d, **kw):
    d["verifier"].verify.return_value = claims(**kw)
    with pytest.raises(AuthError) as e:
        login_service(d).login("id-token", "nonce")
    return e.value.code


def test_login_input_and_switch(deps):
    with pytest.raises(AuthError) as e:
        login_service(deps, enabled=False).login("t", "n")
    assert e.value.code == "GOOGLE_DISABLED"
    for token, nonce in ((None, "n"), (" ", "n"), ("t", None)):
        with pytest.raises(AuthError) as e:
            login_service(deps).login(token, nonce)
        assert e.value.code == "INVALID_REQUEST"
    assert login_service(deps).client_id() == CLIENT


def test_login_token_checks(deps):
    assert refused(deps, sub=None) == "INVALID_TOKEN"
    assert refused(deps, aud="other") == "INVALID_TOKEN"
    assert refused(deps, iss="https://evil.example") == "INVALID_TOKEN"
    assert refused(deps, exp=int(NOW.timestamp())) == "INVALID_TOKEN"
    assert refused(deps, nonce="other") == "INVALID_NONCE"
    with pytest.raises(AuthError):
        check_claims(claims(), None, None, NOW)
    deps["identities"].create_user.assert_not_called()


def test_login_email_rules_write_nothing(deps):
    assert refused(deps, verified=False) == "EMAIL_NOT_VERIFIED"
    assert refused(deps, email=" ") == "EMAIL_NOT_VERIFIED"
    assert refused(deps, email="a@googlemail.com") == "EMAIL_DOMAIN_NOT_ALLOWED"
    assert refused(deps, email="a@company.com") == "EMAIL_DOMAIN_NOT_ALLOWED"
    assert refused(deps, email="@gmail.com") == "EMAIL_DOMAIN_NOT_ALLOWED"
    deps["identities"].mark_id_token_seen.assert_not_called()
    deps["identities"].create_user.assert_not_called()


def test_login_identity_mismatch_and_states(deps):
    deps["identities"].find_identity_by_email.return_value = UserIdentity(1, 9, "GOOGLE", "other", "e")
    assert refused(deps) == "IDENTITY_MISMATCH"
    deps["identities"].mark_id_token_seen.assert_not_called()
    deps["identities"].find_identity_by_email.return_value = UserIdentity(1, 9, "GOOGLE", "sub-1", "e")
    deps["identities"].find_user_by_id.return_value = UserStatus(9, "u", "g", "n", "PLAYER", 7)
    assert refused(deps) == "ACCOUNT_DELETION_IN_PROGRESS"
    deps["identities"].find_user_by_id.return_value = None
    assert refused(deps) == "INVALID_TOKEN"


def test_login_replay(deps):
    deps["identities"].mark_id_token_seen.return_value = False
    assert refused(deps) == "TOKEN_REPLAYED"


def test_login_creates_the_user(deps):
    deps["identities"].nickname_exists.side_effect = lambda n: n == "mario.rossi"
    session = login_service(deps).login("id-token", "nonce")
    new_user, identity = deps["identities"].create_user.call_args[0]
    assert new_user.nickname == "mario.rossi#2" and new_user.username.startswith("google_")
    assert new_user.email_address == "mario.rossi+x@gmail.com" and new_user.language == "it"
    assert identity.subject == "sub-1"
    assert session.new_user and session.profile.display_name == "Mario Rossi"
    assert deps["tokens"].store_refresh_token.call_args[0][1] == token_hasher.sha256("refresh")
    deps["tokens"].enforce_token_limit.assert_called_with(42, 5)
    deps["identities"].mark_id_token_seen.assert_called_once()


def test_login_nickname_race_and_give_up(deps):
    deps["identities"].create_user.side_effect = [DuplicateUserError("nickname"), 7]
    login_service(deps).login("id-token", "nonce")
    names = [c[0][0].nickname for c in deps["identities"].create_user.call_args_list]
    assert names == ["mario.rossi", "mario.rossi#2"]
    deps["identities"].create_user.side_effect = DuplicateUserError("nickname")
    deps["identities"].nickname_exists.side_effect = lambda n: "#" in n
    with pytest.raises(AuthError) as e:
        login_service(deps).login("id-token", "nonce")
    assert e.value.code == "NICKNAME_TAKEN"


def test_login_concurrent_first_login(deps):
    winner = UserIdentity(3, 8, "GOOGLE", "sub-1", "e")
    deps["identities"].find_identity_by_email.side_effect = [None, winner]
    deps["identities"].create_user.side_effect = DuplicateUserError("email")
    deps["identities"].find_user_by_id.return_value = UserStatus(8, "u8", "google_8", "m", "PLAYER", 2)
    assert login_service(deps).login("id-token", "nonce").profile.user_uuid == "u8"
    deps["identities"].find_identity_by_email.side_effect = None
    deps["identities"].find_identity_by_email.return_value = None
    deps["identities"].create_user.side_effect = DuplicateUserError("other")
    with pytest.raises(AuthError) as e:
        login_service(deps).login("id-token", "nonce")
    assert e.value.code == "INVALID_REQUEST"


def test_login_known_user_and_linked_email(deps):
    deps["identities"].find_identity_by_email.return_value = UserIdentity(3, 8, "GOOGLE", "sub-1", "e")
    deps["identities"].find_user_by_id.return_value = UserStatus(8, "u8", "google_8", "m", "PLAYER", 2)
    assert login_service(deps).login("id-token", "nonce").new_user is False
    deps["identities"].update_identity_profile.assert_called_once()
    deps["identities"].find_identity_by_email.return_value = None
    deps["identities"].find_user_by_email.return_value = UserStatus(8, "u8", "imported", "m", "PLAYER", 2)
    login_service(deps).login("id-token", "nonce")
    deps["identities"].create_identity.assert_called_once()
    deps["identities"].find_user_by_email.return_value = UserStatus(8, "u8", "imported", "m", "PLAYER", 3)
    with pytest.raises(AuthError):
        login_service(deps).login("id-token", "nonce")


def test_login_merges_the_guest_of_the_bearer(deps):
    from app.core.models.auth.token_info import TokenInfo
    deps["jwt"].validate_token.return_value = True
    deps["jwt"].parse_token.return_value = TokenInfo(sub="g-uuid", username="g", type="access", iat=0, exp=0)
    deps["identities"].find_user_by_uuid.return_value = UserStatus(5, "g-uuid", "guest_x", "guest_x", "PLAYER", 6)
    deps["merge"].merge.return_value = MergeResult(2, [10])
    session = login_service(deps).login("id-token", "nonce", "en", "guest-access", None)
    assert session.merged_guest_uuid == "g-uuid" and session.cancelled_matches == 1
    deps["state"].evict.assert_called_with("g-uuid")


def test_login_merges_the_guest_of_the_cookie(deps):
    deps["jwt"].validate_token.return_value = True
    deps["jwt"].parse_token.side_effect = ValueError("bad")
    deps["guests"].find_guest_by_cookie_token.return_value = {"id": 6, "uuid": "g6"}
    deps["merge"].merge.return_value = MergeResult()
    assert login_service(deps).login("id-token", "nonce", None, "x", "cookie").merged_guest_uuid == "g6"
    deps["guests"].find_guest_by_cookie_token.return_value = {"id": 42, "uuid": "self"}
    assert login_service(deps).login("id-token", "nonce", None, None, "cookie").merged_guest_uuid is None
    deps["guests"].find_guest_by_cookie_token.return_value = {"uuid": "x"}
    assert login_service(deps).login("id-token", "nonce", None, None, "cookie").merged_guest_uuid is None


def test_language():
    assert language(" IT ", "en") == "it"
    assert language("fr", "en-GB") == "en"
    assert language(None, "it") == "it"
    assert language(None, "de") == "en"
    assert language(None, None) == "en"


# ── account ─────────────────────────────────────────────────────────────────

@pytest.fixture
def account():
    identities, verifier, tokens, matches, state = (MagicMock() for _ in range(5))
    verifier.client_id.return_value = CLIENT
    identities.find_user_by_uuid.return_value = UserStatus(8, "u8", "google_8", "mario", "PLAYER", 2, "it")
    identities.find_identities_of_user.return_value = [
        UserIdentity(1, 8, "GOOGLE", "sub-1", "mario@gmail.com", "Mario Rossi", "Mario", "Rossi", "pic")]
    identities.mark_id_token_seen.return_value = True
    svc = AccountService(identities, verifier, tokens, matches, state, 2, 24, clock=lambda: NOW)
    return svc, identities, verifier, tokens, matches, state


def deletion_refusal(account, token, nonce=None):
    svc = account[0]
    with pytest.raises(AuthError) as e:
        svc.request_deletion("u8", token, nonce)
    return e.value.code


def test_profile(account):
    svc, identities = account[0], account[1]
    assert svc.profile("u8").display_name == "Mario Rossi"
    identities.find_user_by_uuid.return_value = None
    assert svc.profile("x") is None


def test_deletion_rules(account):
    svc, identities, verifier = account[0], account[1], account[2]
    assert deletion_refusal(account, None) == "FRESH_TOKEN_REQUIRED"
    verifier.verify.return_value = claims(email="mario@gmail.com", iat=int(NOW.timestamp()) - 301)
    assert deletion_refusal(account, "old") == "FRESH_TOKEN_REQUIRED"
    verifier.verify.return_value = claims(sub="sub-2", email="mario@gmail.com")
    assert deletion_refusal(account, "other") == "IDENTITY_MISMATCH"
    verifier.verify.return_value = claims(email="mario@gmail.com")
    assert deletion_refusal(account, "t", "wrong") == "INVALID_NONCE"
    identities.mark_id_token_seen.return_value = False
    assert deletion_refusal(account, "t", " ") == "TOKEN_REPLAYED"
    identities.find_identities_of_user.return_value = []
    assert deletion_refusal(account, "t") == "NOT_A_GOOGLE_ACCOUNT"
    identities.find_user_by_uuid.return_value = None
    assert deletion_refusal(account, "t") == "INVALID_TOKEN"
    identities.update_state.assert_not_called()


def test_deletion_sets_state_seven(account):
    svc, identities, verifier, tokens, _, state = account
    verifier.verify.return_value = claims(email="Mario@Gmail.com", iat=int(NOW.timestamp()) - 60)
    svc.request_deletion("u8", "t", "nonce")
    identities.update_state.assert_called_with(8, 7)
    tokens.revoke_all_by_user_id.assert_called_with(8)
    state.evict.assert_called_with("u8")


def test_deletion_job_and_retention(account):
    svc, identities, _, _, matches, state = account
    identities.find_user_ids_by_state.return_value = [3, 4]
    assert svc.run_deletion_job() == 2
    matches.delete_matches_by_user_creator_ids.assert_any_call([3])
    identities.delete_user_fully.assert_any_call(4)
    identities.find_user_ids_by_state.return_value = []
    assert svc.run_deletion_job() == 0
    identities.find_inactive_identity_user_ids.return_value = [8, 9]
    identities.find_user_by_id.side_effect = lambda i: UserStatus(8, "u8", "g", "m", "PLAYER", 2) if i == 8 else None
    assert svc.retire_inactive_users() == 2
    assert identities.find_inactive_identity_user_ids.call_args[0][0].startswith("2024-10-19")
    state.evict.assert_called_with("u8")
    assert AccountService(*([MagicMock()] * 5), chunk=0, retention_months=0).chunk == 100


def test_months_ago_clamps_the_day():
    assert months_ago(datetime(2026, 3, 31, tzinfo=timezone.utc), 1).day in (28, 29)
    assert months_ago(datetime(2026, 1, 15, tzinfo=timezone.utc), 24).year == 2024


# ── admin bootstrap ─────────────────────────────────────────────────────────

def test_admin_bootstrap():
    identities, jwt = MagicMock(), MagicMock()
    identities.find_user_by_nickname.return_value = None
    identities.create_user.return_value = 5
    jwt.generate_access_token.return_value = "tok"
    r = AdminBootstrapService(identities, jwt, 30).create_admin(" owner ")
    new_user = identities.create_user.call_args[0][0]
    assert new_user.role == "ADMIN" and new_user.state == 2 and new_user.username.startswith("admin_")
    assert r.created and r.access_token == "tok"
    assert jwt.generate_access_token.call_args[1]["lifetime_seconds"] == 30 * 86400
    identities.find_user_by_nickname.return_value = UserStatus(5, "uuid", "admin_x", "owner", "ADMIN", 2)
    assert AdminBootstrapService(identities, jwt, 0).create_admin("owner").created is False
    for bad in (None, "a b"):
        with pytest.raises(AuthError):
            AdminBootstrapService(identities, jwt).create_admin(bad)
    identities.find_user_by_nickname.return_value = UserStatus(5, "u", "google_x", "mario", "PLAYER", 2)
    with pytest.raises(AuthError) as e:
        AdminBootstrapService(identities, jwt).create_admin("mario")
    assert e.value.code == "NICKNAME_TAKEN"


# ── log sanitizer ───────────────────────────────────────────────────────────

def test_log_sanitizer_values_and_text():
    out = log_sanitizer.sanitize({"email": "a@gmail.com", "given_name": "Mario", "sub": "1",
                                  "nested": {"pictureUrl": "x", "note": "write to b@gmail.com"},
                                  "list": [{"emailAddress": "c@gmail.com"}, 5]})
    assert out["email"] == out["given_name"] == log_sanitizer.REDACTED and out["sub"] == "1"
    assert out["nested"]["pictureUrl"] == log_sanitizer.REDACTED
    assert out["nested"]["note"] == "write to " + log_sanitizer.REDACTED
    assert out["list"][0]["emailAddress"] == log_sanitizer.REDACTED and out["list"][1] == 5
    text = log_sanitizer.sanitize_text('{"email": "a@gmail.com", "sub": "1", given_name=Mario, name=\'M R\'}')
    assert "a@gmail.com" not in text and "Mario" not in text and "M R" not in text and '"sub": "1"' in text
    assert log_sanitizer.sanitize_text(None) is None
    assert not log_sanitizer.is_sensitive_key(None)


def test_log_sanitizer_filter_and_install():
    import logging
    record = logging.LogRecord("x", logging.INFO, "f", 1, "user %s email=%s", ("x@gmail.com", "y@gmail.com"), None)
    log_sanitizer.SanitizingFilter().filter(record)
    assert "gmail" not in record.getMessage()
    record = logging.LogRecord("x", logging.INFO, "f", 1, "%(email)s", None, None)
    record.args = {"email": "z@gmail.com"}
    log_sanitizer.SanitizingFilter().filter(record)
    assert record.getMessage() == log_sanitizer.REDACTED
    record = logging.LogRecord("x", logging.INFO, "f", 1, "broken %s %s", ("one",), None)
    log_sanitizer.SanitizingFilter().filter(record)
    assert record.getMessage() == "broken %s %s"
    logger = logging.getLogger("pg-sanitizer-test")
    handler = logging.StreamHandler()
    logger.addHandler(handler)
    log_sanitizer.install("pg-sanitizer-test")
    log_sanitizer.install("pg-sanitizer-test")
    assert sum(isinstance(f, log_sanitizer.SanitizingFilter) for f in handler.filters) == 1
    logger.removeHandler(handler)
