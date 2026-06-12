"""Story list — create / delete / link to editor."""
from flask import Blueprint, flash, redirect, render_template, request, url_for

from .. import api
from ..api import ApiError
from ..auth import login_required

bp = Blueprint("stories", __name__, url_prefix="/stories")


@bp.route("/", endpoint="index")
@login_required
def index():
    stories, error = [], None
    try:
        stories = api.list_stories() or []
    except ApiError as e:
        error = e.message
    return render_template("stories.html", stories=stories, error=error)


@bp.route("/create", methods=["POST"], endpoint="create")
@login_required
def create():
    payload = {
        "author": (request.form.get("author") or "").strip() or None,
        "category": (request.form.get("category") or "").strip() or None,
        "group": (request.form.get("group") or "").strip() or None,
        "visibility": (request.form.get("visibility") or "PUBLIC").strip(),
    }
    try:
        created = api.create_story(payload)
        flash("Story created.", "success")
        uuid = (created or {}).get("uuid")
        if uuid:
            return redirect(url_for("editor.edit", uuid=uuid))
    except ApiError as e:
        flash(e.message, "danger")
    return redirect(url_for("stories.index"))


@bp.route("/<uuid>/delete", methods=["POST"], endpoint="delete")
@login_required
def delete(uuid):
    try:
        api.delete_story(uuid)
        flash("Story deleted.", "success")
    except ApiError as e:
        flash(e.message, "danger")
    return redirect(url_for("stories.index"))
