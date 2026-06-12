"""Import a new story from a tutorial_story.json document."""
import json

from flask import Blueprint, flash, redirect, render_template, request, url_for

from .. import api
from ..api import ApiError
from ..auth import login_required

bp = Blueprint("story_import", __name__, url_prefix="/stories/import")


@bp.route("/", methods=["GET", "POST"], endpoint="page")
@login_required
def page():
    error = None
    raw = ""
    if request.method == "POST":
        raw = request.form.get("payload", "")
        # File upload takes precedence when present.
        upload = request.files.get("file")
        if upload and upload.filename:
            raw = upload.read().decode("utf-8")
        try:
            doc = json.loads(raw)
        except (json.JSONDecodeError, ValueError) as e:
            error = f"Invalid JSON: {e}"
            return render_template("story_import.html", error=error, payload=raw)
        try:
            result = api.import_story(doc)
            uuid = (result or {}).get("uuid")
            flash("Story imported successfully.", "success")
            if uuid:
                return redirect(url_for("editor.edit", uuid=uuid))
            return redirect(url_for("stories.index"))
        except ApiError as e:
            error = e.message
    return render_template("story_import.html", error=error, payload=raw)
