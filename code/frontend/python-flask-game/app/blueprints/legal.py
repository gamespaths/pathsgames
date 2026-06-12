"""Dedicated legal pages: privacy, terms, cookies (texts from the i18n files)."""
from flask import Blueprint, render_template

bp = Blueprint("legal", __name__)


@bp.route("/privacy")
def privacy():
    return render_template("legal/privacy.html")


@bp.route("/terms")
def terms():
    return render_template("legal/terms.html")


@bp.route("/cookies")
def cookies():
    return render_template("legal/cookies.html")
