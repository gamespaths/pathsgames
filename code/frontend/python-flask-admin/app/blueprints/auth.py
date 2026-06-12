"""Login / logout — paste a JWT admin token and optional server url."""
from flask import (Blueprint, flash, redirect, render_template, request,
                   url_for)

from ..auth import is_logged_in
from ..auth import login as do_login
from ..auth import logout as do_logout

bp = Blueprint("auth", __name__)


@bp.route("/login", methods=["GET", "POST"], endpoint="login")
def login():
    if is_logged_in():
        return redirect(url_for("dashboard.index"))
    error = None
    if request.method == "POST":
        token = (request.form.get("token") or "").strip()
        server = (request.form.get("server") or "").strip()
        if not token:
            error = "Please paste your JWT access token."
        elif not token.startswith("eyJ"):
            error = "Token does not look like a valid JWT (should start with eyJ…)."
        else:
            do_login(token, server or None)
            return redirect(url_for("dashboard.index"))
    return render_template("login.html", error=error)


@bp.route("/logout", endpoint="logout")
def logout():
    do_logout()
    flash("Logged out.", "success")
    return redirect(url_for("auth.login"))
