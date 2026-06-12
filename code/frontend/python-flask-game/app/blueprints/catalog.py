"""Catalog + story detail (book) routes."""
from collections import OrderedDict

from flask import Blueprint, abort, render_template, request

from .. import LANG_COOKIE
from ..data import get_stories, get_story_detail
from ..i18n import normalize_lang
from ..matches import list_matches
from ..selection import resolve

bp = Blueprint("catalog", __name__)


def _lang():
    return normalize_lang(request.cookies.get(LANG_COOKIE, "en"))


def _match_badges():
    """Map storyUuid -> 'active' | 'completed' for catalog badges."""
    badges = {}
    for m in list_matches():
        suid = m.get("storyUuid")
        status = m.get("status")
        if not suid:
            continue
        if status in ("CREATED", "RUNNING"):
            badges[suid] = "active"
        elif status in ("ENDED", "GAMEOVER") and badges.get(suid) != "active":
            badges[suid] = "completed"
    return badges


@bp.route("/")
def catalog():
    stories = get_stories()
    grouped = OrderedDict()
    for s in stories:
        grouped.setdefault(s.get("category") or "stories", []).append(s)
    return render_template(
        "catalog.html",
        grouped=grouped,
        badges=_match_badges(),
    )


@bp.route("/story/<uuid>")
def story_detail(uuid):
    detail = get_story_detail(uuid, _lang())
    if not detail:
        abort(404)
    selection = resolve(detail, uuid)
    return render_template(
        "story_detail.html",
        story=detail,
        story_uuid=uuid,
        selection=selection,
    )
