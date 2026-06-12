"""Flask application factory for the Paths Games admin console."""
import os

from flask import Flask, session

from .api import SESSION_SERVER
from .auth import is_logged_in
from .config import Config

_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), os.pardir))


def create_app(config_object=Config):
    app = Flask(
        __name__,
        static_folder=os.path.join(_ROOT, "static"),
        template_folder=os.path.join(_ROOT, "templates"),
    )
    app.config.from_object(config_object)

    from .blueprints.auth import bp as auth_bp
    from .blueprints.dashboard import bp as dashboard_bp
    from .blueprints.guests import bp as guests_bp
    from .blueprints.stories import bp as stories_bp
    from .blueprints.editor import bp as editor_bp
    from .blueprints.story_import import bp as import_bp
    from .blueprints.matches import bp as matches_bp
    from .blueprints.echo import bp as echo_bp

    for bp in (auth_bp, dashboard_bp, guests_bp, stories_bp, editor_bp,
               import_bp, matches_bp, echo_bp):
        app.register_blueprint(bp)

    @app.context_processor
    def _globals():
        return {
            "logged_in": is_logged_in(),
            "admin_server": session.get(SESSION_SERVER) or app.config["ADMIN_BASE_URL"],
            "app_version": "0.1.0",
        }

    return app
