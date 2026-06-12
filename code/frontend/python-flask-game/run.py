"""Dev entry point: ``python run.py`` -> http://localhost:5099

Set BASE_URL to talk to a live Java backend, e.g.:
    BASE_URL=http://localhost:8042 python run.py
Otherwise the bundled mock data is used (default).
"""
import os

from app import create_app

app = create_app()

if __name__ == "__main__":
    port = int(os.environ.get("PORT", "5099"))
    app.run(host="0.0.0.0", port=port, debug=True)
