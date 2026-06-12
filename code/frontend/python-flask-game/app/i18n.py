"""Server-side i18n.

Reuses the exact same ``en.json`` / ``it.json`` translation files as the
react-game (copied into ``static/i18n/``). Exposes a ``t(key, **vars)`` helper
that resolves dot-paths (``t('book.startGame')``) and interpolates ``{name}``
placeholders, matching the React ``useTranslation`` contract.
"""
import json
import os

_HERE = os.path.dirname(os.path.abspath(__file__))
_I18N_DIR = os.path.join(_HERE, os.pardir, "static", "i18n")

SUPPORTED_LANGS = ("en", "it")
DEFAULT_LANG = "en"

_CACHE = {}


def _load(lang):
    if lang not in _CACHE:
        path = os.path.join(_I18N_DIR, f"{lang}.json")
        with open(path, encoding="utf-8") as fh:
            _CACHE[lang] = json.load(fh)
    return _CACHE[lang]


def normalize_lang(lang):
    """Return a supported language code, falling back to the default."""
    return lang if lang in SUPPORTED_LANGS else DEFAULT_LANG


def _resolve(data, key):
    node = data
    for part in key.split("."):
        if isinstance(node, dict) and part in node:
            node = node[part]
        else:
            return None
    return node if isinstance(node, str) else None


def translate(lang, key, **variables):
    """Translate ``key`` for ``lang``.

    Falls back to English then to the key itself when missing. ``{name}`` style
    placeholders in the string are replaced with matching keyword arguments.
    """
    lang = normalize_lang(lang)
    value = _resolve(_load(lang), key)
    if value is None and lang != DEFAULT_LANG:
        value = _resolve(_load(DEFAULT_LANG), key)
    if value is None:
        return key
    for name, repl in variables.items():
        value = value.replace("{" + name + "}", str(repl))
    return value


def make_translator(lang):
    """Return a one-arg-friendly ``t`` bound to ``lang`` (for Jinja globals)."""
    lang = normalize_lang(lang)

    def t(key, **variables):
        return translate(lang, key, **variables)

    return t
