"""Selection ("change element") routes for class / character / trait / difficulty."""
from flask import Blueprint, abort, redirect, render_template, request, url_for

from .. import LANG_COOKIE
from ..data import get_story_detail, get_traits_for_class
from ..i18n import normalize_lang
from ..selection import resolve, set_single, toggle_trait

bp = Blueprint("config", __name__)

KINDS = ("class", "character", "trait", "difficulty")
_OPTION_KEY = {
    "class": "classes",
    "character": "characterTemplates",
    "trait": "traits",
    "difficulty": "difficulties",
}


def _lang():
    return normalize_lang(request.cookies.get(LANG_COOKIE, "en"))


@bp.route("/story/<uuid>/select/<kind>", methods=["GET", "POST"])
def select(uuid, kind):
    if kind not in KINDS:
        abort(404)
    detail = get_story_detail(uuid, _lang())
    if not detail:
        abort(404)
    selection = resolve(detail, uuid)

    if request.method == "POST":
        chosen = request.form.get("uuid")
        if kind == "trait":
            toggle_trait(uuid, chosen)
            # stay on the trait picker (multi-select) unless asked to finish
            if request.form.get("done"):
                return redirect(url_for("catalog.story_detail", uuid=uuid))
            return redirect(url_for("config.select", uuid=uuid, kind=kind))
        set_single(uuid, kind, chosen)
        return redirect(url_for("catalog.story_detail", uuid=uuid))

    # Build the option list. Traits are filtered by the selected class.
    if kind == "trait":
        class_uuid = selection["class"]["uuid"] if selection["class"] else None
        options = get_traits_for_class(uuid, class_uuid, _lang()) if class_uuid else detail.get("traits", [])
        selected_uuids = {t["uuid"] for t in selection["traits"]}
    else:
        options = detail.get(_OPTION_KEY[kind], [])
        sel = selection[kind]
        selected_uuids = {sel["uuid"]} if sel else set()

    return render_template(
        "select_element.html",
        story=detail,
        story_uuid=uuid,
        kind=kind,
        options=options,
        selected_uuids=selected_uuids,
    )
