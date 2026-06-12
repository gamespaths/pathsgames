"""Session-based admin authentication (JWT pasted on the login screen)."""
from functools import wraps

from flask import redirect, session, url_for

from .api import SESSION_SERVER, SESSION_TOKEN


def is_logged_in():
    return bool(session.get(SESSION_TOKEN))


def login(token, server=None):
    session[SESSION_TOKEN] = token
    if server:
        session[SESSION_SERVER] = server.rstrip("/")
    session.permanent = True


def logout():
    session.pop(SESSION_TOKEN, None)
    session.pop(SESSION_SERVER, None)


def login_required(view):
    @wraps(view)
    def wrapped(*args, **kwargs):
        if not is_logged_in():
            return redirect(url_for("auth.login"))
        return view(*args, **kwargs)

    return wrapped
