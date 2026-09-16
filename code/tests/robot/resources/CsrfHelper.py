# ---------------------------------------------------------------------------
# CsrfHelper.py — v0.37.7 (Step 41). Remembers the csrfToken every login-shaped response
# hands out, keyed by the access token it belongs to, so the match-creation keywords can
# echo it back as X-CSRF-TOKEN without every suite having to carry it around.
#
# The token is bound to the bearer, not to the guest, so a refresh rotates both together.
# ---------------------------------------------------------------------------
_CSRF_BY_ACCESS_TOKEN = {}


def remember_csrf_token(access_token, csrf_token):
    """Store the csrfToken of one access token (a blank pair is ignored)."""
    if access_token and csrf_token:
        _CSRF_BY_ACCESS_TOKEN[access_token] = csrf_token


def known_csrf_token(access_token):
    """The remembered csrfToken of this access token, or an empty string."""
    return _CSRF_BY_ACCESS_TOKEN.get(access_token, "")


def forget_csrf_tokens():
    _CSRF_BY_ACCESS_TOKEN.clear()
