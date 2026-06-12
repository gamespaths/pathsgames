"""User (guest) profile page."""
from flask import Blueprint, render_template, request

from .. import LANG_COOKIE
from ..data import get_story
from ..i18n import normalize_lang
from ..matches import list_matches

bp = Blueprint("user", __name__)


@bp.route("/me")
def profile():
    lang = normalize_lang(request.cookies.get(LANG_COOKIE, "en"))  # noqa: F841 (future use)
    matches = list_matches()
    # Resolve story summaries for nicer cards (title + cover).
    story_map = {}
    for m in matches:
        suid = m.get("storyUuid")
        if suid and suid not in story_map:
            story_map[suid] = get_story(suid)
    return render_template("user.html", matches=matches, story_map=story_map)
