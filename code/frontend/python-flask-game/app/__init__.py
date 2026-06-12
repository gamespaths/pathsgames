"""Flask application factory for the Paths Games Flask frontend."""
import os
import uuid as uuidlib

from flask import Flask, request, session

from .config import MOCK_SERVER, Config
from .i18n import make_translator, normalize_lang

_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), os.pardir))

LANG_COOKIE = "pg_lang"
THEME_COOKIE = "pg_theme"
CONSENT_COOKIE = "pg_consent"


def create_app(config_object=Config):
    app = Flask(
        __name__,
        static_folder=os.path.join(_ROOT, "static"),
        template_folder=os.path.join(_ROOT, "templates"),
    )
    app.config.from_object(config_object)

    # Blueprints
    from .blueprints.catalog import bp as catalog_bp
    from .blueprints.config_bp import bp as config_bp
    from .blueprints.match_bp import bp as match_bp
    from .blueprints.user_bp import bp as user_bp
    from .blueprints.legal import bp as legal_bp
    from .blueprints.prefs import bp as prefs_bp

    for bp in (catalog_bp, config_bp, match_bp, user_bp, legal_bp, prefs_bp):
        app.register_blueprint(bp)

    @app.before_request
    def _ensure_guest():
        # Anonymous guest identity (mirrors the React guest session) — id only.
        if "guest_id" not in session:
            session["guest_id"] = str(uuidlib.uuid4())
            session["guest_name"] = "Traveller-" + session["guest_id"][:8]

    @app.context_processor
    def _inject_globals():
        lang = normalize_lang(request.cookies.get(LANG_COOKIE, app.config["DEFAULT_LANG"]))
        theme = request.cookies.get(THEME_COOKIE, "default")
        consent = request.cookies.get(CONSENT_COOKIE, "")
        return {
            "t": make_translator(lang),
            "lang": lang,
            "theme": theme if theme in ("default", "access") else "default",
            "consent": consent,  # "", "all" or "necessary"
            "gtm_id": app.config.get("GTM_ID", ""),
            "is_mock": app.config.get("BASE_URL", MOCK_SERVER) == MOCK_SERVER,
            "guest_name": session.get("guest_name"),
            "guest_id": session.get("guest_id"),
            "app_version": "0.1.0",
        }

    return app
