"""Guest (anonymous user) administration."""
from flask import Blueprint, flash, redirect, render_template, url_for

from .. import api
from ..api import ApiError
from ..auth import login_required

bp = Blueprint("guests", __name__, url_prefix="/guests")


@bp.route("/", endpoint="index")
@login_required
def index():
    guests, stats, error = [], None, None
    try:
        guests = api.list_guests() or []
    except ApiError as e:
        error = e.message
    try:
        stats = api.guest_stats()
    except ApiError:
        stats = None
    return render_template("guests.html", guests=guests, stats=stats, error=error)


@bp.route("/<uuid>/delete", methods=["POST"], endpoint="delete")
@login_required
def delete(uuid):
    try:
        api.delete_guest(uuid)
        flash("Guest deleted.", "success")
    except ApiError as e:
        flash(e.message, "danger")
    return redirect(url_for("guests.index"))


@bp.route("/delete-expired", methods=["POST"], endpoint="delete_expired")
@login_required
def delete_expired():
    try:
        api.delete_expired_guests()
        flash("Expired guests deleted.", "success")
    except ApiError as e:
        flash(e.message, "danger")
    return redirect(url_for("guests.index"))
