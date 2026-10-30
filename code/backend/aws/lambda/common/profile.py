"""v1.7.0 GET / PATCH /api/auth/me on AWS: statistics over the matches the user created (one GSI1 query)
and the preferences on the USER# item (language, theme_selected); same rules as Java and Python."""
import os

from common import db_utils, match_summary, sso

PLAYED = ('RUNNING', 'PAUSED', 'ENDED', 'GAMEOVER')
THEME_DEFAULT = 'default'
THEME_HIGH_CONTRAST = 'high-contrast'
DEFAULT_LANGUAGES = ('en', 'it')
DEFAULT_THEMES = (THEME_DEFAULT, THEME_HIGH_CONTRAST)


def parse_list(csv, fallback):
    """A comma-separated list, trimmed, lowercase, without blanks or duplicates; the fallback when empty."""
    out = []
    for part in str(csv or '').split(','):
        value = part.strip().lower()
        if value and value not in out:
            out.append(value)
    return out or list(fallback)


def supported_languages():
    return parse_list(os.environ.get('SUPPORTED_LANGUAGES'), DEFAULT_LANGUAGES)


def supported_themes():
    return parse_list(os.environ.get('SUPPORTED_THEMES'), DEFAULT_THEMES)


def _int(value):
    try:
        return int(value or 0)
    except (TypeError, ValueError):
        return 0


def stats(user_uuid):
    """Played (RUNNING, PAUSED, ENDED, GAMEOVER), completed (ENDED), game over, play time and clocks."""
    out = {'matchesPlayed': 0, 'matchesCompleted': 0, 'matchesGameOver': 0, 'playTimeMs': 0, 'clocksPlayed': 0}
    if not user_uuid:
        return out
    for row in map(match_summary.flatten, db_utils.query_gsi('GSI1', f'USER_MATCHES#{user_uuid}') or []):
        status = row.get('status')
        if status not in PLAYED:
            continue
        out['matchesPlayed'] += 1
        out['playTimeMs'] += _int(row.get('playMs'))
        out['clocksPlayed'] += _int(row.get('currentClock'))
        if status == 'ENDED':
            out['matchesCompleted'] += 1
        elif status == 'GAMEOVER':
            out['matchesGameOver'] += 1
    return out


def preferences(user):
    theme = str(user.get('theme_selected') or '').strip() or THEME_DEFAULT
    return {'language': user.get('language'), 'theme': theme, 'highContrast': theme == THEME_HIGH_CONTRAST}


def update_preferences(user, language, theme):
    """A None field is left unchanged; raises sso.AuthError (guest, nothing to change, unsupported value)."""
    if sso.state_of(user) == sso.STATE_GUEST:
        raise sso.AuthError('GOOGLE_ACCOUNT_REQUIRED', 'Sign in with Google to keep preferences in the profile')
    if language is None and theme is None:
        raise sso.AuthError('INVALID_REQUEST', 'Nothing to update')
    if language is not None and language not in supported_languages():
        raise sso.AuthError('INVALID_REQUEST', f'Unsupported language: {language}')
    if theme is not None and theme not in supported_themes():
        raise sso.AuthError('INVALID_REQUEST', f'Unsupported theme: {theme}')
    values = {k: v for k, v in (('language', language), ('theme_selected', theme)) if v is not None}
    db_utils.update_attributes(f"USER#{user.get('uuid')}", 'METADATA', values)
    return {**user, **values}
