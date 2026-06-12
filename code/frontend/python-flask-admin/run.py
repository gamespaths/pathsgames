"""Dev entry point: ``python run.py`` -> http://localhost:5098

Talks to the admin backend on ADMIN_BASE_URL (default http://localhost:8044).
Override per-session from the login page, or globally:
    ADMIN_BASE_URL=http://localhost:8044 python run.py
"""
import os

from app import create_app

app = create_app()

if __name__ == "__main__":
    port = int(os.environ.get("PORT", "5098"))
    app.run(host="0.0.0.0", port=port, debug=True)
