"""v1.2.0 redacts personal data before a log line is written: the keys email, given_name, family_name,
name, picture (and their camelCase forms) and any email address (same rules as Java LogSanitizer)."""
import logging
import re
from typing import Any

REDACTED = "[REDACTED]"
KEYS = {"email", "email_address", "emailaddress", "given_name", "givenname", "family_name", "familyname",
        "name", "profile_name", "profilename", "picture", "picture_url", "pictureurl"}
_EMAIL = re.compile(r"[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}")
_PAIR = re.compile(r"""("?)([A-Za-z_]+)("?\s*[:=]\s*)("[^"]*"|'[^']*'|[^,;}\s]+)""")


def is_sensitive_key(key) -> bool:
    return isinstance(key, str) and key.lower() in KEYS


def sanitize(value: Any) -> Any:
    """A copy with every sensitive value of dicts (nested too) and every email address replaced."""
    if isinstance(value, dict):
        return {k: (REDACTED if is_sensitive_key(k) else sanitize(v)) for k, v in value.items()}
    if isinstance(value, (list, tuple)):
        return [sanitize(v) for v in value]
    if isinstance(value, str):
        return sanitize_text(value)
    return value


def sanitize_text(text):
    if text is None:
        return None

    def _pair(m):
        return m.group(1) + m.group(2) + m.group(3) + REDACTED if is_sensitive_key(m.group(2)) else m.group(0)

    return _EMAIL.sub(REDACTED, _PAIR.sub(_pair, text))


class SanitizingFilter(logging.Filter):
    """A logging filter that redacts the message and the arguments of every record."""

    def filter(self, record: logging.LogRecord) -> bool:
        # the formatted message is redacted, so a %s placeholder can never be broken
        try:
            message = record.getMessage()
        except (TypeError, ValueError):
            message = str(record.msg)
        record.msg = sanitize_text(message)
        record.args = None
        return True


def install(logger_name: str = "") -> None:
    """Adds the filter to the handlers of a logger (the root by default), once."""
    target = logging.getLogger(logger_name)
    for handler in target.handlers:
        if not any(isinstance(f, SanitizingFilter) for f in handler.filters):
            handler.addFilter(SanitizingFilter())
    if not any(isinstance(f, SanitizingFilter) for f in target.filters):
        target.addFilter(SanitizingFilter())
