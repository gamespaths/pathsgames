"""Match administration — list, control (stop/pause/resume), edit, detail, delete."""
from flask import Blueprint, abort, flash, redirect, render_template, request, url_for

from .. import api
from ..api import ApiError
from ..auth import login_required

bp = Blueprint("matches", __name__, url_prefix="/matches")

_ACTIONS = ("stop", "pause", "resume", "delete")


@bp.route("/", endpoint="index")
@login_required
def index():
    matches, statuses, error = [], [], None
    try:
        matches = api.list_matches() or []
    except ApiError as e:
        error = e.message
    try:
        statuses = api.list_match_statuses() or []
    except ApiError:
        statuses = []
    return render_template("matches.html", matches=matches, statuses=statuses, error=error)


@bp.route("/<uuid>", endpoint="detail")
@login_required
def detail(uuid):
    info = None
    try:
        info = api.get_match_info(uuid)
    except ApiError as e:
        flash(e.message, "danger")
        return redirect(url_for("matches.index"))
    if not info:
        abort(404)
    statuses = []
    try:
        statuses = api.list_match_statuses() or []
    except ApiError:
        statuses = []
    return render_template("match_detail.html", uuid=uuid, info=info, statuses=statuses)


@bp.route("/<uuid>/action/<action>", methods=["POST"], endpoint="action")
@login_required
def action(uuid, action):
    if action not in _ACTIONS:
        abort(404)
    fn = getattr(api, f"{action}_match")  # resolved at call time (monkeypatch-friendly)
    try:
        fn(uuid)
        flash(f"Match {action} ok.", "success")
    except ApiError as e:
        flash(e.message, "danger")
    if action == "delete":
        return redirect(url_for("matches.index"))
    return redirect(request.referrer or url_for("matches.index"))


@bp.route("/<uuid>/update", methods=["POST"], endpoint="update")
@login_required
def update(uuid):
    body = {}
    name = (request.form.get("name") or "").strip()
    status = (request.form.get("status") or "").strip()
    if name:
        body["name"] = name
    if status:
        body["status"] = status
    try:
        api.update_match(uuid, body)
        flash("Match updated.", "success")
    except ApiError as e:
        flash(e.message, "danger")
    return redirect(request.referrer or url_for("matches.detail", uuid=uuid))
