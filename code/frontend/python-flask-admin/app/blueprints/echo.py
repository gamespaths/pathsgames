"""Server status (echo) page."""
from flask import Blueprint, render_template

from .. import api
from ..api import ApiError
from ..auth import login_required

bp = Blueprint("echo", __name__, url_prefix="/echo")


@bp.route("/", endpoint="index")
@login_required
def index():
    status, error = None, None
    try:
        status = api.server_status()
    except ApiError as e:
        error = e.message
    return render_template("echo.html", status=status, error=error)
