#!/usr/bin/env bash
# start app.py in environment with game-icons data and open browser to http://localhost:5000
# This is a helper script for development, not meant for production use.
# It assumes you have Python 3.8+ and pip installed, and that you run it from the project root.
set -eo pipefail
cd "$(dirname "$0")/../../../../.."  # go to project root
# Check if app.py exists
if [ ! -f "code/scripts/dev/image-finder/game-icons/app.py" ]; then
    echo "Error: app.py not found. Please run this script from the project root."
    exit 1
fi
# Create virtual environment if not exists
if [ ! -d ".venv" ]; then
    python3 -m venv .venv
fi
# Activate virtual environment and install requirements
source .venv/bin/activate
pip install --upgrade pip
pip install -r code/scripts/dev/image-finder/game-icons/requirements.txt
# Run the app
echo "Starting the Game Icons Search app..."
python code/scripts/dev/image-finder/game-icons/app.py
