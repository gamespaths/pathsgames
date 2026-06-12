"""Preference toggles (language, accessibility theme, cookie consent).

Each posts a tiny form and sets a cookie, then redirects back — no JS needed.
"""
from flask import Blueprint, redirect, request

from .. import CONSENT_COOKIE, LANG_COOKIE, THEME_COOKIE
from ..i18n import SUPPORTED_LANGS

bp = Blueprint("prefs", __name__)

_YEAR = 60 * 60 * 24 * 365
_SIX_MONTHS = 60 * 60 * 24 * 182


def _back():
    return request.form.get("next") or request.referrer or "/"


@bp.route("/prefs/lang", methods=["POST"])
def set_lang():
    lang = request.form.get("lang", "en")
    if lang not in SUPPORTED_LANGS:
        lang = "en"
    resp = redirect(_back())
    resp.set_cookie(LANG_COOKIE, lang, max_age=_YEAR, samesite="Lax")
    return resp


@bp.route("/prefs/theme", methods=["POST"])
def set_theme():
    theme = request.form.get("theme", "default")
    if theme not in ("default", "access"):
        theme = "default"
    resp = redirect(_back())
    resp.set_cookie(THEME_COOKIE, theme, max_age=_YEAR, samesite="Lax")
    return resp


@bp.route("/prefs/consent", methods=["POST"])
def set_consent():
    choice = request.form.get("consent", "necessary")
    if choice not in ("all", "necessary"):
        choice = "necessary"
    resp = redirect(_back())
    resp.set_cookie(CONSENT_COOKIE, choice, max_age=_SIX_MONTHS, samesite="Lax")
    return resp
