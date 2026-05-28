"""
Shared test fixtures and sys.path setup for AWS Lambda unit tests.
All Lambda handlers use `from common import db_utils` — we need `lambda/`
on the path so those imports resolve without a SAM build.
"""
import sys
import os
import pytest

# Make the lambda/ directory importable as a package root
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'lambda'))
# Make the tests/ directory importable so helpers.py is reachable
sys.path.insert(0, os.path.dirname(__file__))


@pytest.fixture
def ctx():
    """Dummy Lambda context (unused by all handlers)."""
    return {}
