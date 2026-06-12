"""Dashboard — server status + guest stats + story count."""
from flask import Blueprint, render_template

from .. import api
from ..api import ApiError
from ..auth import login_required

bp = Blueprint("dashboard", __name__)


@bp.route("/", endpoint="index")
@login_required
def index():
    server = guests = None
    story_count = None
    try:
        server = api.server_status()
    except ApiError:
        server = None
    try:
        guests = api.guest_stats()
    except ApiError:
        guests = None
    try:
        story_count = len(api.list_stories() or [])
    except ApiError:
        story_count = None
    return render_template("dashboard.html", server=server, guests=guests, story_count=story_count)
