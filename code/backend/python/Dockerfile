FROM python:3.13-slim

WORKDIR /app

# Install dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy source + seed scripts
COPY app/ ./app/
COPY scripts/ ./scripts/

# Public API (8042) + admin API (8044)
EXPOSE 8042 8044

# Bind both uvicorn servers on all interfaces so the published ports are reachable.
ENV HOST=0.0.0.0

# Single process serving BOTH apps (public on 8042, admin on 8044) — see app/launcher.py
CMD ["python", "-m", "app.launcher"]
