"""Server-side anti-bot gate — no JavaScript required.

Generates a small arithmetic challenge stored in the session, validates the
answer together with a hidden honeypot field, and (on success) marks the
session as "human" for a configurable TTL — mirroring the role of the
react-game Turnstile pass cookie, but fully server-rendered.
"""
import random
import time

from .config import Config

_QUESTION_KEY = "captcha_answer"
_HUMAN_UNTIL = "human_until"
HONEYPOT_FIELD = "website"  # must stay empty; bots tend to fill every field


def new_challenge(session):
    """Create a fresh challenge, persist the answer in the session, return the prompt."""
    a = random.randint(1, 9)
    b = random.randint(1, 9)
    session[_QUESTION_KEY] = a + b
    return f"{a} + {b}"


def verify(session, answer, honeypot=""):
    """Return ``True`` when the honeypot is empty and the answer matches."""
    if honeypot:
        return False
    expected = session.get(_QUESTION_KEY)
    if expected is None:
        return False
    try:
        ok = int(str(answer).strip()) == int(expected)
    except (TypeError, ValueError):
        ok = False
    # One-shot: drop the challenge so a captured answer can't be replayed.
    session.pop(_QUESTION_KEY, None)
    return ok


def mark_human(session, ttl=None):
    """Record a successful pass valid for ``ttl`` seconds (default Config.HUMAN_TTL)."""
    ttl = Config.HUMAN_TTL if ttl is None else ttl
    session[_HUMAN_UNTIL] = time.time() + ttl


def is_human(session):
    """Return ``True`` while a recent anti-bot pass is still valid."""
    until = session.get(_HUMAN_UNTIL)
    return bool(until) and time.time() < until
