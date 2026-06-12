"""Start-match (anti-bot) and match (half-mock) routes."""
import json
import os

from flask import (Blueprint, abort, redirect, render_template, request,
                   session, url_for)

from .. import LANG_COOKIE
from ..captcha import HONEYPOT_FIELD, mark_human, new_challenge, verify
from ..data import get_story_detail
from ..i18n import normalize_lang
from ..matches import create_match, get_match, join_match
from ..selection import resolve

bp = Blueprint("match", __name__)

_DATA_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), os.pardir, "static", "data")
_game_cache = None


def _lang():
    return normalize_lang(request.cookies.get(LANG_COOKIE, "en"))


def _game_data():
    global _game_cache
    if _game_cache is None:
        with open(os.path.join(_DATA_DIR, "gameData.json"), encoding="utf-8") as fh:
            _game_cache = json.load(fh)
    return _game_cache


@bp.route("/story/<uuid>/start", methods=["GET", "POST"])
def start(uuid):
    detail = get_story_detail(uuid, _lang())
    if not detail:
        abort(404)
    selection = resolve(detail, uuid)
    error = None

    if request.method == "POST":
        if verify(session, request.form.get("captcha", ""), request.form.get(HONEYPOT_FIELD, "")):
            mark_human(session)
            match = create_match({
                "storyUuid": uuid,
                "storyTitle": detail.get("title"),
                "classUuid": selection["class"]["uuid"] if selection["class"] else None,
                "characterTemplateUuid": selection["character"]["uuid"] if selection["character"] else None,
                "difficultyUuid": selection["difficulty"]["uuid"] if selection["difficulty"] else None,
                "traitUuids": [t["uuid"] for t in selection["traits"]],
            })
            return redirect(url_for("match.match", uuid=match["uuid"]))
        error = "antibot.error"

    return render_template(
        "start_match.html",
        story=detail,
        story_uuid=uuid,
        selection=selection,
        challenge=new_challenge(session),
        honeypot_field=HONEYPOT_FIELD,
        error=error,
    )


@bp.route("/match/<uuid>")
def match(uuid):
    m = get_match(uuid)
    if not m:
        abort(404)
    join_match(uuid)  # CREATED -> RUNNING on entering the book
    detail = get_story_detail(m.get("storyUuid"), _lang()) if m.get("storyUuid") else None
    game = _game_data()
    return render_template(
        "match.html",
        match=get_match(uuid),
        story=detail,
        game=game,
        location=game.get("startLocation") or {},
        stats=game.get("playerStats") or {},
        actions=game.get("actions") or [],
        other_locations=game.get("locationss") or [],
    )
